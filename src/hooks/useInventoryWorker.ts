import { useState, useEffect, useRef, useMemo } from 'react';
import { InventoryItem, SheetConfig } from '../types';
import { WorkerMetricsResult, WorkerOutMessage } from '../workers/inventoryWorker';
import { 
  getEventCategory, 
  computeItemRawStatus, 
  getItemResolutionStatus 
} from '../utils/pureCalculations';

export interface UseInventoryWorkerProps {
  items: InventoryItem[];
  headers: string[];
  frcBodCol: string | null;
  searchableHeaders: string[];
  activeView: 'main' | 'events' | 'products' | 'policies';
  searchTerm: string;
  activeQuickChip: string | null;
  eventFilter: string[];
  frcBodFilter: string[];
  eventResolutionFilter: string[];
  pmRadarFilter: string[];
  columnFilters: Record<string, string[]>;
  dynamicMonthFilter?: number[];
}

export function useInventoryWorker({
  items,
  headers,
  frcBodCol,
  searchableHeaders,
  activeView,
  searchTerm,
  activeQuickChip,
  eventFilter,
  frcBodFilter,
  eventResolutionFilter,
  pmRadarFilter,
  columnFilters,
  dynamicMonthFilter = []
}: UseInventoryWorkerProps) {
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [metrics, setMetrics] = useState<WorkerMetricsResult | null>(null);
  const [matchingIndices, setMatchingIndices] = useState<number[] | null>(null);

  // Initialize Worker
  useEffect(() => {
    try {
      const worker = new Worker(
        new URL('../workers/inventoryWorker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
        const { type, payload } = e.data;
        if (type === 'DATA_PROCESSED') {
          setMetrics(payload);
          setIsProcessing(false);
        } else if (type === 'FILTER_RESULT') {
          setMatchingIndices(payload.matchingIndices);
          setIsProcessing(false);
        }
      };

      worker.onerror = (err) => {
        console.warn('Inventory Web Worker encountered an error, falling back to local thread computation:', err);
        setIsWorkerReady(false);
      };

      workerRef.current = worker;
      setIsWorkerReady(true);

      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch (e) {
      console.warn('Web Workers unavailable or failed to initialize, using main thread fallback:', e);
      setIsWorkerReady(false);
    }
  }, []);

  // Post PROCESS_DATA when dataset or structural headers change
  useEffect(() => {
    if (workerRef.current && isWorkerReady) {
      setIsProcessing(true);
      workerRef.current.postMessage({
        type: 'PROCESS_DATA',
        payload: {
          items,
          headers,
          frcBodCol,
          searchableHeaders
        }
      });
      
      // Immediately trigger FILTER_DATA so matchingIndices is refreshed for the new dataset
      const effectiveSearch = (searchTerm.trim() || activeQuickChip || '').toLowerCase();
      workerRef.current.postMessage({
        type: 'FILTER_DATA',
        payload: {
          activeView,
          searchTerm: effectiveSearch,
          eventFilter,
          frcBodFilter,
          frcBodCol,
          eventResolutionFilter,
          pmRadarFilter,
          columnFilters,
          dynamicMonthFilter
        }
      });
    }
  }, [items, headers, frcBodCol, searchableHeaders, isWorkerReady]);

  // Post FILTER_DATA when filter criteria or search term changes
  useEffect(() => {
    const effectiveSearch = (searchTerm.trim() || activeQuickChip || '').toLowerCase();
    if (workerRef.current && isWorkerReady) {
      workerRef.current.postMessage({
        type: 'FILTER_DATA',
        payload: {
          activeView,
          searchTerm: effectiveSearch,
          eventFilter,
          frcBodFilter,
          frcBodCol,
          eventResolutionFilter,
          pmRadarFilter,
          columnFilters,
          dynamicMonthFilter
        }
      });
    }
  }, [
    items,
    activeView,
    searchTerm,
    activeQuickChip,
    eventFilter,
    frcBodFilter,
    frcBodCol,
    eventResolutionFilter,
    pmRadarFilter,
    columnFilters,
    dynamicMonthFilter,
    isWorkerReady
  ]);

  // Main-thread fallback calculation if Web Worker is not supported or still initializing
  const fallbackResult = useMemo(() => {
    if (isWorkerReady && metrics) return null;

    let vencimientos = 0;
    let transporte = 0;
    let diferencia = 0;
    let calInterna = 0;
    let calExterna = 0;
    let canjes = 0;
    let averia = 0;
    let devolucion = 0;
    let vencimientoCercano = 0;
    let drainagePm = 0;
    let upcoming = 0;
    let retireNow = 0;
    let pending = 0;
    let completed = 0;

    const bodCounts: Record<string, number> = {};
    const bodSet = new Set<string>();
    const len = items.length;

    for (let i = 0; i < len; i++) {
      const item = items[i];
      if (frcBodCol) {
        const val = item[frcBodCol];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const trimmed = String(val).trim();
          bodSet.add(trimmed);
          bodCounts[trimmed] = (bodCounts[trimmed] || 0) + 1;
        }
      }

      const cat = getEventCategory(item, headers);
      const statusRaw = computeItemRawStatus(item, headers);
      const res = getItemResolutionStatus(item, headers);

      if (cat === 'TRANSPORTE') transporte++;
      else if (cat === 'DIFERENCIA') diferencia++;
      else if (cat === 'CAL_INTERNA') calInterna++;
      else if (cat === 'CAL_EXTERNA') calExterna++;
      else if (cat === 'CANJES') canjes++;
      else if (cat === 'AVERIA') averia++;
      else if (cat === 'DEVOLUCION') devolucion++;
      else if (cat === 'VENCIMIENTO_CERCANO') vencimientoCercano++;
      else {
        vencimientos++;
        if (statusRaw.code === 'DRAINAGE_PM') drainagePm++;
        else if (statusRaw.code === 'UPCOMING') upcoming++;
        else if (statusRaw.code === 'RETIRE_NOW' || statusRaw.code === 'EXPIRED') retireNow++;
      }

      if (res.isResolved) completed++;
      else pending++;
    }

    return {
      eventMetrics: {
        total: len,
        vencimientos,
        transporte,
        diferencia,
        calInterna,
        calExterna,
        canjes,
        averia,
        devolucion,
        vencimientoCercano,
        drainagePm,
        upcoming,
        retireNow
      },
      pmMetrics: {
        total: vencimientos,
        drainage: drainagePm,
        upcoming,
        retireNow,
        enRegla: Math.max(0, vencimientos - drainagePm - upcoming - retireNow)
      },
      eventResolutionMetrics: {
        total: len,
        pending,
        completed
      },
      frcBodValues: Array.from(bodSet).sort((a, b) => a.localeCompare(b)),
      frcBodCounts: bodCounts,
      columnOptionsMap: {}
    };
  }, [items, headers, frcBodCol, isWorkerReady, metrics]);

  return {
    isWorkerReady,
    isProcessing,
    metrics: metrics || fallbackResult,
    matchingIndices
  };
}
