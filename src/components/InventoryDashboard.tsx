import React, { useEffect, useState, useMemo, useRef, useDeferredValue } from 'react';
import { 
  getSpreadsheetMetadata, 
  getSheetData, 
  appendRow, 
  updateRow, 
  deleteRow,
  saveCloudConfig,
  loadCloudConfig,
  getScriptPropertiesConfig,
  saveScriptPropertiesConfig
} from '../lib/sheets';
import { 
  InventoryItem, 
  SpreadsheetMetadata, 
  SheetProperties, 
  SheetConfig, 
  EventCategory 
} from '../types';
import { z } from 'zod';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Plus, Edit2, Trash2, RefreshCw, Loader2, Database, AlertCircle, Package, 
  FileSpreadsheet, Printer, Settings, FileText, Search, X, Truck, RotateCcw, 
  PackageX, Sparkles, Clock, Clock3, Flame, AlertTriangle, CheckCircle2, FilterX, 
  Sliders, Link2, Download, CheckSquare, Square, Columns, Eye, EyeOff, ArrowUp, ArrowDown, Menu, Scan, GripVertical, Tag, Mail
} from 'lucide-react';

// Utilities & Hooks
import { 
  EVENT_CATEGORIES, 
  renderEventIcon, 
  parseAnyDate, 
  getEventCategory, 
  getItemStatus,
  getCategoryFromEventValue,
  getItemResolutionStatus
} from '../utils/dateCalculations';
import { findColumnBySemantic } from '../utils/columnAliases';
import { VIRTUAL_COLUMNS } from '../utils/virtualColumns';
import { useColumnResize } from '../hooks/useColumnResize';
import { 
  SAMPLE_HEADERS, 
  SAMPLE_ITEMS, 
  SAMPLE_EVENTS_HEADERS,
  SAMPLE_EVENTS_ITEMS,
  SAMPLE_PRODUCTS, 
  SAMPLE_POLICIES 
} from '../data/sampleInventory';

// Modals & Drawers & Sub-components
import { BulkImportFRC } from './BulkImportFRC';
import { Sidebar } from './navigation/Sidebar';
import { SchemaEditorView } from './views/SchemaEditorView';
import { AnalyticsDashboard } from './views/AnalyticsDashboard';
import { ItemDetailDrawer } from './drawers/ItemDetailDrawer';
import { ItemFormModal } from './modals/ItemFormModal';
import { PmReportModal } from './modals/PmReportModal';
import { ScriptCodeModal } from './modals/ScriptCodeModal';
import { GlobalConfigModal } from './modals/GlobalConfigModal';
import { BarcodeScannerModal } from './modals/BarcodeScannerModal';
import { BulkEditModal } from './modals/BulkEditModal';
import { QuickTransferModal } from './modals/QuickTransferModal';
import { exportToExcel } from '../utils/exportUtils';
import { EventResolutionCards } from './views/EventResolutionCards';
import { EventFilterChips } from './views/EventFilterChips';
import { PmRadarCards } from './views/PmRadarCards';
import { ColumnFilterMenu } from './views/ColumnFilterMenu';
import { TicketPrintView } from './views/TicketPrintView';
import { TicketConfigModal } from './modals/TicketConfigModal';
import { GmailDraftModal } from './modals/GmailDraftModal';
import { GlobalTicketConfig, ViewTicketConfig } from '../types';
import { SkeletonLoader } from './common/SkeletonLoader';

