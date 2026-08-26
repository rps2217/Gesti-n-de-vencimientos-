import { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { InventoryItem, SheetConfig } from '../types';
import { 
  getItemStatus, 
  getEventCategory, 
  getItemResolutionStatus 
} from '../utils/dateCalculations';
import { findColumnBySemantic } from '../utils/columnAliases';
import { VIRTUAL_COLUMNS } from '../utils/virtualColumns';

export interface DisplayRowItem {
  type: 'item';
  item: InventoryItem;
  groupKey?: string;
  index: number;
}

export interface DisplayRowHeader {
  type: 'header';
  groupKey: string;
  count: number;
  isCollapsed: boolean;
}

export type DisplayRow = DisplayRowItem | DisplayRowHeader;

export interface UseInventoryFilteringProps {
  items: InventoryItem[];
  headers: string[];
  activeView: 'main' | 'events' | 'products' | 'policies';
  frcBodCol: string | null;
  sheetConfig: SheetConfig;
  products: any[];
  policies: any[];
  searchTerm: string;
  activeQuickChip: string | null;
  searchableHeaders: string[];
  pageSize: number | 'all';
  currentPage: number;
}

export function handleFilterToggle<T>(current: T[], value: T, isMulti = false): T[] {
  if (!isMulti) {
    if (current.length === 1 && current[0] === value) return [];
    return [value];
  }
  return current.includes(value) ? current.filter(x => x !== value) : [...current, value];
}

export function useInventoryFiltering({
  items,
  headers,
  activeView,
  frcBodCol,
  sheetConfig,
  products,
  policies,
  searchTerm,
  activeQuickChip,
  searchableHeaders,
  pageSize,
  currentPage,
}: UseInventoryFilteringProps) {
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Filter state
  const [eventFilter, setEventFilter] = useState<string[]>([]);
  const [frcBodFilter, setFrcBodFilter] = useState<string[]>([]);
  const [eventResolutionFilter, setEventResolutionFilter] = useState<string[]>([]);
  const [pmRadarFilter, setPmRadarFilter] = useState<string[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [groupByColumn, setGroupByColumn] = useState<string>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Reset collapsed groups when group by column changes
  useEffect(() => {
    setCollapsedGroups({});
  }, [groupByColumn]);

  // Single-pass aggregator for all metrics and bodega counts
  const {
    eventMetrics,
    pmMetrics,
    eventResolutionMetrics,
    frcBodValues,
    frcBodCounts
  } = useMemo(() => {
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

      // 1. Bodega count
      if (frcBodCol) {
        const val = item[frcBodCol];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const trimmed = String(val).trim();
          bodSet.add(trimmed);
          bodCounts[trimmed] = (bodCounts[trimmed] || 0) + 1;
        }
      }

      // 2. Event & Status metrics
      const cat = getEventCategory(item, headers);
      if (cat === 'TRANSPORTE') {
        transporte++;
      } else if (cat === 'DIFERENCIA') {
        diferencia++;
      } else if (cat === 'CAL_INTERNA') {
        calInterna++;
      } else if (cat === 'CAL_EXTERNA') {
        calExterna++;
      } else if (cat === 'CANJES') {
        canjes++;
      } else if (cat === 'AVERIA') {
        averia++;
      } else if (cat === 'DEVOLUCION') {
        devolucion++;
      } else if (cat === 'VENCIMIENTO_CERCANO') {
        vencimientoCercano++;
      } else {
        vencimientos++;
        const st = getItemStatus(item, headers);
        if (st.code === 'DRAINAGE_PM') drainagePm++;
        else if (st.code === 'UPCOMING') upcoming++;
        else if (st.code === 'RETIRE_NOW' || st.code === 'EXPIRED') retireNow++;
      }

      // 3. Resolution metrics
      const res = getItemResolutionStatus(item, headers);
      if (res.isResolved) completed++;
      else pending++;
    }

    const sortedBodValues = Array.from(bodSet).sort((a, b) => a.localeCompare(b));

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
      frcBodValues: sortedBodValues,
      frcBodCounts: bodCounts
    };
  }, [items, headers, frcBodCol]);

  // Virtual columns augmentation
  const augmentedItems = useMemo(() => {
    return items.map(item => {
      const virtualData: Record<string, any> = {};
      const activeVCs = sheetConfig.activeVirtualColumns || [];
      VIRTUAL_COLUMNS.filter(col => activeVCs.includes(col.id)).forEach(col => {
        virtualData[col.id] = col.calculate(item, headers, { products, policies });
      });
      return { ...item, ...virtualData };
    });
  }, [items, headers, sheetConfig.activeVirtualColumns, products, policies]);

  // Options map for column dropdown filter menus
  const columnOptionsMap = useMemo(() => {
    const map: Record<string, { label: string; value: string }[]> = {};
    const activeVCs = sheetConfig.activeVirtualColumns || [];
    const allHeaders = [...headers, ...VIRTUAL_COLUMNS.filter(vc => activeVCs.includes(vc.id)).map(vc => vc.id)];
    
    allHeaders.forEach(h => {
      const uniqueVals = new Set<string>();
      augmentedItems.forEach(item => {
        const val = item[h];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          uniqueVals.add(String(val).trim());
        } else {
          uniqueVals.add('(Vacío)');
        }
      });
      map[h] = Array.from(uniqueVals)
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 100)
        .map(v => ({ label: v, value: v }));
    });
    return map;
  }, [augmentedItems, headers, sheetConfig.activeVirtualColumns]);

  // Fast single-pass filtering
  const filteredItems = useMemo(() => {
    const hasEventFilter = activeView === 'events' && eventFilter.length > 0;
    const eventFilterSet = hasEventFilter ? new Set(eventFilter) : null;

    const hasFrcBodFilter = frcBodFilter.length > 0 && !!frcBodCol;
    const frcBodFilterSet = hasFrcBodFilter ? new Set(frcBodFilter) : null;

    const hasEventResFilter = activeView === 'events' && eventResolutionFilter.length > 0;
    const eventResFilterSet = hasEventResFilter ? new Set(eventResolutionFilter) : null;

    const hasPmRadarFilter = activeView === 'main' && pmRadarFilter.length > 0;
    const pmRadarFilterSet = hasPmRadarFilter ? new Set(pmRadarFilter) : null;

    const activeColFilterEntries = (Object.entries(columnFilters) as [string, string[]][])
      .filter(([_, vals]) => vals && vals.length > 0)
      .map(([colName, vals]) => [colName, new Set(vals)] as [string, Set<string>]);
    const hasColFilters = activeColFilterEntries.length > 0;

    const traspasoCol = hasEventResFilter ? (findColumnBySemantic(headers, 'n_traspaso') || 'N_TRASPASO') : '';
    const term = (deferredSearchTerm.trim() || activeQuickChip || '').toLowerCase();
    const hasSearch = term.length > 0;

    const result: InventoryItem[] = [];
    const len = augmentedItems.length;

    for (let i = 0; i < len; i++) {
      const item = augmentedItems[i];

      // View constraints
      if (activeView === 'main') {
        const cat = getEventCategory(item, headers);
        if (cat !== 'VENCIMIENTO' && cat !== 'VENCIMIENTO_CERCANO') {
          continue;
        }
        if (frcBodFilterSet && frcBodCol) {
          const val = item[frcBodCol];
          const valStr = val !== undefined && val !== null ? String(val).trim() : '';
          if (!frcBodFilterSet.has(valStr)) continue;
        }
        if (pmRadarFilterSet) {
          const st = getItemStatus(item, headers);
          let matchPm = false;
          if (pmRadarFilterSet.has('drainage') && st.code === 'DRAINAGE_PM') matchPm = true;
          else if (pmRadarFilterSet.has('upcoming') && st.code === 'UPCOMING') matchPm = true;
          else if (pmRadarFilterSet.has('retire_now') && (st.code === 'RETIRE_NOW' || st.code === 'EXPIRED')) matchPm = true;
          else if (pmRadarFilterSet.has('en_regla') && st.code === 'NORMAL') matchPm = true;
          if (!matchPm) continue;
        }
      } else if (activeView === 'events') {
        if (eventFilterSet) {
          const cat = getEventCategory(item, headers);
          if (!cat || !eventFilterSet.has(cat)) continue;
        }
        if (frcBodFilterSet && frcBodCol) {
          const val = item[frcBodCol];
          const valStr = val !== undefined && val !== null ? String(val).trim() : '';
          if (!frcBodFilterSet.has(valStr)) continue;
        }
        if (eventResFilterSet) {
          const isResolved = getItemResolutionStatus(item, headers).isResolved;
          const status = isResolved ? 'completed' : 'pending';
          const traspasoVal = item[traspasoCol];
          const matchRes = eventResFilterSet.has(status) || (traspasoVal && eventResFilterSet.has(String(traspasoVal)));
          if (!matchRes) continue;
        }
      }

      // Column filters
      if (hasColFilters) {
        let matchCols = true;
        for (let j = 0; j < activeColFilterEntries.length; j++) {
          const [colName, valSet] = activeColFilterEntries[j];
          const val = item[colName];
          const valStr = val !== undefined && val !== null && String(val).trim() !== '' ? String(val).trim() : '(Vacío)';
          if (!valSet.has(valStr)) {
            matchCols = false;
            break;
          }
        }
        if (!matchCols) continue;
      }

      // Global text search
      if (hasSearch) {
        let matchSearch = false;
        for (let j = 0; j < searchableHeaders.length; j++) {
          const val = item[searchableHeaders[j]];
          if (val !== undefined && val !== null && String(val).toLowerCase().includes(term)) {
            matchSearch = true;
            break;
          }
        }
        if (!matchSearch) continue;
      }

      result.push(item);
    }

    return result;
  }, [augmentedItems, deferredSearchTerm, activeQuickChip, searchableHeaders, activeView, eventFilter, frcBodFilter, frcBodCol, eventResolutionFilter, pmRadarFilter, columnFilters, headers]);

  // Grouping logic
  const groupedItems = useMemo(() => {
    if (groupByColumn === 'none') return null;
    const map = new Map<string, InventoryItem[]>();
    for (const item of filteredItems) {
      const rawVal = item[groupByColumn];
      const val = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '' 
        ? String(rawVal).trim() 
        : '(Sin asignar / Vacío)';
      if (!map.has(val)) {
        map.set(val, []);
      }
      map.get(val)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));
  }, [filteredItems, groupByColumn]);

  // Virtualization display row structure
  const displayRows = useMemo<DisplayRow[]>(() => {
    if (groupByColumn === 'none' || !groupedItems) {
      return filteredItems.map((item, index) => ({
        type: 'item' as const,
        item,
        index
      }));
    }

    const rows: DisplayRow[] = [];
    let runningIndex = 0;

    for (const [groupKey, groupItemList] of groupedItems) {
      const isCollapsed = !!collapsedGroups[groupKey];
      rows.push({
        type: 'header',
        groupKey,
        count: groupItemList.length,
        isCollapsed
      });

      if (!isCollapsed) {
        for (const item of groupItemList) {
          rows.push({
            type: 'item',
            item,
            groupKey,
            index: runningIndex++
          });
        }
      }
    }

    return rows;
  }, [groupByColumn, groupedItems, filteredItems, collapsedGroups]);

  // Paginated display rows
  const paginatedDisplayRows = useMemo<DisplayRow[]>(() => {
    if (pageSize === 'all' || groupByColumn !== 'none') return displayRows;
    const start = (currentPage - 1) * (pageSize as number);
    return displayRows.slice(start, start + (pageSize as number));
  }, [displayRows, currentPage, pageSize, groupByColumn]);

  // Group helpers
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  }, []);

  const expandAllGroups = useCallback(() => {
    setCollapsedGroups({});
  }, []);

  const collapseAllGroups = useCallback(() => {
    if (!groupedItems) return;
    const allCollapsed: Record<string, boolean> = {};
    for (const [key] of groupedItems) {
      allCollapsed[key] = true;
    }
    setCollapsedGroups(allCollapsed);
  }, [groupedItems]);

  const clearAllFilters = useCallback(() => {
    setEventFilter([]);
    setFrcBodFilter([]);
    setEventResolutionFilter([]);
    setPmRadarFilter([]);
    setColumnFilters({});
  }, []);

  return {
    deferredSearchTerm,
    eventFilter,
    setEventFilter,
    frcBodFilter,
    setFrcBodFilter,
    eventResolutionFilter,
    setEventResolutionFilter,
    pmRadarFilter,
    setPmRadarFilter,
    columnFilters,
    setColumnFilters,
    groupByColumn,
    setGroupByColumn,
    collapsedGroups,
    toggleGroupCollapse,
    expandAllGroups,
    collapseAllGroups,
    clearAllFilters,
    eventMetrics,
    pmMetrics,
    eventResolutionMetrics,
    frcBodValues,
    frcBodCounts,
    augmentedItems,
    columnOptionsMap,
    filteredItems,
    groupedItems,
    displayRows,
    paginatedDisplayRows
  };
}
