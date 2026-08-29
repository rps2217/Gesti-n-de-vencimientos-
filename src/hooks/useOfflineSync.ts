import { useState, useEffect, useCallback, useRef } from 'react';
import { indexedDbService, OfflineMutation } from '../db/indexedDbService';
import { appendRow, updateRow, deleteRow, getSheetData } from '../lib/sheets';
import { matchRowIndexByIdentity } from '../utils/entityIdentityResolver';

export function useOfflineSync(onSyncSuccess?: () => Promise<void>) {
  const [offlineQueue, setOfflineQueue] = useState<OfflineMutation[]>([]);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastCachedAt, setLastCachedAt] = useState<string | null>(null);

  const isSyncingRef = useRef<boolean>(false);
  isSyncingRef.current = isSyncing;

  // Refresh offline queue from IndexedDB
  const refreshQueue = useCallback(async () => {
    try {
      const queue = await indexedDbService.getOfflineQueue();
      // Ensure strict FIFO ordering by creation date
      queue.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setOfflineQueue(queue);
      return queue;
    } catch (e) {
      console.warn('Error refreshing offline queue:', e);
      return [];
    }
  }, []);

  // Enqueue a mutation to IndexedDB and state
  const enqueueMutation = useCallback(
    async (mutation: {
      type: 'append' | 'update' | 'delete';
      sheetTitle: string;
      sheetId?: number;
      rowIndex?: number;
      entityKey?: string;
      entityKeyCol?: string;
      keyValue?: string;
      keyColumn?: string;
      headers?: string[];
      values?: any;
    }) => {
      const created = await indexedDbService.enqueueMutation(mutation);
      await refreshQueue();
      return created;
    },
    [refreshQueue]
  );

  // Synchronize the queue of mutations with Google Sheets in FIFO order
  const syncQueue = useCallback(async () => {
    if (isSyncingRef.current) return { success: false, count: 0, errors: ['Sincronización en curso'] };

    const currentQueue = await indexedDbService.getOfflineQueue();
    if (currentQueue.length === 0) {
      return { success: true, count: 0, errors: [] };
    }

    // Sort strictly FIFO
    currentQueue.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    setIsSyncing(true);
    let successCount = 0;
    const errors: string[] = [];
    const freshSheetsCache = new Map<string, any[][]>();

    try {
      for (const mutation of currentQueue) {
        // Skip mutations that have failed more than 4 times unless explicitly retried
        if (mutation.attempts && mutation.attempts >= 5 && mutation.status === 'failed') {
          continue;
        }

        try {
          await indexedDbService.updateMutationStatus(mutation.id, 'syncing');

          if (mutation.type === 'append') {
            await appendRow(mutation.sheetTitle, mutation.values);
          } else if (mutation.type === 'update') {
            let targetRowIndex = mutation.rowIndex;

            // Re-resolve rowIndex by entity key if available to prevent corrupting shifted rows
            if (mutation.keyValue && mutation.headers && mutation.headers.length > 0) {
              try {
                let currentRows = freshSheetsCache.get(mutation.sheetTitle);
                if (!currentRows) {
                  currentRows = await getSheetData(mutation.sheetTitle, true);
                  if (currentRows && currentRows.length > 0) {
                    freshSheetsCache.set(mutation.sheetTitle, currentRows);
                  }
                }

                if (currentRows && currentRows.length > 0) {
                  const resolvedRowIndex = matchRowIndexByIdentity(
                    {
                      keyColumn: mutation.keyColumn || mutation.entityKeyCol || null,
                      keyValue: mutation.keyValue || mutation.entityKey || '',
                      isSynthetic: false,
                      rowIndex: mutation.rowIndex || 0
                    },
                    currentRows,
                    mutation.headers
                  );
                  if (resolvedRowIndex && resolvedRowIndex > 1) {
                    targetRowIndex = resolvedRowIndex;
                  }
                }
              } catch (e) {
                console.warn('[OfflineSync] Could not re-resolve rowIndex by key, fallback to original rowIndex:', e);
              }
            }

            if (targetRowIndex && targetRowIndex > 1) {
              await updateRow(mutation.sheetTitle, targetRowIndex, mutation.values);
              // Invalidate cached sheet so next mutation fetches updated state
              freshSheetsCache.delete(mutation.sheetTitle);
            } else {
              throw new Error(`Índice de fila inválido para actualización (${targetRowIndex})`);
            }
          } else if (mutation.type === 'delete') {
            let targetRowIndex = mutation.rowIndex;

            // Re-resolve rowIndex by entity key if available
            if (mutation.keyValue && mutation.headers && mutation.headers.length > 0) {
              try {
                let currentRows = freshSheetsCache.get(mutation.sheetTitle);
                if (!currentRows) {
                  currentRows = await getSheetData(mutation.sheetTitle, true);
                  if (currentRows && currentRows.length > 0) {
                    freshSheetsCache.set(mutation.sheetTitle, currentRows);
                  }
                }

                if (currentRows && currentRows.length > 0) {
                  const resolvedRowIndex = matchRowIndexByIdentity(
                    {
                      keyColumn: mutation.keyColumn || mutation.entityKeyCol || null,
                      keyValue: mutation.keyValue || mutation.entityKey || '',
                      isSynthetic: false,
                      rowIndex: mutation.rowIndex || 0
                    },
                    currentRows,
                    mutation.headers
                  );
                  if (resolvedRowIndex && resolvedRowIndex > 1) {
                    targetRowIndex = resolvedRowIndex;
                  }
                }
              } catch (e) {
                console.warn('[OfflineSync] Could not re-resolve rowIndex for deletion by key:', e);
              }
            }

            if (targetRowIndex && targetRowIndex > 1) {
              await deleteRow(mutation.sheetId || 0, targetRowIndex, mutation.sheetTitle);
              // Invalidate cached sheet
              freshSheetsCache.delete(mutation.sheetTitle);
            } else {
              throw new Error(`Índice de fila inválido para eliminación (${targetRowIndex})`);
            }
          }

          // Remove from IndexedDB on success
          await indexedDbService.removeMutation(mutation.id);
          successCount++;
        } catch (err: any) {
          console.error(`[OfflineSync] Error procesando mutación ${mutation.id} (${mutation.type}):`, err);
          errors.push(err.message || 'Error de sincronización');
          await indexedDbService.updateMutationStatus(mutation.id, 'failed', err.message || 'Error en red');
        }
      }

      // Refresh state after sync attempt
      const remaining = await refreshQueue();
      setIsOffline(!navigator.onLine || remaining.length > 0);

      if (successCount > 0 && onSyncSuccess) {
        await onSyncSuccess();
      }

      return {
        success: errors.length === 0,
        count: successCount,
        errors
      };
    } finally {
      setIsSyncing(false);
    }
  }, [refreshQueue, onSyncSuccess]);

  // Remove an individual mutation from the queue
  const removeMutation = useCallback(async (id: string) => {
    await indexedDbService.removeMutation(id);
    await refreshQueue();
  }, [refreshQueue]);

  // Clear all pending mutations in the queue
  const clearQueue = useCallback(async () => {
    await indexedDbService.clearOfflineQueue();
    setOfflineQueue([]);
  }, []);

  // Initial load and event listeners for network changes
  useEffect(() => {
    refreshQueue();

    const handleOnline = () => {
      setIsOffline(false);
      // Auto-trigger reconciliation on internet restoration if queue has items
      indexedDbService.getOfflineQueue().then((q) => {
        if (q.length > 0 && !isSyncingRef.current) {
          console.log('[OfflineSync] Conexión restablecida. Auto-sincronizando cola offline...');
          syncQueue();
        }
      });
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check every 60s to attempt sync if online and items are pending
    const intervalId = setInterval(() => {
      if (navigator.onLine && !isSyncingRef.current) {
        indexedDbService.getOfflineQueue().then((q) => {
          if (q.some(m => m.status === 'pending')) {
            syncQueue();
          }
        });
      }
    }, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [refreshQueue, syncQueue]);

  return {
    offlineQueue,
    isOffline,
    setIsOffline,
    isSyncing,
    setIsSyncing,
    lastCachedAt,
    setLastCachedAt,
    enqueueMutation,
    syncQueue,
    removeMutation,
    clearQueue,
    refreshQueue
  };
}