export const InventoryDashboard: React.FC = () => {
  const [metadata, setMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetProperties | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [allMainItems, setAllMainItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [isRelationalActive, setIsRelationalActive] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Storage & Cloud Sync Status
  const [hasCloudConfigSheet, setHasCloudConfigSheet] = useState<boolean>(false);
  const [cloudConfigSheetName, setCloudConfigSheetName] = useState<string>('_CONFIG_APP');
  const [configStorageMode, setConfigStorageMode] = useState<'properties' | 'sheet' | 'local'>('local');
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Advanced features: Pagination, Offline Cache & Concurrency
  const [pageSize, setPageSize] = useState<number | 'all'>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [lastCachedAt, setLastCachedAt] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('appsheet_clone_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('appsheet_clone_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  const handleSyncOfflineQueue = async () => {
    if (offlineQueue.length === 0 || !activeSheet) return;
    try {
      setIsSyncingCloud(true);
      for (const action of offlineQueue) {
        if (action.type === 'append') {
          await appendRow(action.sheetTitle, action.values);
        } else if (action.type === 'update') {
          await updateRow(action.sheetTitle, action.rowIndex, action.values);
        } else if (action.type === 'delete') {
          await deleteRow(action.sheetId, action.rowIndex);
        }
      }
      setOfflineQueue([]);
      localStorage.removeItem('appsheet_clone_offline_queue');
      await fetchData();
      alert('¡Cola offline sincronizada con éxito en Google Sheets!');
    } catch (err: any) {
      alert(`Error sincronizando cola offline: ${err.message}`);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [eventFilter, setEventFilter] = useState<string[]>([]);
  const [eventResolutionFilter, setEventResolutionFilter] = useState<string[]>([]);
  const [quickTraspasoItem, setQuickTraspasoItem] = useState<InventoryItem | null>(null);
  const [isQuickTraspasoOpen, setIsQuickTraspasoOpen] = useState<boolean>(false);
  const [pmRadarFilter, setPmRadarFilter] = useState<string[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  // Multiselect toggle helper (Ctrl/Cmd + Click)
  const handleFilterToggle = (current: string[], value: string, isMulti: boolean): string[] => {
    if (value === 'all') return [];
    if (!isMulti) {
      return current.includes(value) && current.length === 1 ? [] : [value];
    }
    if (current.includes(value)) {
      return current.filter(v => v !== value);
    }
    return [...current, value];
  };
  const [activeQuickChip, setActiveQuickChip] = useState<string | null>(null);

  const hasActiveFilters = 
    searchTerm !== '' || 
    eventFilter.length > 0 || 
    eventResolutionFilter.length > 0 || 
    pmRadarFilter.length > 0 || 
    activeQuickChip !== null ||
    Object.values(columnFilters).some((vals: string[]) => vals && vals.length > 0);

  const clearAllFilters = () => {
    setSearchTerm('');
    setEventFilter([]);
    setEventResolutionFilter([]);
    setPmRadarFilter([]);
    setColumnFilters({});
    setActiveQuickChip(null);
  };

  const [groupByColumn, setGroupByColumn] = useState<string>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('appsheet_clone_col_orders');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('appsheet_clone_hidden_cols');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist column preferences
  useEffect(() => {
    localStorage.setItem('appsheet_clone_col_orders', JSON.stringify(columnOrders));
  }, [columnOrders]);

  useEffect(() => {
    localStorage.setItem('appsheet_clone_hidden_cols', JSON.stringify(hiddenColumns));
  }, [hiddenColumns]);

  // Sheet configuration state
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(() => {
    try {
      const saved = localStorage.getItem('appsheet_clone_config');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<string>('main');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [areFiltersVisible, setAreFiltersVisible] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isPmReportOpen, setIsPmReportOpen] = useState(false);
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedEventCategory, setSelectedEventCategory] = useState<EventCategory>('VENCIMIENTO');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [globalTicketConfig, setGlobalTicketConfig] = useState<GlobalTicketConfig>({});
  const [isTicketConfigOpen, setIsTicketConfigOpen] = useState(false);
  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('global_ticket_print_config');
    if (saved) {
      try {
        setGlobalTicketConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse global ticket config', e);
      }
    }
  }, []);

  const handleSaveTicketConfig = (view: string, viewConfig: ViewTicketConfig) => {
    setGlobalTicketConfig(prev => {
      const updated = { ...prev, [view]: viewConfig };
      localStorage.setItem('global_ticket_print_config', JSON.stringify(updated));
      return updated;
    });
    setIsTicketConfigOpen(false);
  };

  const handlePrintTicket = (itemsToPrint: InventoryItem[]) => {
    if (itemsToPrint.length === 0) {
      alert("No hay registros para imprimir.");
      return;
    }
    // El renderizado de TicketPrintView se encarga de mostrar solo el ticket en modo @media print
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Column Resizing Custom Hook
  const activeSheetKey = activeSheet?.title || activeView;
  const {
    resizingCol,
    getColWidth,
    handleStartResize,
    handleAutoFitColumn,
    handleResetColWidths,
    hasCustomColWidths
  } = useColumnResize({
    activeSheetKey,
    items
  });

  const saveConfig = (newConfig: SheetConfig) => {
    setSheetConfig(newConfig);
    try {
      localStorage.setItem('appsheet_clone_config', JSON.stringify(newConfig));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  };

  // Push config to Google Apps Script PropertiesService (Option 2 - Zero Extra Sheets)
  const handlePushPropertiesConfig = async () => {
    try {
      setIsSyncingCloud(true);
      await saveScriptPropertiesConfig(sheetConfig);
      setConfigStorageMode('properties');
      setSyncSuccessMessage('¡Configuración guardada en la Nube con PropertiesService (Opción 2)!');
      setTimeout(() => setSyncSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Error al guardar en PropertiesService: ${err.message}. Verifica haber pegado el código actualizado en Apps Script.`);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Push config to Google Sheet hidden tab (Option 1)
  const handlePushCloudConfig = async () => {
    try {
      setIsSyncingCloud(true);
      const targetSheet = cloudConfigSheetName || '_CONFIG_APP';
      await saveCloudConfig(targetSheet, sheetConfig);
      setHasCloudConfigSheet(true);
      setConfigStorageMode('sheet');
      setSyncSuccessMessage('¡Configuración guardada con éxito en la pestaña ' + targetSheet + '!');
      setTimeout(() => setSyncSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Error al guardar en la nube: ${err.message}`);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const visibleHeaders = useMemo(() => {
    if (!activeSheet) return [];
    
    // First, filter out those hidden via schema OR hidden locally via user preference
    const viewHidden = hiddenColumns[activeView] || [];
    let cols = headers.filter(h => 
      sheetConfig.schema?.[activeSheet.title]?.[h]?.visible !== false &&
      !viewHidden.includes(h)
    );

    // Then, reorder them if a custom order exists for this view
    const viewOrder = columnOrders[activeView];
    if (viewOrder && viewOrder.length > 0) {
      cols.sort((a, b) => {
        const idxA = viewOrder.indexOf(a);
        const idxB = viewOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }
    
    // Finally, append active virtual columns
    const activeVCs = sheetConfig.activeVirtualColumns || [];
    const virtualColHeaders = VIRTUAL_COLUMNS.filter(vc => activeVCs.includes(vc.id)).map(vc => vc.id);
    
    return [...cols, ...virtualColHeaders];
  }, [headers, activeSheet, sheetConfig.schema, hiddenColumns, columnOrders, activeView, sheetConfig.activeVirtualColumns]);

  const handleColumnDrop = (targetHeader: string, droppedHeader: string) => {
    if (targetHeader === droppedHeader) return;
    const currentOrder = columnOrders[activeView] || visibleHeaders;
    const newOrder = [...currentOrder];
    visibleHeaders.forEach(h => {
      if (!newOrder.includes(h)) newOrder.push(h);
    });
    const fromIdx = newOrder.indexOf(droppedHeader);
    const toIdx = newOrder.indexOf(targetHeader);
    if (fromIdx !== -1 && toIdx !== -1) {
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, droppedHeader);
      setColumnOrders(prev => ({
        ...prev,
        [activeView]: newOrder
      }));
    }
  };

  const searchableHeaders = useMemo(() => {
    if (!activeSheet) return headers;
    const currentSchema = sheetConfig.schema?.[activeSheet.title];
    return headers.filter(h => {
      if (currentSchema && currentSchema[h] !== undefined) {
        return currentSchema[h].searchable !== false;
      }
      return true;
    });
  }, [headers, activeSheet, sheetConfig.schema]);

  // Event Metrics Summary
  const eventMetrics = useMemo(() => {
    if ((activeView !== 'main' && activeView !== 'events') || items.length === 0) {
      return {
        total: items.length,
        vencimientos: 0,
        transporte: 0,
        diferencia: 0,
        averia: 0,
        devolucion: 0,
        vencimientoCercano: 0,
        drainagePm: 0,
        upcoming: 0,
        retireNow: 0
      };
    }

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

    items.forEach(item => {
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
    });

    return {
      total: items.length,
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
    };
  }, [items, headers, activeView]);

  // PM Radar Metrics
  const pmMetrics = useMemo(() => {
    return {
      total: eventMetrics.vencimientos,
      drainage: eventMetrics.drainagePm,
      upcoming: eventMetrics.upcoming,
      retireNow: eventMetrics.retireNow,
      enRegla: eventMetrics.vencimientos - eventMetrics.drainagePm - eventMetrics.upcoming - eventMetrics.retireNow
    };
  }, [eventMetrics]);

  // Event Resolution Metrics (Pendientes vs Realizados con N_TRASPASO)
  const eventResolutionMetrics = useMemo(() => {
    let pending = 0;
    let completed = 0;
    items.forEach(item => {
      const res = getItemResolutionStatus(item, headers);
      if (res.isResolved) completed++;
      else pending++;
    });
    return {
      total: items.length,
      pending,
      completed
    };
  }, [items, headers]);

  const augmentedItems = useMemo(() => {
    return items.map(item => {
      const virtualData: Record<string, any> = {};
      const activeVCs = sheetConfig.activeVirtualColumns || [];
      VIRTUAL_COLUMNS.filter(col => activeVCs.includes(col.id)).forEach(col => {
        // Pass products and policies as allData
        virtualData[col.id] = col.calculate(item, headers, { products, policies });
      });
      return { ...item, ...virtualData };
    });
  }, [items, headers, sheetConfig.activeVirtualColumns, products, policies]);

  // Memoized unique options per column for ColumnFilterMenu
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

  const filteredItems = useMemo(() => {
    let list = augmentedItems;

    // Apply Event Category Filter in main or events view
    if (activeView === 'main') {
      list = list.filter(item => {
        const cat = getEventCategory(item, headers);
        return cat === 'VENCIMIENTO' || cat === 'VENCIMIENTO_CERCANO';
      });
    } else if (activeView === 'events') {
      if (eventFilter.length > 0) {
        list = list.filter(item => {
          const cat = getEventCategory(item, headers);
          return cat && eventFilter.includes(cat);
        });
      }
      if (eventResolutionFilter.length > 0) {
        list = list.filter(item => {
          const isResolved = getItemResolutionStatus(item, headers).isResolved;
          const status = isResolved ? 'completed' : 'pending';
          const traspasoCol = findColumnBySemantic(headers, 'n_traspaso') || 'N_TRASPASO';
          const traspasoVal = item[traspasoCol];
          return eventResolutionFilter.includes(status) || (traspasoVal && eventResolutionFilter.includes(traspasoVal));
        });
      }
    }

    // Apply PM Radar Filter when in main view
    if (activeView === 'main' && pmRadarFilter.length > 0) {
      list = list.filter(item => {
        const st = getItemStatus(item, headers);
        if (pmRadarFilter.includes('drainage') && st.code === 'DRAINAGE_PM') return true;
        if (pmRadarFilter.includes('upcoming') && st.code === 'UPCOMING') return true;
        if (pmRadarFilter.includes('retire_now') && (st.code === 'RETIRE_NOW' || st.code === 'EXPIRED')) return true;
        if (pmRadarFilter.includes('en_regla') && st.code === 'NORMAL') return true;
        return false;
      });
    }

    // Apply generic column filters
    (Object.entries(columnFilters) as [string, string[]][]).forEach(([colName, selectedVals]) => {
      if (selectedVals && selectedVals.length > 0) {
        list = list.filter(item => {
          const val = item[colName];
          const valStr = val !== undefined && val !== null && String(val).trim() !== '' ? String(val).trim() : '(Vacío)';
          return selectedVals.includes(valStr);
        });
      }
    });

    if (!deferredSearchTerm.trim() && !activeQuickChip) return list;
    const term = (deferredSearchTerm.trim() || activeQuickChip || '').toLowerCase();
    return list.filter(item => {
      return searchableHeaders.some(h => {
        const val = item[h];
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [items, deferredSearchTerm, activeQuickChip, searchableHeaders, activeView, eventFilter, eventResolutionFilter, pmRadarFilter, columnFilters, headers]);

  const groupedItems = useMemo(() => {
    if (groupByColumn === 'none') return null;
    const map = new Map<string, InventoryItem[]>();
    for (const item of filteredItems) {
      const val = String(item[groupByColumn] || '(Sin asignar)');
      if (!map.has(val)) {
        map.set(val, []);
      }
      map.get(val)!.push(item);
    }
    return Array.from(map.entries());
  }, [filteredItems, groupByColumn]);

  const paginatedItems = useMemo(() => {
    if (pageSize === 'all') return filteredItems;
    const start = (currentPage - 1) * (pageSize as number);
    return filteredItems.slice(start, start + (pageSize as number));
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredItems.length / (pageSize as number)) || 1;

  const rowVirtualizer = useVirtualizer({
    count: paginatedItems.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 64, // Approximate row height (padding 16px top/bottom + text)
    overscan: 10,
  });
  
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end 
    : 0;


  // Critical items for PM drainage report
  const drainageReportItems = useMemo(() => {
    const source = activeView === 'main' ? items : allMainItems;
    return source.filter(item => {
      const cat = getEventCategory(item, Object.keys(item));
      if (cat !== 'VENCIMIENTO') return false;
      const st = getItemStatus(item, Object.keys(item));
      return st.code === 'DRAINAGE_PM' || st.code === 'UPCOMING' || st.code === 'RETIRE_NOW';
    });
  }, [items, allMainItems, activeView]);

  const quickChips = useMemo(() => {
    if (activeView === 'products') {
      const providerCol = headers.find(h => /proveedor|marca|fabricante/i.test(h));
      const categoryCol = headers.find(h => /categor[ií]a|familia|tipo/i.test(h));
      const chips = [];
      
      if (providerCol) {
        const topProviders = Array.from(new Set(items.map(i => i[providerCol]))).filter(Boolean).slice(0, 3);
        topProviders.forEach(p => chips.push(String(p)));
      }
      if (categoryCol) {
        const topCategories = Array.from(new Set(items.map(i => i[categoryCol]))).filter(Boolean).slice(0, 2);
        topCategories.forEach(c => chips.push(String(c)));
      }
      return chips;
    }
    if (activeView === 'events') {
      const respCol = headers.find(h => /responsable|usuario|creado_por|registrado/i.test(h));
      const originCol = headers.find(h => /origen|tienda|almac[eé]n/i.test(h));
      const chips = [];
      
      if (respCol) {
        const topResp = Array.from(new Set(items.map(i => i[respCol]))).filter(Boolean).slice(0, 2);
        topResp.forEach(r => chips.push(String(r)));
      }
      if (originCol) {
        const topOrigin = Array.from(new Set(items.map(i => i[originCol]))).filter(Boolean).slice(0, 2);
        topOrigin.forEach(o => chips.push(String(o)));
      }
      return chips;
    }
    if (activeView === 'main') {
      const batchCol = headers.find(h => /lote|batch/i.test(h));
      const chips = [];
      if (batchCol) {
        // Just extract some common distinct batches if any
        const topBatches = Array.from(new Set(items.map(i => i[batchCol]))).filter(Boolean).slice(0, 3);
        topBatches.forEach(b => chips.push(`Lote: ${b}`));
      }
      return chips;
    }
    return [];
  }, [items, headers, activeView]);

  const fetchData = async (currentConfig = sheetConfig, currentView = activeView) => {
    try {
      setLoading(true);
      setError(null);
      
      const scriptUrl = localStorage.getItem('appsheet_clone_scriptUrl');
      if (!scriptUrl || !scriptUrl.trim()) {
        throw new Error('No script URL configured, loading demo mode');
      }

      const meta = await getSpreadsheetMetadata();
      setMetadata(meta);
      const allSheets = meta.sheets.map((s: any) => s.properties.title);
      
      // 1. Try Opción 2: Script Properties (PropertiesService)
      let foundRemoteConfig = false;
      try {
        const propConfig = await getScriptPropertiesConfig();
        if (propConfig && (propConfig.schema || propConfig.main)) {
          currentConfig = {
            ...currentConfig,
            ...propConfig,
            schema: { ...(currentConfig.schema || {}), ...(propConfig.schema || {}) }
          };
          setConfigStorageMode('properties');
          foundRemoteConfig = true;
        }
      } catch (e) {
        console.warn('PropertiesService config check:', e);
      }

      // 2. If not found in PropertiesService, check for technical config sheet (_CONFIG_APP or _APP_CONFIG)
      const configSheet = allSheets.find((t: string) => /^_CONFIG(_APP)?$|^_APP_CONFIG$/i.test(t.trim()));
      if (configSheet) {
        setHasCloudConfigSheet(true);
        setCloudConfigSheetName(configSheet);
        if (!foundRemoteConfig) {
          try {
            const cloudConf = await loadCloudConfig(configSheet);
            if (cloudConf && (cloudConf.schema || cloudConf.main)) {
              currentConfig = {
                ...currentConfig,
                ...cloudConf,
                schema: { ...(currentConfig.schema || {}), ...(cloudConf.schema || {}) }
              };
              setConfigStorageMode('sheet');
              foundRemoteConfig = true;
            }
          } catch (e) {
            console.warn('Error loading cloud config from sheet:', e);
          }
        }
      } else {
        setHasCloudConfigSheet(false);
        if (!foundRemoteConfig) {
          setConfigStorageMode('local');
        }
      }

      let mainSheetTitle = currentConfig.main || allSheets.find((t: string) => /vencimiento|caducidad/i.test(t)) || allSheets[0];
      let eventsSheetTitle = currentConfig.events || allSheets.find((t: string) => /^frc$|evento|incidencia|averia|merma|diferencia|transporte/i.test(t));
      let prodSheetTitle = currentConfig.products || allSheets.find((t: string) => /producto/i.test(t));
      let polSheetTitle = currentConfig.policies || allSheets.find((t: string) => /política|politica|canje/i.test(t));
      
      if (!currentConfig.main && mainSheetTitle) currentConfig.main = mainSheetTitle;
      if (!currentConfig.events && eventsSheetTitle) currentConfig.events = eventsSheetTitle;
      if (!currentConfig.products && prodSheetTitle) currentConfig.products = prodSheetTitle;
      if (!currentConfig.policies && polSheetTitle) currentConfig.policies = polSheetTitle;
      if (currentConfig !== sheetConfig) {
        setSheetConfig(currentConfig);
        localStorage.setItem('appsheet_clone_config', JSON.stringify(currentConfig));
      }
      
      let hasRelational = false;
      
      // Fetch Relational Data in Parallel
      const promises = [];
      if (prodSheetTitle) promises.push(getSheetData(prodSheetTitle).then(rows => {
        if (rows.length > 0) {
          const h = rows[0];
          setProducts(rows.slice(1).map((row: string[]) => {
            const obj: any = {};
            h.forEach((header: string, i: number) => obj[header] = row[i] || '');
            return obj;
          }));
          hasRelational = true;
        }
      }).catch(e => console.error(e)));

      if (polSheetTitle) promises.push(getSheetData(polSheetTitle).then(rows => {
        if (rows.length > 0) {
          const h = rows[0];
          setPolicies(rows.slice(1).map((row: string[]) => {
            const obj: any = {};
            h.forEach((header: string, i: number) => obj[header] = row[i] || '');
            return obj;
          }));
          hasRelational = true;
        }
      }).catch(e => console.error(e)));

      if (mainSheetTitle && currentView !== 'main') {
        promises.push(getSheetData(mainSheetTitle).then(rows => {
          if (rows.length > 0) {
            const h = rows[0];
            setAllMainItems(rows.slice(1).map((row: string[], index: number) => {
              const obj: any = { _rowIndex: index + 2 };
              h.forEach((header: string, i: number) => obj[header] = row[i] || '');
              return obj;
            }));
          }
        }).catch(e => console.error(e)));
      }
      
      await Promise.all(promises);
      setIsRelationalActive(hasRelational);

      // Determine target sheet for current view
      let targetSheetTitle = '';
      if (currentView === 'main' || currentView === 'analytics') targetSheetTitle = currentConfig.main || allSheets[0];
      else if (currentView === 'events') targetSheetTitle = currentConfig.events || eventsSheetTitle || '';
      else if (currentView === 'products') targetSheetTitle = currentConfig.products;
      else if (currentView === 'policies') targetSheetTitle = currentConfig.policies;
      else targetSheetTitle = currentView;

      const targetSheetProp = meta.sheets.find((s: any) => s.properties.title === targetSheetTitle)?.properties;
      
      if (targetSheetProp) {
        setActiveSheet(targetSheetProp);
        let rows = [];
        try {
          rows = await getSheetData(targetSheetProp.title);
          const cachePayload = { rows, timestamp: new Date().toISOString() };
          localStorage.setItem(`appsheet_clone_cache_${targetSheetProp.title}`, JSON.stringify(cachePayload));
          setLastCachedAt(cachePayload.timestamp);
          setIsOffline(false);
        } catch (netErr) {
          console.warn('Network error loading sheet data, attempting local cache fallback:', netErr);
          const cached = localStorage.getItem(`appsheet_clone_cache_${targetSheetProp.title}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            rows = parsed.rows;
            setLastCachedAt(parsed.timestamp);
            setIsOffline(true);
          } else {
            throw netErr;
          }
        }
        
        if (rows.length > 0) {
          const headerRow = rows[0];
          setHeaders(headerRow);
          const parsedItems: InventoryItem[] = rows.slice(1).map((row: string[], index: number) => {
            const item: InventoryItem = { _rowIndex: index + 2 };
            headerRow.forEach((header: string, colIndex: number) => {
              item[header] = row[colIndex] || '';
            });
            return item;
          });
          setItems(parsedItems);
          if (currentView === 'main') setAllMainItems(parsedItems);
        } else {
          setHeaders([]);
          setItems([]);
        }
      } else {
        setActiveSheet(null);
        setHeaders([]);
        setItems([]);
      }
    } catch (err: any) {
      console.warn('Network or Apps Script error, loading sample demo inventory:', err);
      // Fallback to sample data so app is fully testable out-of-the-box
      setMetadata({
        sheets: [
          { properties: { sheetId: 1, title: 'Vencimientos_Inventario', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } } },
          { properties: { sheetId: 2, title: 'FRC', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } } },
          { properties: { sheetId: 3, title: 'Catalogo_Productos', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } } },
          { properties: { sheetId: 4, title: 'Politicas_Canje', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } } }
        ]
      });

      if (currentView === 'events') {
        setActiveSheet({ sheetId: 2, title: 'FRC', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } });
        setHeaders(SAMPLE_EVENTS_HEADERS);
        setItems(SAMPLE_EVENTS_ITEMS);
      } else if (currentView === 'products') {
        setActiveSheet({ sheetId: 3, title: 'Catalogo_Productos', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } });
        setHeaders(Object.keys(SAMPLE_PRODUCTS[0] || {}));
        setItems(SAMPLE_PRODUCTS.map((p, i) => ({ _rowIndex: i + 2, ...p })));
      } else if (currentView === 'policies') {
        setActiveSheet({ sheetId: 4, title: 'Politicas_Canje', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } });
        setHeaders(Object.keys(SAMPLE_POLICIES[0] || {}));
        setItems(SAMPLE_POLICIES.map((p, i) => ({ _rowIndex: i + 2, ...p })));
      } else {
        setActiveSheet({ sheetId: 1, title: 'Vencimientos_Inventario', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } });
        setHeaders(SAMPLE_HEADERS);
        setItems(SAMPLE_ITEMS);
      }

      setAllMainItems(SAMPLE_ITEMS);
      setProducts(SAMPLE_PRODUCTS);
      setPolicies(SAMPLE_POLICIES);
      setIsRelationalActive(true);
      setError('Modo Demostración / Sin conexión: Mostrando datos de ejemplo de logística y vencimientos. Puede configurar su URL de Google Apps Script en Ajustes.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuickTraspaso = async (targetItem: InventoryItem, traspasoNumber: string) => {
    const traspasoCol = findColumnBySemantic(headers, 'n_traspaso') || 'N_TRASPASO';
    const updatedItem = { ...targetItem, [traspasoCol]: traspasoNumber };

    // Update local state immediately for instant feedback
    setItems(prev => prev.map(it => (it._rowIndex === targetItem._rowIndex ? updatedItem : it)));

    // If online and connected to Apps Script, sync changes to cloud
    if (activeSheet && updatedItem._rowIndex) {
      const rowValues = headers.map(h => updatedItem[h] || '');
      try {
        await updateRow(activeSheet.title, updatedItem._rowIndex, rowValues);
      } catch (saveErr) {
        console.warn('Network error during quick transfer save, adding to offline queue:', saveErr);
        setOfflineQueue(prev => [...prev, {
          type: 'update',
          sheetTitle: activeSheet.title,
          rowIndex: updatedItem._rowIndex,
          values: rowValues,
          timestamp: new Date().toISOString()
        }]);
        setIsOffline(true);
      }
    }
  };

  useEffect(() => {
    fetchData(sheetConfig, activeView);
    setSelectedRowIds([]);
  }, [activeView]);

  const handleSelectEventCategory = (cat: EventCategory) => {
    setSelectedEventCategory(cat);
    const eventCol = findColumnBySemantic(headers, 'tipo_evento') || headers.find(h => /^frc(_|\s)?even/i.test(h.trim()));
    if (eventCol) {
      setFormData(prev => ({
        ...prev,
        [eventCol]: EVENT_CATEGORIES[cat].rawCode || EVENT_CATEGORIES[cat].name
      }));
    }
  };

  const handleOpenModal = (item?: InventoryItem, prefillSku?: string, initialCategory?: EventCategory) => {
    setIsConfigOpen(false);
    setFormErrors({});
    if (item) {
      setEditingItem(item);
      const cat = getEventCategory(item, headers);
      setSelectedEventCategory(cat);
      const initialData: Record<string, string> = {};
      headers.forEach(h => {
        initialData[h] = item[h] || '';
      });
      setFormData(initialData);
    } else {
      setEditingItem(null);
      const cat = initialCategory || (eventFilter !== 'all' ? eventFilter : 'VENCIMIENTO');
      setSelectedEventCategory(cat);

      const initialData: Record<string, string> = {};
      
      const idVcCol = headers.find(h => /^ID_VC$/i.test(h.trim()));
      const skuCol = headers.find(h => /sku|código|codigo/i.test(h));
      const eventCol = headers.find(h => /tipo.*evento|evento|tipo.*registro|incidencia|categor[ií]a/i.test(h));
      
      headers.forEach(h => {
        initialData[h] = '';
      });
      
      if (idVcCol) {
        initialData[idVcCol] = `VC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }

      if (eventCol) {
        initialData[eventCol] = EVENT_CATEGORIES[cat].name;
      }

      if (prefillSku && skuCol) {
        initialData[skuCol] = prefillSku;
        // Autofill details from products catalog
        if (products.length > 0) {
          const prodSkuCol = Object.keys(products[0]).find(k => /sku|código|codigo/i.test(k));
          if (prodSkuCol) {
            const prod = products.find(p => String(p[prodSkuCol]).trim() === prefillSku.trim());
            if (prod) {
              headers.forEach(h => {
                if (h !== skuCol && prod[h] !== undefined && prod[h] !== '') {
                  initialData[h] = prod[h];
                }
              });
            }
          }
        }
      }
      
      setFormData(initialData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({});
    setFormErrors({});
  };

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!activeSheet) return errors;

    const currentSchema = sheetConfig.schema?.[activeSheet.title] || {};
    
    // Dynamic Zod Schema generation based on our internal types
    const zSchemaShape: Record<string, z.ZodTypeAny> = {};

    headers.forEach(header => {
      const colSchema = currentSchema[header];
      const effectiveType = colSchema?.type || (/fecha|vencimiento|retiro/i.test(header) ? 'date' : 'text');
      const isAutoCalculated = colSchema?.behavior === 'auto_id' || 
                               colSchema?.behavior === 'calc_fecha_vc' || 
                               colSchema?.behavior === 'calc_retiro' || 
                               effectiveType === 'calculated' || 
                               /^ID_VC$/i.test(header.trim());

      // If auto calculated, we don't strictly validate user input (it's read-only)
      if (isAutoCalculated) {
        zSchemaShape[header] = z.any();
        return;
      }

      // Base string schema
      let fieldSchema: z.ZodTypeAny = z.string().trim();

      // Required logic: Sku, dates, and amounts are usually required, others optional.
      const isRequired = colSchema?.isKey || /sku|código|codigo|cantidad|fecha|lote|estado/i.test(header);

      if (!isRequired) {
        fieldSchema = z.string().trim().optional().or(z.literal(''));
      } else {
        fieldSchema = z.string().trim().min(1, 'Este campo es obligatorio.');
      }

      // Type specific validation
      if (effectiveType === 'number' || /^cant|unidades|stock|dias|precio/i.test(header)) {
        fieldSchema = fieldSchema.refine((val: any) => {
          if (!isRequired && (!val || val === '')) return true;
          return !isNaN(Number(val));
        }, 'Debe ser un número válido.');
      } else if (effectiveType === 'date' || /fecha/i.test(header)) {
        fieldSchema = fieldSchema.refine((val: any) => {
          if (!isRequired && (!val || val === '')) return true;
          return !isNaN(new Date(val as string).getTime());
        }, 'Formato de fecha inválido.');
      }

      // Custom validations for Vencimiento
      if (selectedEventCategory === 'VENCIMIENTO') {
        if (/^MM$/i.test(header.trim())) {
          fieldSchema = fieldSchema.refine((val: any) => {
            if (!val && !isRequired) return true;
            const num = parseInt(val as string, 10);
            return !isNaN(num) && num >= 1 && num <= 12;
          }, 'El mes debe estar entre 1 y 12.');
        } else if (/^YYYY$/i.test(header.trim())) {
          fieldSchema = fieldSchema.refine((val: any) => {
            if (!val && !isRequired) return true;
            const num = parseInt(val as string, 10);
            return !isNaN(num) && num >= 2000 && num <= 2100;
          }, 'El año debe ser válido (ej. 2026).');
        }
      }

      zSchemaShape[header] = fieldSchema;
    });

    const formSchema = z.object(zSchemaShape).superRefine((data, ctx) => {
      // Cross-field validation: Expiration vs Withdrawal Date
      if (selectedEventCategory === 'VENCIMIENTO') {
        const fechaVcHeader = headers.find(h => /^FECHA_VC$/i.test(h.trim()) || sheetConfig.schema?.[activeSheet.title]?.[h]?.behavior === 'calc_fecha_vc');
        const withdrawalHeader = headers.find(h => /retiro/i.test(h) || sheetConfig.schema?.[activeSheet.title]?.[h]?.behavior === 'calc_retiro');
        
        if (fechaVcHeader && withdrawalHeader) {
          const vcVal = data[fechaVcHeader] as string;
          const retVal = data[withdrawalHeader] as string;
          
          if (vcVal && retVal) {
            const vcDate = new Date(vcVal as string);
            const retDate = new Date(retVal as string);
            
            if (!isNaN(vcDate.getTime()) && !isNaN(retDate.getTime()) && retDate > vcDate) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La fecha de retiro no puede ser posterior al vencimiento.',
                path: [withdrawalHeader]
              });
            }
          }
        }
      }
    });

    // Normalize formData so undefined values become empty strings for z.string().trim()
    const normalizedFormData: Record<string, any> = {};
    headers.forEach(h => {
      normalizedFormData[h] = formData[h] !== undefined ? formData[h] : '';
    });

    const parseResult = formSchema.safeParse(normalizedFormData);
    
    if (!parseResult.success) {
      parseResult.error.issues.forEach(issue => {
        const key = issue.path[0] as string;
        if (!errors[key]) {
          errors[key] = issue.message;
        }
      });
    }

    return errors;
  };
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newForm = { ...formData, [name]: value };
    
    if (formErrors[name]) {
      setFormErrors(prev => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
    
    const skuCol = headers.find(h => /sku|código|codigo/i.test(h));
    const expiryCol = headers.find(h => /vencimiento|caducidad|expiración|fecha_vc/i.test(h));
    const withdrawalCol = headers.find(h => /retiro|canje/i.test(h));
    const formPolicyCol = headers.find(h => /política|politica/i.test(h));
    
    const mmCol = headers.find(h => /^MM$/i.test(h.trim()));
    const yyyyCol = headers.find(h => /^YYYY$/i.test(h.trim()));
    const fechaVcCol = headers.find(h => /^FECHA_VC$/i.test(h.trim()));

    if (mmCol && yyyyCol && fechaVcCol && (name === mmCol || name === yyyyCol)) {
      const mStr = newForm[mmCol];
      const yStr = newForm[yyyyCol];
      if (mStr && yStr && !isNaN(Number(mStr)) && !isNaN(Number(yStr))) {
        const m = parseInt(mStr, 10);
        const y = parseInt(yStr, 10);
        if (m >= 1 && m <= 12) {
          const lastDay = new Date(y, m, 0); 
          const calcY = lastDay.getFullYear();
          const calcM = String(lastDay.getMonth() + 1).padStart(2, '0');
          const calcD = String(lastDay.getDate()).padStart(2, '0');
          newForm[fechaVcCol] = `${calcY}-${calcM}-${calcD}`;
        }
      }
    }

    if (skuCol && name === skuCol && products.length > 0) {
      const prodSkuCol = Object.keys(products[0]).find(k => /sku|código|codigo/i.test(k));
      if (prodSkuCol) {
        const product = products.find(p => String(p[prodSkuCol]).trim() === value.trim());
        if (product) {
          headers.forEach(h => {
            if (h !== skuCol && product[h] !== undefined && product[h] !== '') {
              newForm[h] = product[h];
            }
          });
        }
      }
    }

    if (withdrawalCol && expiryCol) {
      const currentExpiry = newForm[expiryCol];
      let currentPolicy = formPolicyCol ? newForm[formPolicyCol] : null;

      if (!currentPolicy && skuCol && products.length > 0) {
        const currentSku = newForm[skuCol];
        const prodSkuCol = Object.keys(products[0]).find(k => /sku|código|codigo/i.test(k));
        const prodPolicyCol = Object.keys(products[0]).find(k => /política|politica/i.test(k));
        if (prodSkuCol && prodPolicyCol) {
          const product = products.find(p => String(p[prodSkuCol]).trim() === String(currentSku).trim());
          if (product) currentPolicy = product[prodPolicyCol];
        }
      }

      if (currentExpiry && currentPolicy && policies.length > 0) {
        const polKeyCol = Object.keys(policies[0]).find(k => /política|politica|tipo|canje/i.test(k));
        const polDaysCol = Object.keys(policies[0]).find(k => /dias|días|anticipacion|tiempo/i.test(k));
        
        if (polKeyCol && polDaysCol) {
          const matchedPolicy = policies.find(p => String(p[polKeyCol]).trim() === String(currentPolicy).trim());
          if (matchedPolicy) {
            const days = parseInt(matchedPolicy[polDaysCol], 10);
            if (!isNaN(days)) {
              const expDate = parseAnyDate(currentExpiry);
              if (expDate) {
                const d = new Date(expDate.getTime());
                d.setDate(d.getDate() - days);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                newForm[withdrawalCol] = `${yyyy}-${mm}-${dd}`;
              }
            }
          }
        }
      }
    }
    
    setFormData(newForm);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSheet || headers.length === 0) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    const originalItems = [...items];
    const originalMainItems = [...allMainItems];
    
    try {
      setIsSaving(true);
      const rowValues = headers.map(h => formData[h] || '');
      
      // Optimistic update
      const newItem: InventoryItem = { _rowIndex: editingItem ? editingItem._rowIndex : (items.length ? Math.max(...items.map(i => i._rowIndex)) + 1 : 2) };
      headers.forEach((h, i) => newItem[h] = rowValues[i]);
      
      if (editingItem) {
        setItems(prev => prev.map(item => item._rowIndex === editingItem._rowIndex ? newItem : item));
        if (activeView === 'main') setAllMainItems(prev => prev.map(item => item._rowIndex === editingItem._rowIndex ? newItem : item));
      } else {
        setItems(prev => [...prev, newItem]);
        if (activeView === 'main') setAllMainItems(prev => [...prev, newItem]);
      }
      handleCloseModal();

      const nowIso = new Date().toISOString();
      try {
        if (editingItem) {
          await updateRow(activeSheet.title, editingItem._rowIndex, rowValues);
        } else {
          await appendRow(activeSheet.title, rowValues);
        }
      } catch (saveErr) {
        console.warn('Network error during save, adding to offline queue:', saveErr);
        setOfflineQueue(prev => [...prev, {
          type: editingItem ? 'update' : 'append',
          sheetTitle: activeSheet.title,
          rowIndex: editingItem ? editingItem._rowIndex : undefined,
          values: rowValues,
          timestamp: nowIso
        }]);
        setIsOffline(true);
        alert('Sin conexión con Google Sheets. Los cambios se guardaron localmente y se sincronizarán en la cola offline.');
      }
      
      await fetchData();
    } catch (err: any) {
      // Rollback
      setItems(originalItems);
      setAllMainItems(originalMainItems);
      alert(`Error guardando datos (rollback aplicado): ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!activeSheet) return;
    const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar la fila ${item._rowIndex}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    const originalItems = [...items];
    const originalMainItems = [...allMainItems];

    try {
      // Optimistic delete
      setItems(prev => prev.filter(i => i._rowIndex !== item._rowIndex));
      if (activeView === 'main') setAllMainItems(prev => prev.filter(i => i._rowIndex !== item._rowIndex));
      
      try {
        await deleteRow(activeSheet.sheetId, item._rowIndex);
      } catch (delErr) {
        console.warn('Network error during delete, adding to offline queue:', delErr);
        setOfflineQueue(prev => [...prev, {
          type: 'delete',
          sheetId: activeSheet.sheetId,
          sheetTitle: activeSheet.title,
          rowIndex: item._rowIndex,
          timestamp: new Date().toISOString()
        }]);
        setIsOffline(true);
        alert('Sin conexión. La eliminación se registró en la cola offline.');
      }
      await fetchData();
    } catch (err: any) {
      // Rollback
      setItems(originalItems);
      setAllMainItems(originalMainItems);
      alert(`Error eliminando fila (rollback aplicado): ${err.message}`);
    }
  };

  const handleApplyBulkEdit = async (values: { frc_n: string; n_traspaso: string; tipo_evento: string; frc_bod: string }) => {
    if (!activeSheet || selectedRowIds.length === 0) return;

    const findHeader = (target: string) => {
      const normTarget = target.replace(/[\s\-_]+/g, '').toLowerCase();
      for (const h of headers) {
        if (h.replace(/[\s\-_]+/g, '').toLowerCase() === normTarget) return h;
      }
      return undefined;
    };

    const colFrcN = findHeader('frc_n') || findHeader('folio') || findHeader('id_vc');
    const colTraspaso = findHeader('n_traspaso') || findHeader('traspaso');
    let colTipoEvento = findColumnBySemantic(headers, 'tipo_evento') || findHeader('tipo_de_evento') || findHeader('tipo_evento') || findHeader('tipo') || findHeader('incidencia');
    const colFrcBod = findHeader('frc_bod') || findHeader('bodega') || findHeader('frc_bodega');

    let currentHeaders = [...headers];
    if (values.tipo_evento && !colTipoEvento) {
      colTipoEvento = 'TIPO_EVENTO';
      currentHeaders.push(colTipoEvento);
      try {
        await updateRow(activeSheet.title, 1, currentHeaders);
      } catch (err) {
        console.warn('Could not auto-add TIPO_EVENTO header to sheet', err);
      }
    }

    const originalItems = [...items];

    try {
      setIsSaving(true);

      let resolvedTipoEvento = values.tipo_evento;
      if (values.tipo_evento) {
        const upper = values.tipo_evento.toUpperCase().trim();
        if (EVENT_CATEGORIES[upper as EventCategory]) {
          resolvedTipoEvento = EVENT_CATEGORIES[upper as EventCategory].name;
        } else if (upper === 'DIFERENCIAS') {
          resolvedTipoEvento = EVENT_CATEGORIES['DIFERENCIA'].name;
        } else if (upper === 'MERMAS') {
          resolvedTipoEvento = EVENT_CATEGORIES['AVERIA'].name;
        } else if (upper === 'CALIDAD') {
          resolvedTipoEvento = EVENT_CATEGORIES['DEVOLUCION'].name;
        }
      }

      const updatedItems = items.map(item => {
        if (!selectedRowIds.includes(item._rowIndex as number)) return item;
        const updated = { ...item };
        if (values.frc_n && colFrcN) updated[colFrcN] = values.frc_n;
        if (values.n_traspaso && colTraspaso) updated[colTraspaso] = values.n_traspaso;
        if (values.tipo_evento && colTipoEvento) updated[colTipoEvento] = resolvedTipoEvento;
        if (values.frc_bod && colFrcBod) updated[colFrcBod] = values.frc_bod;
        return updated;
      });

      setItems(updatedItems);

      for (const rowIndex of selectedRowIds) {
        const itemToUpdate = updatedItems.find(i => i._rowIndex === rowIndex);
        if (!itemToUpdate) continue;
        const rowValues = currentHeaders.map(h => itemToUpdate[h] || '');
        try {
          await updateRow(activeSheet.title, rowIndex, rowValues);
        } catch (err) {
          console.warn(`Error updating row ${rowIndex} in cloud, adding to offline queue`, err);
          setOfflineQueue(prev => [...prev, {
            type: 'update',
            sheetTitle: activeSheet.title,
            rowIndex,
            values: rowValues,
            timestamp: new Date().toISOString()
          }]);
          setIsOffline(true);
        }
      }

      setSelectedRowIds([]);
      await fetchData();
      alert(`¡Se actualizaron ${selectedRowIds.length} registros exitosamente con la información masiva!`);
    } catch (err: any) {
      setItems(originalItems);
      alert(`Error en actualización masiva: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !metadata) {
    return <SkeletonLoader />;
  }

  const mappedSheets = [sheetConfig.main, sheetConfig.events, sheetConfig.products, sheetConfig.policies].filter(Boolean);
  const otherSheets = metadata?.sheets
    .map((s: any) => s.properties.title)
    .filter((t: string) => !mappedSheets.includes(t) && !/^_/i.test(t.trim())) || [];

  return (
    <>
    <div className="flex h-full overflow-hidden bg-[#F8FAFC] dark:bg-slate-950 print:hidden">
      
      {/* DESKTOP SIDEBAR NAVIGATION */}
      <div className="hidden lg:flex">
        <Sidebar
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          activeView={activeView}
          setActiveView={setActiveView}
          setSelectedProduct={setSelectedProduct}
          otherSheets={otherSheets}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
      </div>

      {/* MOBILE SIDEBAR DRAWER */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-100 text-base">Menú de Navegación</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar
                isSidebarCollapsed={false}
                setIsSidebarCollapsed={() => {}}
                activeView={activeView}
                setActiveView={(v) => { setActiveView(v); setSelectedProduct(null); setIsMobileMenuOpen(false); }}
                setSelectedProduct={setSelectedProduct}
                otherSheets={otherSheets}
                onOpenConfig={() => { setIsConfigOpen(true); setIsMobileMenuOpen(false); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* MACRO SEARCH NAV (Always top, sticky) */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 sticky top-0 shrink-0 px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors shrink-0"
            title="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search is the hero */}
          <div className="flex-1 flex justify-center">
            {(activeView !== 'schema' || searchableHeaders.length > 0) ? (
              <div className="relative w-full max-w-3xl flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={activeView === 'analytics' ? "Explorar y filtrar gráficos por lote, descripción, proveedor..." : `Buscar en todo el inventario (${searchableHeaders.length} columnas)...`}
                    className="w-full pl-11 pr-10 py-3 bg-slate-200/70 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl text-base font-medium text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                      title="Limpiar búsqueda"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-2xl font-bold transition-colors whitespace-nowrap border border-red-100 dark:border-red-900/50"
                    title="Limpiar todos los filtros"
                  >
                    <FilterX className="w-4 h-4" />
                    <span className="hidden sm:inline">Limpiar filtros</span>
                  </button>
                )}
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="p-3 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-2xl transition-all shrink-0 flex items-center gap-2 border border-blue-200/60 dark:border-blue-800/60 shadow-sm"
                  title="Escanear código de barras o QR con la cámara"
                >
                  <Scan className="w-5 h-5" />
                  <span className="text-xs font-bold hidden sm:inline">Escanear</span>
                </button>
              </div>
            ) : (
              <div className="w-full max-w-3xl py-3" /> /* Spacer */
            )}
          </div>

          {/* Global Utils (Refresh, Export) */}
          <div className="flex items-center gap-2 shrink-0">
            {activeView !== 'schema' && (
              <>
                <button
                  onClick={() => setIsTicketConfigOpen(true)}
                  className="text-sm bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl font-bold shadow-sm transition-all hidden md:block"
                  title="Configurar opciones de impresión de Ticket"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                </button>
                <button
                  onClick={() => handlePrintTicket(filteredItems)}
                  className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 px-3 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 hidden md:flex"
                  title="Imprimir ticket térmico con los registros mostrados"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Ticket</span>
                </button>
                <button
                  onClick={() => exportToExcel(`${activeView}_${new Date().toISOString().split('T')[0]}`, headers, filteredItems)}
                  className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 px-3 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 hidden md:flex"
                  title="Exportar la vista actual a Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => setIsGmailModalOpen(true)}
                  className="text-sm bg-red-600 hover:bg-red-700 text-white border border-red-700 px-3 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 hidden md:flex"
                  title="Generar borrador de correo en Gmail con los productos mostrados o seleccionados"
                >
                  <Mail className="w-4 h-4" />
                  <span>Borrador Gmail</span>
                </button>
              </>
            )}
            {/* Status & Sync Indicator */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
              <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-slate-700 dark:text-slate-200">{isOffline ? 'Modo Offline (Caché)' : 'Conectado'}</span>
              {lastCachedAt && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden sm:inline">({new Date(lastCachedAt).toLocaleTimeString()})</span>
              )}
              {offlineQueue.length > 0 && (
                <button 
                  onClick={handleSyncOfflineQueue}
                  className="ml-2 bg-blue-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors"
                >
                  Sincronizar ({offlineQueue.length})
                </button>
              )}
            </div>
            <button onClick={() => fetchData()} className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200 transition-colors" title="Refrescar datos">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* CONTEXTUAL PAGE HEADER */}
        <div className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 px-8 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {activeView === 'main' ? 'Radar de Vencimientos & Drenaje' :
               activeView === 'events' ? 'Registro de Incidencias & FRC' : 
               activeView === 'products' ? 'Catálogo de Productos' : 
               activeView === 'policies' ? 'Políticas de Canje' : 
               activeView === 'schema' ? 'Configuración de Datos & Relaciones' :
               activeView === 'analytics' ? 'Analítica & Dashboard' :
               activeView}
              
              {isRelationalActive && activeView === 'main' && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Modelo Relacional Activo
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {activeView === 'main' ? 'Monitoreo de lotes críticos, fechas de retiro comercial y solicitud de precio para PM.' :
               activeView === 'events' ? 'Deterioros de transporte, diferencias de pedido, averías de almacén y devoluciones.' :
               activeView === 'products' ? 'Maestro de SKUs con relaciones directas hacia vencimientos e incidencias.' :
               activeView === 'policies' ? 'Reglas de tiempo de anticipación para retiro preventivo de productos.' :
               activeView === 'schema' ? 'Estructura de columnas, claves ID y sincronización de metadatos.' :
               activeView === 'analytics' ? 'Gráficos, tendencias de incidencias y proyecciones de vencimiento.' :
               'Gestión de datos tabulares'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeView === 'events' && (
              <button
                onClick={() => setIsBulkImportOpen(true)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Importación Masiva FRC</span>
              </button>
            )}
            
            {activeView === 'schema' && (
              <button
                onClick={() => setIsScriptModalOpen(true)}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Conector Apps Script</span>
              </button>
            )}
            
            {activeView === 'main' && (
              <button
                onClick={() => setIsPmReportOpen(true)}
                className="text-xs bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800 px-3.5 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5"
                title="Generar resumen de productos críticos para enviar a Product Manager"
              >
                <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>Reporte PM ({drainageReportItems.length})</span>
              </button>
            )}

            {activeView !== 'schema' && activeView !== 'analytics' && (
              <button
                onClick={() => setAreFiltersVisible(!areFiltersVisible)}
                className={`text-xs border px-3.5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-sm ${
                  areFiltersVisible 
                    ? 'border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/40' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                title={areFiltersVisible ? "Ocultar paneles de filtros y radar" : "Mostrar paneles de filtros y radar"}
              >
                <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">{areFiltersVisible ? 'Ocultar Filtros' : 'Mostrar Filtros'}</span>
              </button>
            )}

            {activeView !== 'schema' && activeView !== 'analytics' && (
              <div className="hidden xl:flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
                <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-2 shrink-0" />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">Agrupar por:</span>
                <select
                  value={groupByColumn}
                  onChange={(e) => setGroupByColumn(e.target.value)}
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent border-none focus:outline-none cursor-pointer"
                  title="Agrupar registros por columna (estilo AppSheet)"
                >
                  <option value="none">Sin agrupación</option>
                  {visibleHeaders.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            )}

            {activeView !== 'schema' && activeView !== 'analytics' && (
              <button
                onClick={() => setIsColumnManagerOpen(true)}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Columns className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Columnas</span>
              </button>
            )}
            
            {hasCustomColWidths && activeView !== 'schema' && activeView !== 'analytics' && (
              <button
                onClick={handleResetColWidths}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-1"
                title="Restablecer ancho original de todas las columnas de esta tabla"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Ajuste Columnas</span>
              </button>
            )}

            {activeView !== 'schema' && activeView !== 'analytics' && (
              <button 
                disabled={!activeSheet || isModalOpen} 
                onClick={() => handleOpenModal()} 
                className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-blue-200 dark:shadow-none flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                <Plus className="w-4 h-4"/>
                <span>
                  {activeView === 'main' ? 'Nuevo Vencimiento' :
                   activeView === 'events' ? 'Nueva Incidencia (FRC)' :
                   activeView === 'products' ? 'Nuevo Producto' :
                   activeView === 'policies' ? 'Nueva Política' :
                   'Nuevo Registro'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* FILTERS & RADAR PANELS (Collapsible) */}
        {areFiltersVisible && (
          <>
            {/* QUICK CHIPS (Píldoras Contextuales) */}
            {quickChips.length > 0 && activeView !== 'schema' && activeView !== 'analytics' && (
          <div className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 px-8 py-2.5 shrink-0 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-2 shrink-0">Filtros Rápidos:</span>
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => setActiveQuickChip(activeQuickChip === chip ? null : chip)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                  activeQuickChip === chip
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {chip}
              </button>
            ))}
            {activeQuickChip && (
              <button
                onClick={() => setActiveQuickChip(null)}
                className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1.5 rounded-full transition-colors shrink-0 underline"
              >
                Limpiar filtro
              </button>
            )}
          </div>
        )}

        {/* INCIDENCIAS & FRC STRIP (When activeView === 'events') */}
        {activeView === 'events' && activeSheet && (
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-5 shrink-0 flex flex-col gap-4 shadow-xs">
            
            <EventResolutionCards 
              eventResolutionFilter={eventResolutionFilter} 
              onFilterClick={(val, isMulti) => setEventResolutionFilter(prev => handleFilterToggle(prev, val, isMulti))}
              metrics={eventResolutionMetrics} 
            />

            {/* Categorías FRC Secundarias */}
            <EventFilterChips 
              totalItems={items.length} 
              eventFilter={eventFilter} 
              onFilterClick={(val, isMulti) => setEventFilter(prev => handleFilterToggle(prev, val, isMulti))}
              metrics={eventMetrics} 
            />
          </div>
        )}

        {/* RADAR COMERCIAL (Only in main view, exclusively for Vencimientos) */}
        {activeView === 'main' && activeSheet && (
          <PmRadarCards 
            pmRadarFilter={pmRadarFilter} 
            onFilterClick={(val, isMulti) => setPmRadarFilter(prev => handleFilterToggle(prev, val, isMulti))}
            metrics={pmMetrics} 
          />
        )}
          </>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-100">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div className="ml-3 text-sm font-medium text-red-700">{error}</div>
              </div>
            </div>
          )}

          {activeView === 'schema' ? (
            <SchemaEditorView
              configStorageMode={configStorageMode}
              hasCloudConfigSheet={hasCloudConfigSheet}
              cloudConfigSheetName={cloudConfigSheetName}
              syncSuccessMessage={syncSuccessMessage}
              isSyncingCloud={isSyncingCloud}
              metadata={metadata}
              activeSheet={activeSheet}
              setActiveSheet={setActiveSheet}
              headers={headers}
              setHeaders={setHeaders}
              isSchemaLoading={isSchemaLoading}
              setIsSchemaLoading={setIsSchemaLoading}
              sheetConfig={sheetConfig}
              saveConfig={saveConfig}
              setIsScriptModalOpen={setIsScriptModalOpen}
              handlePushPropertiesConfig={handlePushPropertiesConfig}
              handlePushCloudConfig={handlePushCloudConfig}
              activeView={activeView}
            />
          ) : activeView === 'analytics' ? (
            <AnalyticsDashboard items={filteredItems} headers={headers} />
          ) : !activeSheet && !loading ? (
            <div className="h-full w-full flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50 dark:bg-slate-900/60">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Módulo sin asignar</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Aún no has seleccionado qué pestaña de tu Google Sheet cumplirá esta función.</p>
                <button onClick={() => setIsConfigOpen(true)} className="mt-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                  Abrir Configuración
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-full">
              <div className="flex-1 overflow-auto relative" ref={tableContainerRef}>
                <table className="text-left border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                  <thead className="bg-slate-100 dark:bg-slate-700/90 sticky top-0 border-b border-slate-200 dark:border-slate-600/80 text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider select-none z-10 shadow-sm">
                    <tr>
                      {/* Selection Header */}
                      <th className="p-4 text-center bg-slate-100 dark:bg-slate-700/90 border-b border-slate-200 dark:border-slate-600/80" style={{ width: '48px', minWidth: '48px' }}>
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 focus:ring-blue-500 cursor-pointer"
                            checked={filteredItems.length > 0 && selectedRowIds.length === filteredItems.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRowIds(filteredItems.map(i => i._rowIndex as number));
                              } else {
                                setSelectedRowIds([]);
                              }
                            }}
                            title="Seleccionar todos"
                          />
                        </div>
                      </th>
                      {/* Fixed Row Index Header */}
                      <th 
                        style={{ width: `${getColWidth('_row', '#')}px`, minWidth: '50px' }} 
                        className="p-4 text-center text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/90 border-b border-slate-200 dark:border-slate-600/80 relative group font-bold"
                      >
                        <span>#</span>
                        <div
                          onMouseDown={(e) => handleStartResize('_row', getColWidth('_row', '#'), e)}
                          onDoubleClick={() => handleAutoFitColumn('_row', '#')}
                          title="Arrastra para cambiar ancho (Doble clic para autoajustar)"
                          className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/80 transition-colors z-20 flex items-center justify-center ${
                            resizingCol?.colId === '_row' ? 'bg-blue-600 w-2.5' : ''
                          }`}
                        >
                          <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-500 group-hover:bg-blue-500"></div>
                        </div>
                      </th>

                      {/* Expiration Status Header (Main view only) */}
                      {activeView === 'main' && (
                        <th 
                          style={{ width: `${getColWidth('_status', 'Estado / Radar PM')}px`, minWidth: '130px' }} 
                          className="p-3 bg-slate-100 dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600/80 relative group font-bold"
                        >
                          <div className="flex items-center justify-between gap-1 w-full min-w-0 pr-1">
                            <span className="truncate pr-1">Estado / Radar PM</span>
                            <ColumnFilterMenu
                              title="Estado Radar PM"
                              options={[
                                { label: 'En Regla', value: 'en_regla', badgeClass: 'text-emerald-600 dark:text-emerald-400' },
                                { label: 'Drenaje', value: 'drainage', badgeClass: 'text-amber-600 dark:text-amber-400' },
                                { label: 'Próximo a Retiro', value: 'upcoming', badgeClass: 'text-rose-600 dark:text-rose-400' },
                                { label: 'Retirar YA', value: 'retire_now', badgeClass: 'text-red-600 dark:text-red-400' }
                              ]}
                              selectedValues={pmRadarFilter}
                              onToggle={(val, isMulti) => setPmRadarFilter(prev => handleFilterToggle(prev, val, isMulti))}
                              onClear={() => setPmRadarFilter([])}
                            />
                          </div>
                          <div
                            onMouseDown={(e) => handleStartResize('_status', getColWidth('_status', 'Estado / Radar PM'), e)}
                            onDoubleClick={() => handleAutoFitColumn('_status', 'Estado / Radar PM')}
                            title="Arrastra para cambiar ancho (Doble clic para autoajustar)"
                            className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/80 transition-colors z-20 flex items-center justify-center ${
                              resizingCol?.colId === '_status' ? 'bg-blue-600 w-2.5' : ''
                            }`}
                          >
                            <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-500 group-hover:bg-blue-500"></div>
                          </div>
                        </th>
                      )}

                      {/* Resolution Status Header (Events view only) */}
                      {activeView === 'events' && (
                        <th 
                          style={{ width: `${getColWidth('_res_status', 'Estado Gestión')}px`, minWidth: '125px' }} 
                          className="p-4 bg-slate-100 dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600/80 relative group font-bold"
                        >
                          <div className="truncate pr-2">Estado Gestión</div>
                          <div
                            onMouseDown={(e) => handleStartResize('_res_status', getColWidth('_res_status', 'Estado Gestión'), e)}
                            onDoubleClick={() => handleAutoFitColumn('_res_status', 'Estado Gestión')}
                            title="Arrastra para cambiar ancho (Doble clic para autoajustar)"
                            className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/80 transition-colors z-20 flex items-center justify-center ${
                              resizingCol?.colId === '_res_status' ? 'bg-blue-600 w-2.5' : ''
                            }`}
                          >
                            <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-500 group-hover:bg-blue-500"></div>
                          </div>
                        </th>
                      )}

                      {/* Visible Column Headers */}
                      {visibleHeaders.map((header, idx) => {
                        const colSchema = sheetConfig.schema?.[activeSheet?.title || '']?.[header];
                        const width = getColWidth(header, header, colSchema?.type);
                        const isResizingThis = resizingCol?.colId === header;
                        const isDraggingThis = draggedCol === header;
                        const isDropTarget = dragOverCol === header && draggedCol !== header;
                        
                        const isEventCol = /^frc(_|\s)?even/i.test(header.trim()) || findColumnBySemantic(headers, 'tipo_evento') === header;
                        const isTraspasoCol = /traspaso/i.test(header) || findColumnBySemantic(headers, 'n_traspaso') === header;

                        const alignRight = idx > visibleHeaders.length - 3;

                        return (
                          <th 
                            key={header} 
                            style={{ width: `${width}px`, minWidth: '85px' }}
                            className={`p-3 bg-slate-100 dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600/80 relative group transition-all cursor-grab active:cursor-grabbing hover:bg-slate-200/90 dark:hover:bg-slate-600/90 dark:hover:text-white select-none ${
                              isDraggingThis ? 'opacity-40 scale-[0.98]' : ''
                            } ${
                              isDropTarget ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/50 dark:bg-blue-950/50 shadow-inner' : ''
                            }`}
                            draggable={true}
                            onDragStart={(e) => {
                              setDraggedCol(header);
                              e.dataTransfer.setData('text/plain', header);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (dragOverCol !== header) {
                                setDragOverCol(header);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverCol === header) {
                                setDragOverCol(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const droppedHeader = e.dataTransfer.getData('text/plain');
                              setDraggedCol(null);
                              setDragOverCol(null);
                              if (droppedHeader) {
                                handleColumnDrop(header, droppedHeader);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggedCol(null);
                              setDragOverCol(null);
                            }}
                            title="Mantén presionado y arrastra para reordenar columna"
                          >
                            <div className="flex items-center justify-between gap-1 w-full min-w-0 pr-1">
                              <div className="flex items-center gap-1 min-w-0 truncate">
                                <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 group-hover:text-blue-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="truncate font-bold tracking-tight">{header}</span>
                                {colSchema?.isKey && (
                                  <span className="text-[9px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-1 py-0.2 rounded font-mono font-bold shrink-0">
                                    ID
                                  </span>
                                )}
                                {colSchema?.type === 'ref' && (
                                  <span className="text-[9px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-1 py-0.2 rounded font-mono shrink-0">
                                    REF
                                  </span>
                                )}
                              </div>

                              {isEventCol ? (
                                <ColumnFilterMenu
                                  title="Incidencias"
                                  options={(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map(cat => ({
                                    label: EVENT_CATEGORIES[cat].name,
                                    value: cat,
                                    badgeClass: EVENT_CATEGORIES[cat].badgeText
                                  }))}
                                  selectedValues={eventFilter}
                                  onToggle={(val, isMulti) => setEventFilter(prev => handleFilterToggle(prev, val, isMulti))}
                                  onClear={() => setEventFilter([])}
                                  alignRight={alignRight}
                                />
                              ) : isTraspasoCol ? (
                                <ColumnFilterMenu
                                  title="Traspaso / Estado"
                                  options={[
                                    { label: '--- Estado ---', value: 'header_status', disabled: true },
                                    { label: 'Pendientes', value: 'pending', badgeClass: 'text-amber-600 dark:text-amber-400' },
                                    { label: 'Realizados', value: 'completed', badgeClass: 'text-emerald-600 dark:text-emerald-400' },
                                    { label: '--- Documentos ---', value: 'header_docs', disabled: true },
                                    ...(columnOptionsMap[header] || [])
                                  ]}
                                  selectedValues={eventResolutionFilter}
                                  onToggle={(val, isMulti) => setEventResolutionFilter(prev => handleFilterToggle(prev, val, isMulti))}
                                  onClear={() => setEventResolutionFilter([])}
                                  alignRight={alignRight}
                                />
                              ) : (
                                <ColumnFilterMenu
                                  title={header}
                                  options={columnOptionsMap[header] || []}
                                  selectedValues={columnFilters[header] || []}
                                  onToggle={(val, isMulti) => setColumnFilters(prev => ({
                                    ...prev,
                                    [header]: handleFilterToggle(prev[header] || [], val, isMulti)
                                  }))}
                                  onClear={() => setColumnFilters(prev => ({ ...prev, [header]: [] }))}
                                  alignRight={alignRight}
                                />
                              )}
                            </div>

                            {/* Resizer Handle */}
                            <div
                              onMouseDown={(e) => handleStartResize(header, width, e)}
                              onDoubleClick={() => handleAutoFitColumn(header, header)}
                              title="Arrastra para cambiar ancho (Doble clic para autoajustar)"
                              className={`absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-blue-400/80 transition-colors z-20 flex items-center justify-center ${
                                isResizingThis ? 'bg-blue-600 w-3' : ''
                              }`}
                            >
                              <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-500 group-hover:bg-blue-500"></div>
                            </div>
                          </th>
                        );
                      })}
                      
                      {/* Fixed Actions Column Header */}
                      <th className="p-4 text-right bg-slate-100 dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600/80 sticky right-0 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.03)] w-24 min-w-[96px] font-bold">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-200">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={visibleHeaders.length + (activeView === 'main' || activeView === 'events' ? 4 : 3)} className="p-8 text-center text-slate-400 dark:text-slate-500">
                          {searchTerm 
                            ? 'No se encontraron resultados que coincidan con la búsqueda.' 
                            : 'No hay datos en esta hoja.'}
                        </td>
                      </tr>
                    ) : (<>
                      {paddingTop > 0 && (
                        <tr><td style={{ height: `${paddingTop}px` }} colSpan={visibleHeaders.length + (activeView === 'main' || activeView === 'events' ? 3 : 2)} /></tr>
                      )}
                      {virtualRows.map((virtualRow) => {
                        const item = paginatedItems[virtualRow.index];
                        const idx = virtualRow.index;

                        const eventCategory = getEventCategory(item, headers);
                        const status = getItemStatus(item, headers);
                        const isEventView = activeView === 'events';
                        const eventResStatus = isEventView ? getItemResolutionStatus(item, headers) : null;
                        const isSelected = selectedRowIds.includes(item._rowIndex as number);

                        let rowBgClass = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60';
                        if (isSelected) {
                          rowBgClass = 'bg-blue-50/50 dark:bg-blue-950/40 hover:bg-blue-50 dark:hover:bg-blue-950/60';
                        } else if (isEventView) {
                          rowBgClass = eventResStatus?.isResolved
                            ? 'bg-emerald-50/25 dark:bg-emerald-950/20 border-l-4 border-l-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/35'
                            : 'bg-amber-50/30 dark:bg-amber-950/25 border-l-4 border-l-amber-500 hover:bg-amber-50/60 dark:hover:bg-amber-950/40';
                        }

                        return (
                          <tr 
                            key={idx} 
                            data-index={virtualRow.index} 
                            ref={rowVirtualizer.measureElement} 
                            onClick={() => setSelectedProduct(item)}
                            className={`transition-colors group cursor-pointer ${rowBgClass}`}
                            title="Haz clic para ver detalles del registro"
                          >
                            {/* Selection Cell */}
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 focus:ring-blue-500 cursor-pointer"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedRowIds(prev => [...prev, item._rowIndex as number]);
                                    } else {
                                      setSelectedRowIds(prev => prev.filter(id => id !== item._rowIndex));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </td>
                            {/* Row Index */}
                            <td 
                              style={{ width: `${getColWidth('_row', '#')}px` }}
                              className="p-4 text-center font-mono text-xs text-slate-400 dark:text-slate-500 truncate"
                            >
                              {item._rowIndex}
                            </td>

                            {/* Expiration Status Badge (Main view) */}
                            {activeView === 'main' && (
                              <td 
                                style={{ width: `${getColWidth('_status', 'Estado / Radar PM')}px` }}
                                className="p-4 truncate"
                              >
                                {eventCategory === 'VENCIMIENTO' || eventCategory === 'VENCIMIENTO_CERCANO' ? (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const code = status.code;
                                      const targetFilter = 
                                        (code === 'EXPIRED' || code === 'RETIRE_NOW') ? 'retire_now' :
                                        (code === 'UPCOMING') ? 'upcoming' :
                                        (code === 'DRAINAGE_PM') ? 'drainage' : 'en_regla';
                                      setPmRadarFilter(prev => handleFilterToggle(prev, targetFilter, e.ctrlKey || e.metaKey));
                                    }}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border truncate cursor-pointer hover:opacity-80 transition-opacity ${status.color}`}
                                    title="Clic normal: Solo este estado. Ctrl+Clic: Sumar estado."
                                  >
                                    <span className="shrink-0">{status.icon}</span>
                                    <span className="truncate">{status.label}</span>
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">Incidencia FRC</span>
                                )}
                              </td>
                            )}

                            {/* Incident Resolution Status Badge (Events view) */}
                            {activeView === 'events' && (
                              <td 
                                style={{ width: `${getColWidth('_res_status', 'Estado Gestión')}px` }}
                                className="p-4 truncate"
                              >
                                {eventResStatus?.isResolved ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEventResolutionFilter(prev => handleFilterToggle(prev, 'completed', e.ctrlKey || e.metaKey)); }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/80 shadow-2xs cursor-pointer hover:opacity-80 transition-opacity"
                                    title="Clic normal: Solo realizados. Ctrl+Clic: Sumar."
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>Realizado</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEventResolutionFilter(prev => handleFilterToggle(prev, 'pending', e.ctrlKey || e.metaKey)); }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 shadow-2xs cursor-pointer hover:opacity-80 transition-opacity"
                                    title="Clic normal: Solo pendientes. Ctrl+Clic: Sumar."
                                  >
                                    <Clock3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                                    <span>Pendiente</span>
                                  </button>
                                )}
                              </td>
                            )}

                            {/* Cell Values */}
                            {visibleHeaders.map((header) => {
                              const val = item[header];
                              const isSku = /sku|código|codigo/i.test(header);
                              const isEventCol = /^frc(_|\s)?even/i.test(header.trim()) || findColumnBySemantic(headers, 'tipo_evento') === header;
                              const isTraspasoCol = /traspaso/i.test(header) || findColumnBySemantic(headers, 'n_traspaso') === header;
                              const eventCat = isEventCol && val ? getCategoryFromEventValue(val) : null;
                              const isProductsView = activeView === 'products';
                              const colWidth = getColWidth(header, header);

                              return (
                                <td 
                                  key={header} 
                                  style={{ width: `${colWidth}px`, maxWidth: `${colWidth}px` }}
                                  className="p-4 truncate text-slate-800 dark:text-slate-200"
                                >
                                  {isProductsView && isSku ? (
                                    <button 
                                      onClick={() => setSelectedProduct(item)}
                                      className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-center gap-1 truncate text-left"
                                      title="Ver detalle del producto y registros relacionados"
                                    >
                                      <span className="truncate">{String(val || '')}</span>
                                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-1 py-0.2 rounded font-mono shrink-0">
                                        DETALLE
                                      </span>
                                    </button>
                                  ) : isSku && val ? (
                                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-100 truncate block">
                                      {String(val)}
                                    </span>
                                  ) : eventCat ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEventFilter(prev => handleFilterToggle(prev, eventCat, e.ctrlKey || e.metaKey)); }}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${EVENT_CATEGORIES[eventCat].badgeBg} ${EVENT_CATEGORIES[eventCat].badgeText} ${EVENT_CATEGORIES[eventCat].badgeBorder} truncate cursor-pointer hover:opacity-80 transition-opacity`}
                                      title="Clic normal: Solo este tipo. Ctrl+Clic: Sumar."
                                    >
                                      {renderEventIcon(eventCat, 'w-3.5 h-3.5 shrink-0')}
                                      <span className="truncate">{String(val)}</span>
                                    </button>
                                  ) : isEventView && isTraspasoCol ? (
                                    val !== undefined && val !== null && String(val).trim() !== '' ? (
                                      <div className="flex items-center gap-1.5 group/traspaso">
                                        <span className="font-mono font-bold text-xs bg-emerald-100/90 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/80 px-2 py-0.5 rounded-md truncate">
                                          {String(val)}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setQuickTraspasoItem(item);
                                            setIsQuickTraspasoOpen(true);
                                          }}
                                          className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 opacity-0 group-hover/traspaso:opacity-100 transition-opacity rounded cursor-pointer shrink-0"
                                          title="Modificar N° Traspaso"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setQuickTraspasoItem(item);
                                          setIsQuickTraspasoOpen(true);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border border-dashed border-amber-400 dark:border-amber-600/90 bg-amber-50/90 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all cursor-pointer group shrink-0"
                                        title="Anotar número de traspaso de su sistema informático"
                                      >
                                        <Plus className="w-3 h-3 group-hover:scale-125 transition-transform text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span>Anotar Traspaso</span>
                                      </button>
                                    )
                                  ) : (
                                    <span className="truncate block">
                                      {val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '-'}
                                    </span>
                                  )}
                                </td>
                              );
                            })}


                            {/* Row Actions */}
                            <td className="p-4 text-right sticky right-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.03)] w-20 min-w-[80px]" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => handleDelete(item)} 
                                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Eliminar fila"
                                >
                                  <Trash2 className="w-4 h-4"/>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {paddingBottom > 0 && (
                        <tr><td style={{ height: `${paddingBottom}px` }} colSpan={visibleHeaders.length + (activeView === 'main' || activeView === 'events' ? 3 : 2)} /></tr>
                      )}
                    </>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Footer summary bar */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex flex-col sm:flex-row justify-between items-center gap-2">
                <span>
                  Mostrando <strong className="text-slate-800 dark:text-slate-100">{filteredItems.length}</strong> de <strong className="text-slate-800 dark:text-slate-100">{items.length}</strong> registros
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tip: Arrastra las líneas entre columnas para cambiar su tamaño, o haz <strong>doble clic</strong> para auto-ajustar.
                </span>
              </div>
            </div>
          )}

          {/* FLOATING ACTION BAR (BULK ACTIONS) */}
          {selectedRowIds.length > 0 && activeView !== 'schema' && activeView !== 'analytics' && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 fade-in duration-300 border border-slate-700">
              <div className="flex items-center gap-2 border-r border-slate-600 pr-4">
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-inner">{selectedRowIds.length}</span>
                <span className="text-sm font-medium whitespace-nowrap">seleccionados</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const selectedItems = filteredItems.filter(i => selectedRowIds.includes(i._rowIndex as number));
                    handlePrintTicket(selectedItems);
                  }}
                  className="text-xs hover:bg-slate-700 px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-400" /> Imprimir Ticket
                </button>
                
                <button 
                  onClick={() => setIsGmailModalOpen(true)}
                  className="text-xs hover:bg-slate-700 px-3 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 bg-red-600/40 text-red-200 border border-red-500/40 shadow-sm"
                >
                  <Mail className="w-3.5 h-3.5 text-red-400" /> Borrador Gmail
                </button>
                
                <button 
                  onClick={() => {
                    const selectedItems = filteredItems.filter(i => selectedRowIds.includes(i._rowIndex as number));
                    exportToExcel(`Seleccion_${new Date().toISOString().split('T')[0]}`, headers, selectedItems);
                  }}
                  className="text-xs hover:bg-slate-700 px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" /> Exportar a Excel
                </button>
                
                {activeView === 'main' && (
                  <button 
                    onClick={() => { 
                      setIsPmReportOpen(true); 
                      // Note: Optionally we could pass selected items directly to PM Report here
                    }}
                    className="text-xs hover:bg-slate-700 px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Flame className="w-3.5 h-3.5 text-orange-400" /> Acción PM
                  </button>
                )}

                {activeView === 'events' && (
                  <button 
                    onClick={() => setIsBulkEditOpen(true)}
                    className="text-xs hover:bg-slate-700 px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 bg-blue-600/40 text-blue-200 border border-blue-500/40"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" /> Edición Masiva FRC
                  </button>
                )}
                
                <button 
                  onClick={() => { alert('Eliminación en masa requiere conexión con la API de Google Sheets para optimización de cuotas.'); }}
                  className="text-xs hover:bg-slate-700 px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Eliminar
                </button>
                
                <button 
                  onClick={() => setSelectedRowIds([])}
                  className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-700 ml-2 transition-colors flex items-center justify-center shrink-0"
                  title="Deseleccionar todo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1. MASTER-DETAIL PRODUCT DRAWER */}
      <ItemDetailDrawer
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onEdit={(prod) => {
          setSelectedProduct(null);
          handleOpenModal(prod);
        }}
        onNewEventForProduct={(sku, category) => {
          handleOpenModal(undefined, sku, category);
        }}
        allMainItems={allMainItems}
        policies={policies}
      />

      {/* 2. PM DRAINAGE REPORT MODAL */}
      <PmReportModal
        isOpen={isPmReportOpen}
        onClose={() => setIsPmReportOpen(false)}
        drainageReportItems={drainageReportItems}
      />

      {/* 3. GOOGLE APPS SCRIPT CODE MODAL */}
      <ScriptCodeModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
      />

      {/* 4. MAIN FORM MODAL */}
      <ItemFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingItem={editingItem}
        activeSheet={activeSheet}
        activeView={activeView}
        headers={headers}
        formData={formData}
        formErrors={formErrors}
        selectedEventCategory={selectedEventCategory}
        onSelectEventCategory={handleSelectEventCategory}
        onChange={handleFormChange}
        onSave={handleSave}
        isSaving={isSaving}
        sheetConfig={sheetConfig}
        products={products}
      />

      {/* 5. GLOBAL CONFIG MODAL */}
      <GlobalConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        sheetConfig={sheetConfig}
        setSheetConfig={setSheetConfig}
        saveConfig={saveConfig}
        metadata={metadata}
        fetchData={fetchData}
        activeView={activeView}
      />

      {/* BARCODE SCANNER MODAL */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(code) => setSearchTerm(code)}
      />

      {/* BULK EDIT MODAL */}
      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        selectedCount={selectedRowIds.length}
        onApply={handleApplyBulkEdit}
      />

      {/* GMAIL DRAFT MODAL */}
      <GmailDraftModal
        isOpen={isGmailModalOpen}
        onClose={() => setIsGmailModalOpen(false)}
        selectedItems={selectedRowIds.length > 0 ? filteredItems.filter(i => selectedRowIds.includes(i._rowIndex as number)) : filteredItems}
        headers={headers}
        customAliases={sheetConfig.customAliases}
        activeViewTitle={
          activeView === 'main' ? 'Vencimientos y Drenaje' :
          activeView === 'events' ? 'Incidencias FRC' :
          activeView === 'products' ? 'Productos' : 'Inventario'
        }
      />

      {/* 6. COLUMN MANAGER MODAL */}
      {isColumnManagerOpen && activeSheet && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Gestionar Columnas</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Oculta o reordena las columnas para esta vista.</p>
              </div>
              <button onClick={() => setIsColumnManagerOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {(() => {
                const viewOrder = columnOrders[activeView] || headers;
                // Merge any headers that might be missing from viewOrder
                const displayOrder = [...new Set([...viewOrder, ...headers])].filter(h => headers.includes(h));
                const viewHidden = hiddenColumns[activeView] || [];
                
                return displayOrder.map((header, index) => {
                  const isHidden = viewHidden.includes(header);
                  
                  const moveUp = () => {
                    if (index === 0) return;
                    const newOrder = [...displayOrder];
                    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                    setColumnOrders(prev => ({ ...prev, [activeView]: newOrder }));
                  };
                  
                  const moveDown = () => {
                    if (index === displayOrder.length - 1) return;
                    const newOrder = [...displayOrder];
                    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                    setColumnOrders(prev => ({ ...prev, [activeView]: newOrder }));
                  };
                  
                  const toggleVisibility = () => {
                    setHiddenColumns(prev => {
                      const current = prev[activeView] || [];
                      if (current.includes(header)) {
                        return { ...prev, [activeView]: current.filter(h => h !== header) };
                      } else {
                        return { ...prev, [activeView]: [...current, header] };
                      }
                    });
                  };

                  return (
                    <div key={header} className={`flex items-center justify-between p-3 rounded-xl mb-1 ${isHidden ? 'bg-slate-50/50 dark:bg-slate-800/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'} transition-colors group`}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <button 
                          onClick={toggleVisibility}
                          className={`p-1.5 rounded-lg transition-colors shrink-0 ${isHidden ? 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50'}`}
                          title={isHidden ? 'Mostrar columna' : 'Ocultar columna'}
                        >
                          {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <span className={`text-sm font-medium truncate ${isHidden ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                          {header}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={moveUp} disabled={index === 0} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30">
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button onClick={moveDown} disabled={index === displayOrder.length - 1} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30">
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between shrink-0">
              <button 
                onClick={() => {
                  setColumnOrders(prev => ({ ...prev, [activeView]: headers }));
                  setHiddenColumns(prev => ({ ...prev, [activeView]: [] }));
                }}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-3 py-2"
              >
                Restablecer
              </button>
              <button 
                onClick={() => setIsColumnManagerOpen(false)}
                className="text-sm font-bold bg-slate-800 dark:bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-slate-700 dark:hover:bg-blue-500 shadow-sm"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK TRANSFER MODAL */}
      <QuickTransferModal
        isOpen={isQuickTraspasoOpen}
        onClose={() => {
          setIsQuickTraspasoOpen(false);
          setQuickTraspasoItem(null);
        }}
        item={quickTraspasoItem}
        headers={headers}
        onSave={handleSaveQuickTraspaso}
      />
      
      {/* TICKET CONFIG MODAL */}
      <TicketConfigModal
        isOpen={isTicketConfigOpen}
        onClose={() => setIsTicketConfigOpen(false)}
        headers={headers}
        activeView={activeView}
        config={globalTicketConfig[activeView] || {}}
        onSave={handleSaveTicketConfig}
      />

      {/* BULK IMPORT MODAL */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Importación Inteligente</h2>
              <button onClick={() => setIsBulkImportOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <BulkImportFRC onImport={async (data) => {
              if (!activeSheet || headers.length === 0) {
                alert('No hay una hoja activa configurada.');
                return;
              }
              try {
                setIsSaving(true);
                const nowIso = new Date().toISOString();
                let nextRowIndex = items.length ? Math.max(...items.map(i => i._rowIndex || 2)) + 1 : 2;

                for (const item of data) {
                  const rowValues = headers.map(h => item[h] || '');
                  const newItem: InventoryItem = { _rowIndex: nextRowIndex++ };
                  headers.forEach((h, i) => newItem[h] = rowValues[i]);

                  setItems(prev => [...prev, newItem]);

                  try {
                    await appendRow(activeSheet.title, rowValues);
                  } catch (saveErr) {
                    console.warn('Network error during bulk import append, adding to offline queue:', saveErr);
                    setOfflineQueue(prev => [...prev, {
                      type: 'append',
                      sheetTitle: activeSheet.title,
                      values: rowValues,
                      timestamp: nowIso
                    }]);
                    setIsOffline(true);
                  }
                }

                setIsBulkImportOpen(false);
                alert(`Se importaron y guardaron ${data.length} registros exitosamente en la hoja "${activeSheet.title}".`);
                await fetchData();
              } catch (err: any) {
                alert(`Error al importar registros: ${err.message}`);
              } finally {
                setIsSaving(false);
              }
            }} />
          </div>
        </div>
      )}
    </div>

    {/* HIDDEN UNLESS PRINTING: TICKET PRINT VIEW */}
    <TicketPrintView 
      items={selectedRowIds.length > 0 ? filteredItems.filter(i => selectedRowIds.includes(i._rowIndex as number)) : filteredItems} 
      headers={headers} 
      config={globalTicketConfig[activeView] || {}} 
    />
    </>
  );
};

export default InventoryDashboard;
