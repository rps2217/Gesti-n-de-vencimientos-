/**
 * IndexedDB Local-First Database & Offline Storage Service
 * Reemplaza el frágil límite de 5MB de localStorage por una base de datos local
 * asíncrona, robusta y capaz de almacenar cientos de miles de registros y colas de mutación.
 */

export interface CachedSheetData {
  sheetTitle: string;
  rows: any[][];
  timestamp: string;
  recordCount: number;
}

export interface OfflineMutation {
  id: string;
  type: 'append' | 'update' | 'delete';
  sheetTitle: string;
  sheetId?: number;
  rowIndex?: number;
  values?: any;
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  attempts: number;
  lastError?: string;
}

const DB_NAME = 'InventoryLogisticsDB';
const DB_VERSION = 1;

const STORES = {
  SHEETS: 'sheets',
  MUTATION_QUEUE: 'mutation_queue',
  SETTINGS: 'settings'
} as const;

class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isSupported: boolean;

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window;
  }

  private getDB(): Promise<IDBDatabase> {
    if (!this.isSupported) {
      return Promise.reject(new Error('IndexedDB no está disponible en este entorno.'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // 1. Almacén de hojas cacheadas
          if (!db.objectStoreNames.contains(STORES.SHEETS)) {
            db.createObjectStore(STORES.SHEETS, { keyPath: 'sheetTitle' });
          }

          // 2. Almacén de cola de mutaciones offline
          if (!db.objectStoreNames.contains(STORES.MUTATION_QUEUE)) {
            const mutationStore = db.createObjectStore(STORES.MUTATION_QUEUE, { keyPath: 'id' });
            mutationStore.createIndex('status', 'status', { unique: false });
            mutationStore.createIndex('createdAt', 'createdAt', { unique: false });
          }

          // 3. Almacén de configuraciones y esquemas
          if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
            db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => {
          const db = request.result;

          // Reset the connection if it's closed or if a version change occurs
          db.onclose = () => {
            this.dbPromise = null;
          };

          db.onversionchange = () => {
            db.close();
            this.dbPromise = null;
          };

          resolve(db);
        };

        request.onerror = () => {
          reject(request.error || new Error('Error al abrir IndexedDB'));
        };

        request.onblocked = () => {
          console.warn('La base de datos IndexedDB está bloqueada por otra pestaña abierta.');
        };
      });
    }

    return this.dbPromise;
  }

  // ==========================================
  // 1. GESTIÓN DE CACHÉ DE HOJAS (SHEET DATA)
  // ==========================================

  /**
   * Obtiene una hoja desde IndexedDB (o fallback localStorage si no está disponible)
   */
  async getCachedSheet(sheetTitle: string): Promise<{ rows: any[][]; timestamp: string } | null> {
    if (!sheetTitle) return null;

    try {
      if (this.isSupported) {
        const db = await this.getDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORES.SHEETS, 'readonly');
          const store = tx.objectStore(STORES.SHEETS);
          const req = store.get(sheetTitle);

          req.onsuccess = () => {
            if (req.result) {
              resolve({
                rows: req.result.rows || [],
                timestamp: req.result.timestamp || new Date().toISOString()
              });
            } else {
              // Intentar leer de localStorage si viene de versiones previas
              const lsFallback = this.getLocalStorageFallback(`appsheet_clone_cache_${sheetTitle}`);
              resolve(lsFallback);
            }
          };

          req.onerror = () => {
            resolve(this.getLocalStorageFallback(`appsheet_clone_cache_${sheetTitle}`));
          };
        });
      }
    } catch (err) {
      console.warn('IndexedDB read error, fallback a localStorage:', err);
    }

    return this.getLocalStorageFallback(`appsheet_clone_cache_${sheetTitle}`);
  }

  /**
   * Guarda de forma asíncrona una hoja completa en IndexedDB sin bloquear el hilo principal
   */
  async saveCachedSheet(sheetTitle: string, rows: any[][]): Promise<void> {
    if (!sheetTitle || !Array.isArray(rows)) return;

    const payload: CachedSheetData = {
      sheetTitle,
      rows,
      timestamp: new Date().toISOString(),
      recordCount: Math.max(0, rows.length - 1)
    };

    try {
      if (this.isSupported) {
        const db = await this.getDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORES.SHEETS, 'readwrite');
          const store = tx.objectStore(STORES.SHEETS);
          const req = store.put(payload);

          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        return;
      }
    } catch (err) {
      console.warn('IndexedDB write failed, fallback a localStorage:', err);
    }

    // Fallback safe localStorage si IndexedDB falla
    try {
      localStorage.setItem(`appsheet_clone_cache_${sheetTitle}`, JSON.stringify({
        rows,
        timestamp: payload.timestamp
      }));
    } catch (e) {
      console.warn('localStorage quota excedido al intentar guardar cache:', e);
    }
  }

  /**
   * Elimina el caché de una hoja específica
   */
  async clearCachedSheet(sheetTitle: string): Promise<void> {
    if (!sheetTitle) return;

    try {
      if (this.isSupported) {
        const db = await this.getDB();
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORES.SHEETS, 'readwrite');
          const store = tx.objectStore(STORES.SHEETS);
          const req = store.delete(sheetTitle);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
    } catch (e) {
      console.warn('Error clearing sheet from IndexedDB:', e);
    }

    try {
      localStorage.removeItem(`appsheet_clone_cache_${sheetTitle}`);
    } catch {
      // Ignore
    }
  }

  // ==========================================
  // 2. COLA DE TRANSACCIONES / MUTACIONES OFFLINE
  // ==========================================

  /**
   * Recupera todas las mutaciones offline pendientes
   */
  async getOfflineQueue(): Promise<OfflineMutation[]> {
    try {
      if (this.isSupported) {
        const db = await this.getDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORES.MUTATION_QUEUE, 'readonly');
          const store = tx.objectStore(STORES.MUTATION_QUEUE);
          const req = store.getAll();

          req.onsuccess = () => {
            const list = req.result || [];
            // Si la cola en IndexedDB está vacía, migrar desde localStorage si existía
            if (list.length === 0) {
              const lsQueue = this.getLocalStorageQueue();
              if (lsQueue.length > 0) {
                // Migrar a IndexedDB
                lsQueue.forEach(m => this.enqueueMutation(m).catch(() => {}));
                resolve(lsQueue);
                return;
              }
            }
            resolve(list);
          };

          req.onerror = () => resolve(this.getLocalStorageQueue());
        });
      }
    } catch (err) {
      console.warn('Error getting offline queue from IndexedDB:', err);
    }

    return this.getLocalStorageQueue();
  }

  /**
   * Agrega o actualiza una mutación a la cola offline
   */
  async enqueueMutation(
    mutation: Partial<OfflineMutation> & { type: 'append' | 'update' | 'delete'; sheetTitle: string }
  ): Promise<OfflineMutation> {
    const fullMutation: OfflineMutation = {
      id: mutation.id || `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: mutation.type,
      sheetTitle: mutation.sheetTitle,
      sheetId: mutation.sheetId,
      rowIndex: mutation.rowIndex,
      values: mutation.values,
      createdAt: mutation.createdAt || new Date().toISOString(),
      status: mutation.status || 'pending',
      attempts: mutation.attempts || 0,
      lastError: mutation.lastError
    };

    try {
      if (this.isSupported) {
        const db = await this.getDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORES.MUTATION_QUEUE, 'readwrite');
          const store = tx.objectStore(STORES.MUTATION_QUEUE);
          const req = store.put(fullMutation);

          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    } catch (err) {
      console.warn('Error saving mutation to IndexedDB:', err);
    }

    // Mantener backup en localStorage
    try {
      const current = this.getLocalStorageQueue();
      const existingIdx = current.findIndex(m => m.id === fullMutation.id);
      if (existingIdx >= 0) {
        current[existingIdx] = fullMutation;
      } else {
        current.push(fullMutation);
      }
      localStorage.setItem('appsheet_clone_offline_queue', JSON.stringify(current));
    } catch (e) {
      console.warn('localStorage mutation backup error:', e);
    }

    return fullMutation;
  }

  /**
   * Actualiza el estado y detalles de error de una mutación existente
   */
  async updateMutationStatus(
    id: string, 
    status: OfflineMutation['status'], 
    errorMsg?: string
  ): Promise<void> {
    try {
      if (this.isSupported) {
        const db = await this.getDB();
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORES.MUTATION_QUEUE, 'readwrite');
          const store = tx.objectStore(STORES.MUTATION_QUEUE);
          const getReq = store.get(id);

          getReq.onsuccess = () => {
            if (getReq.result) {
              const updated: OfflineMutation = {
                ...getReq.result,
                status,
                attempts: (getReq.result.attempts || 0) + (status === 'failed' ? 1 : 0),
                lastError: errorMsg || getReq.result.lastError
              };
              store.put(updated);
            }
            resolve();
          };
          getReq.onerror = () => resolve();
        });
      }
    } catch (e) {
      console.warn('Error updating mutation status in IndexedDB:', e);
    }

    try {
      const current = this.getLocalStorageQueue();
      const item = current.find(m => m.id === id);
      if (item) {
        item.status = status;
        if (status === 'failed') item.attempts = (item.attempts || 0) + 1;
        if (errorMsg) item.lastError = errorMsg;
        localStorage.setItem('appsheet_clone_offline_queue', JSON.stringify(current));
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Elimina una mutación procesada con éxito
   */
  async removeMutation(id: string): Promise<void> {
    try {
      if (this.isSupported) {
        const db = await this.getDB();
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORES.MUTATION_QUEUE, 'readwrite');
          const store = tx.objectStore(STORES.MUTATION_QUEUE);
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
    } catch (err) {
      console.warn('Error removing mutation from IndexedDB:', err);
    }

    try {
      const current = this.getLocalStorageQueue().filter(m => m.id !== id);
      localStorage.setItem('appsheet_clone_offline_queue', JSON.stringify(current));
    } catch {
      // Ignore
    }
  }

  /**
   * Limpia toda la cola offline
   */
  async clearOfflineQueue(): Promise<void> {
    try {
      if (this.isSupported) {
        const db = await this.getDB();
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORES.MUTATION_QUEUE, 'readwrite');
          const store = tx.objectStore(STORES.MUTATION_QUEUE);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
    } catch (err) {
      console.warn('Error clearing mutation queue from IndexedDB:', err);
    }

    try {
      localStorage.removeItem('appsheet_clone_offline_queue');
    } catch {
      // Ignore
    }
  }

  // ==========================================
  // 3. GESTIÓN DE CONFIGURACIONES Y PREFERENCIAS
  // ==========================================

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      if (this.isSupported) {
        const db = await this.getDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORES.SETTINGS, 'readonly');
          const store = tx.objectStore(STORES.SETTINGS);
          const req = store.get(key);

          req.onsuccess = () => {
            if (req.result && req.result.value !== undefined) {
              resolve(req.result.value as T);
            } else {
              const ls = localStorage.getItem(key);
              if (ls !== null) {
                try {
                  resolve(JSON.parse(ls) as T);
                } catch {
                  resolve(ls as unknown as T);
                }
              } else {
                resolve(defaultValue);
              }
            }
          };

          req.onerror = () => resolve(defaultValue);
        });
      }
    } catch {
      // Fallback
    }

    try {
      const ls = localStorage.getItem(key);
      return ls !== null ? JSON.parse(ls) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async saveSetting<T>(key: string, value: T): Promise<void> {
    try {
      if (this.isSupported) {
        const db = await this.getDB();
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORES.SETTINGS, 'readwrite');
          const store = tx.objectStore(STORES.SETTINGS);
          const req = store.put({ key, value, updatedAt: new Date().toISOString() });
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
    } catch (e) {
      console.warn('Error saving setting to IndexedDB:', e);
    }

    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      // Ignore
    }
  }

  // ==========================================
  // 4. DIAGNÓSTICO Y ESTIMACIÓN DE ALMACENAMIENTO
  // ==========================================

  async getStorageStats(): Promise<{
    usageMb: number;
    quotaMb: number;
    percentUsed: number;
    isSupported: boolean;
  }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usageMb = (estimate.usage || 0) / (1024 * 1024);
        const quotaMb = (estimate.quota || 0) / (1024 * 1024);
        const percentUsed = quotaMb > 0 ? (usageMb / quotaMb) * 100 : 0;

        return {
          usageMb: Math.round(usageMb * 100) / 100,
          quotaMb: Math.round(quotaMb),
          percentUsed: Math.round(percentUsed * 100) / 100,
          isSupported: true
        };
      } catch (err) {
        console.warn('Error estimating storage:', err);
      }
    }

    return {
      usageMb: 0,
      quotaMb: 0,
      percentUsed: 0,
      isSupported: false
    };
  }

  // Helpers internos
  private getLocalStorageFallback(key: string): { rows: any[][]; timestamp: string } | null {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignore
    }
    return null;
  }

  private getLocalStorageQueue(): OfflineMutation[] {
    try {
      const saved = localStorage.getItem('appsheet_clone_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }
}

export const indexedDbService = new IndexedDbService();
