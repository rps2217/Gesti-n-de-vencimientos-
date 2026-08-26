import { useState, useEffect, useCallback, useRef } from 'react';
import { indexedDbService, OfflineMutation } from '../db/indexedDbService';
import { appendRow, updateRow, deleteRow } from '../lib/sheets';

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
          } else if (mutation.type === 'update' && mutation.rowIndex) {
            await updateRow(mutation.sheetTitle, mutation.rowIndex, mutation.values);
          } else if (mutation.type === 'delete' && mutation.rowIndex) {
            await deleteRow(mutation.sheetId || 0, mutation.rowIndex, mutation.sheetTitle);
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
