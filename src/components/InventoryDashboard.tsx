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
  FileSpreadsheet, FileText, Search, X, Truck, RotateCcw, 
  PackageX, Sparkles, Clock, Clock3, Flame, AlertTriangle, CheckCircle2, 
  Sliders, Link2, Download, CheckSquare, Square, Columns, Eye, EyeOff, ArrowUp, ArrowDown, Menu, Scan
} from 'lucide-react';

// Utilities & Hooks
import { 
  EVENT_CATEGORIES, 
  renderEventIcon, 
  parseAnyDate, 
  getEventCategory, 
  getItemStatus 
} from '../utils/dateCalculations';
import { findColumnBySemantic } from '../utils/columnAliases';
import { useColumnResize } from '../hooks/useColumnResize';
import { SAMPLE_HEADERS, SAMPLE_ITEMS, SAMPLE_PRODUCTS, SAMPLE_POLICIES } from '../data/sampleInventory';

// Modals & Drawers & Sub-components
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
import { exportToCSV } from '../utils/exportUtils';

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
  const [eventFilter, setEventFilter] = useState<EventCategory | 'all'>('all');
  const [pmRadarFilter, setPmRadarFilter] = useState<'all' | 'drainage' | 'upcoming' | 'retire_now' | 'en_regla'>('all');
  const [activeQuickChip, setActiveQuickChip] = useState<string | null>(null);

  // Column Manager State
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [areFiltersVisible, setAreFiltersVisible] = useState<boolean>(true);
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
    
    return cols;
  }, [headers, activeSheet, sheetConfig.schema, hiddenColumns, columnOrders, activeView]);

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

  const filteredItems = useMemo(() => {
    let list = items;

    // Apply Event Category Filter in main or events view
    if (activeView === 'main') {
      list = list.filter(item => getEventCategory(item, headers) === 'VENCIMIENTO');
    } else if (activeView === 'events' && eventFilter !== 'all') {
      list = list.filter(item => getEventCategory(item, headers) === eventFilter);
    }

    // Apply PM Radar Filter when in main view
    if (activeView === 'main' && pmRadarFilter !== 'all') {
      list = list.filter(item => {
        const st = getItemStatus(item, headers);
        if (pmRadarFilter === 'drainage') return st.code === 'DRAINAGE_PM';
        if (pmRadarFilter === 'upcoming') return st.code === 'UPCOMING';
        if (pmRadarFilter === 'retire_now') return st.code === 'RETIRE_NOW' || st.code === 'EXPIRED';
        if (pmRadarFilter === 'en_regla') return st.code === 'NORMAL';
        return true;
      });
    }

    if (!deferredSearchTerm.trim() && !activeQuickChip) return list;
    const term = (deferredSearchTerm.trim() || activeQuickChip || '').toLowerCase();
    return list.filter(item => {
      return searchableHeaders.some(h => {
        const val = item[h];
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [items, deferredSearchTerm, activeQuickChip, searchableHeaders, activeView, eventFilter, pmRadarFilter, headers]);

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
          { properties: { sheetId: 2, title: 'Incidencias_FRC', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } } },
          { properties: { sheetId: 3, title: 'Catalogo_Productos', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } } },
          { properties: { sheetId: 4, title: 'Politicas_Canje', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } } }
        ]
      });
      setActiveSheet({ sheetId: 1, title: 'Vencimientos_Inventario', hidden: false, gridProperties: { rowCount: 10, columnCount: 10 } });
      setHeaders(SAMPLE_HEADERS);
      setItems(SAMPLE_ITEMS);
      setAllMainItems(SAMPLE_ITEMS);
      setProducts(SAMPLE_PRODUCTS);
      setPolicies(SAMPLE_POLICIES);
      setIsRelationalActive(true);
      setError('Modo Demostración / Sin conexión: Mostrando datos de ejemplo de logística y vencimientos. Puede configurar su URL de Google Apps Script en Ajustes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(sheetConfig, activeView);
    setSelectedRowIds([]);
  }, [activeView]);

  const handleSelectEventCategory = (cat: EventCategory) => {
    setSelectedEventCategory(cat);
    const eventCol = headers.find(h => /tipo.*evento|evento|tipo.*registro|incidencia|categor[ií]a/i.test(h));
    if (eventCol) {
      setFormData(prev => ({
        ...prev,
        [eventCol]: EVENT_CATEGORIES[cat].name
      }));
    }
  };

  const handleAddEventColumn = async () => {
    if (!activeSheet || headers.length === 0) return;
    const colName = 'TIPO_EVENTO';
    if (headers.includes(colName)) return;
    try {
      setLoading(true);
      const newHeaders = [...headers, colName];
      await updateRow(activeSheet.title, 1, newHeaders);
      await fetchData();
    } catch (err: any) {
      alert(`Error agregando columna TIPO_EVENTO: ${err.message}`);
      setLoading(false);
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
    return (
      <div className="flex h-full items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const mappedSheets = [sheetConfig.main, sheetConfig.events, sheetConfig.products, sheetConfig.policies].filter(Boolean);
  const otherSheets = metadata?.sheets
    .map((s: any) => s.properties.title)
    .filter((t: string) => !mappedSheets.includes(t) && !/^_/i.test(t.trim())) || [];

  return (
    <div className="flex h-full overflow-hidden bg-[#F8FAFC]">
      
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
          <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-base">Menú de Navegación</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100">
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
        <div className="bg-white border-b border-slate-200 z-20 sticky top-0 shrink-0 px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shrink-0"
            title="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search is the hero */}
          <div className="flex-1 flex justify-center">
            {(activeView !== 'schema' || searchableHeaders.length > 0) ? (
              <div className="relative w-full max-w-3xl flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={activeView === 'analytics' ? "Explorar y filtrar gráficos por lote, descripción, proveedor..." : `Buscar en todo el inventario (${searchableHeaders.length} columnas)...`}
                    className="w-full pl-11 pr-10 py-3 bg-slate-100/70 hover:bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl text-base font-medium text-slate-700 placeholder:text-slate-400 outline-none transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200/60 transition-colors"
                      title="Limpiar búsqueda"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl transition-all shrink-0 flex items-center gap-2 border border-blue-200/60 shadow-sm"
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
              <button
                onClick={() => exportToCSV(`${activeView}_${new Date().toISOString().split('T')[0]}`, headers, filteredItems)}
                className="text-sm bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 hidden md:flex"
                title="Exportar la vista actual a CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Exportar CSV</span>
              </button>
            )}
            {/* Status & Sync Indicator */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
              <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-slate-700">{isOffline ? 'Modo Offline (Caché)' : 'Conectado'}</span>
              {lastCachedAt && (
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">({new Date(lastCachedAt).toLocaleTimeString()})</span>
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
            <button onClick={() => fetchData()} className="text-sm bg-white border border-slate-200 px-3 py-2.5 rounded-xl font-medium shadow-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors" title="Refrescar datos">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* CONTEXTUAL PAGE HEADER */}
        <div className="bg-slate-50/50 border-b border-slate-200 shrink-0 px-8 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              {activeView === 'main' ? 'Radar de Vencimientos & Drenaje' :
               activeView === 'events' ? 'Registro de Incidencias & FRC' : 
               activeView === 'products' ? 'Catálogo de Productos' : 
               activeView === 'policies' ? 'Políticas de Canje' : 
               activeView === 'schema' ? 'Configuración de Datos & Relaciones' :
               activeView === 'analytics' ? 'Analítica & Dashboard' :
               activeView}
              
              {isRelationalActive && activeView === 'main' && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" /> Modelo Relacional Activo
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
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
            {activeView === 'schema' && (
              <button
                onClick={() => setIsScriptModalOpen(true)}
                className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>Conector Apps Script</span>
              </button>
            )}
            
            {activeView === 'main' && (
              <button
                onClick={() => setIsPmReportOpen(true)}
                className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-3.5 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5"
                title="Generar resumen de productos críticos para enviar a Product Manager"
              >
                <Flame className="w-4 h-4 text-orange-600" />
                <span>Reporte PM ({drainageReportItems.length})</span>
              </button>
            )}

            {activeView !== 'schema' && activeView !== 'analytics' && (
              <button
                onClick={() => setAreFiltersVisible(!areFiltersVisible)}
                className={`text-xs bg-white border ${areFiltersVisible ? 'border-blue-300 text-blue-700 bg-blue-50/50' : 'border-slate-200 text-slate-700'} hover:bg-slate-50 px-3.5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-sm`}
                title={areFiltersVisible ? "Ocultar paneles de filtros y radar" : "Mostrar paneles de filtros y radar"}
              >
                <Sliders className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">{areFiltersVisible ? 'Ocultar Filtros' : 'Mostrar Filtros'}</span>
              </button>
            )}

            {activeView !== 'schema' && activeView !== 'analytics' && (
              <button
                onClick={() => setIsColumnManagerOpen(true)}
                className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Columns className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Columnas</span>
              </button>
            )}
            
            {hasCustomColWidths && activeView !== 'schema' && activeView !== 'analytics' && (
              <button
                onClick={handleResetColWidths}
                className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-1"
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
                className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-blue-200 flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all"
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
          <div className="bg-slate-50 border-b border-slate-200 px-8 py-2.5 shrink-0 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2 shrink-0">Filtros Rápidos:</span>
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => setActiveQuickChip(activeQuickChip === chip ? null : chip)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                  activeQuickChip === chip
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {chip}
              </button>
            ))}
            {activeQuickChip && (
              <button
                onClick={() => setActiveQuickChip(null)}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-full transition-colors shrink-0 underline"
              >
                Limpiar filtro
              </button>
            )}
          </div>
        )}

        {/* INCIDENCIAS & FRC STRIP (When activeView === 'events') */}
        {activeView === 'events' && activeSheet && (
          <div className="bg-white border-b border-slate-200 px-8 py-4 shrink-0 flex flex-col gap-4 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <button
                onClick={() => setEventFilter(eventFilter === 'TRANSPORTE' ? 'all' : 'TRANSPORTE')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  eventFilter === 'TRANSPORTE'
                    ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{eventMetrics.transporte}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Deterioro Transporte</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Golpe / rotura en flete</p>
                </div>
              </button>

              <button
                onClick={() => setEventFilter(eventFilter === 'DIFERENCIA' ? 'all' : 'DIFERENCIA')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  eventFilter === 'DIFERENCIA'
                    ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{eventMetrics.diferencia}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Diferencia Pedido</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Faltante / sobrante / trocado</p>
                </div>
              </button>

              <button
                onClick={() => setEventFilter(eventFilter === 'AVERIA' ? 'all' : 'AVERIA')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  eventFilter === 'AVERIA'
                    ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
                    <PackageX className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{eventMetrics.averia}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Avería / Merma</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Derrame o rotura interna</p>
                </div>
              </button>

              <button
                onClick={() => setEventFilter(eventFilter === 'DEVOLUCION' ? 'all' : 'DEVOLUCION')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  eventFilter === 'DEVOLUCION'
                    ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{eventMetrics.devolucion}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Devolución / Canje</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Gestión con proveedor</p>
                </div>
              </button>

              <button
                onClick={() => setEventFilter(eventFilter === 'VENCIMIENTO_CERCANO' ? 'all' : 'VENCIMIENTO_CERCANO')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  eventFilter === 'VENCIMIENTO_CERCANO'
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Clock3 className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{eventMetrics.vencimientoCercano}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Vencimiento Cercano</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Control de caducidad inminente</p>
                </div>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mr-1">Filtrar Incidencias:</span>
              <button 
                onClick={() => setEventFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  eventFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({items.length})
              </button>
              <button 
                onClick={() => setEventFilter('TRANSPORTE')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  eventFilter === 'TRANSPORTE'
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-200' 
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Transporte ({eventMetrics.transporte})</span>
              </button>
              <button 
                onClick={() => setEventFilter('DIFERENCIA')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  eventFilter === 'DIFERENCIA'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-200' 
                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Diferencias ({eventMetrics.diferencia})</span>
              </button>
              <button 
                onClick={() => setEventFilter('AVERIA')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  eventFilter === 'AVERIA'
                    ? 'bg-rose-600 text-white shadow-sm shadow-rose-200' 
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                }`}
              >
                <PackageX className="w-3.5 h-3.5" />
                <span>Averías ({eventMetrics.averia})</span>
              </button>
              <button 
                onClick={() => setEventFilter('DEVOLUCION')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  eventFilter === 'DEVOLUCION'
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-200' 
                    : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Devolución ({eventMetrics.devolucion})</span>
              </button>
              <button 
                onClick={() => setEventFilter('VENCIMIENTO_CERCANO')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  eventFilter === 'VENCIMIENTO_CERCANO'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' 
                    : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                }`}
              >
                <Clock3 className="w-3.5 h-3.5" />
                <span>Venc. Cercano ({eventMetrics.vencimientoCercano})</span>
              </button>
            </div>
          </div>
        )}

        {/* RADAR COMERCIAL (Only in main view, exclusively for Vencimientos) */}
        {activeView === 'main' && activeSheet && (
          <div className="bg-white border-b border-slate-200 px-8 py-4 shrink-0 flex flex-col gap-4 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              <button
                onClick={() => setPmRadarFilter('all')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  pmRadarFilter === 'all'
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{pmMetrics.total}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Total Vencimientos</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Registros comerciales</p>
                </div>
              </button>

              <button
                onClick={() => setPmRadarFilter('en_regla')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  pmRadarFilter === 'en_regla'
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{pmMetrics.enRegla}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">En Regla</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Dentro de política</p>
                </div>
              </button>

              <button
                onClick={() => setPmRadarFilter('drainage')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  pmRadarFilter === 'drainage'
                    ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{pmMetrics.drainage}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Drenaje PM</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Prioridad comercial</p>
                </div>
              </button>

              <button
                onClick={() => setPmRadarFilter('upcoming')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  pmRadarFilter === 'upcoming'
                    ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Clock3 className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{pmMetrics.upcoming}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Próximo a Retiro</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">&lt; 30 días a política</p>
                </div>
              </button>

              <button
                onClick={() => setPmRadarFilter('retire_now')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  pmRadarFilter === 'retire_now'
                    ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-red-100 text-red-800 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{pmMetrics.retireNow}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Retirar Ya / Vencido</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Acción inmediata</p>
                </div>
              </button>
            </div>

            {/* Helper notice if TIPO_EVENTO is not in headers */}
            {!headers.some(h => /tipo.*evento|evento|incidencia/i.test(h)) && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Gestión de Eventos:</strong> Puedes añadir una columna <code className="bg-blue-100 px-1 py-0.5 rounded font-mono font-bold text-blue-800">TIPO_EVENTO</code> para guardar la tipificación automáticamente en Google Sheets.
                  </span>
                </div>
                <button
                  onClick={handleAddEventColumn}
                  className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shrink-0 transition-colors shadow-sm"
                >
                  + Añadir TIPO_EVENTO
                </button>
              </div>
            )}
          </div>
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
            <div className="h-full w-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Módulo sin asignar</h3>
                <p className="text-slate-500 mt-2 text-sm">Aún no has seleccionado qué pestaña de tu Google Sheet cumplirá esta función.</p>
                <button onClick={() => setIsConfigOpen(true)} className="mt-6 bg-white border border-slate-200 text-slate-700 font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 transition-all">
                  Abrir Configuración
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
              <div className="flex-1 overflow-auto relative" ref={tableContainerRef}>
                <table className="text-left border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                  <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider select-none z-10">
                    <tr>
                      {/* Selection Header */}
                      <th className="p-4 text-center bg-slate-50" style={{ width: '48px', minWidth: '48px' }}>
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
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
                        className="p-4 text-center text-slate-400 bg-slate-50 relative group"
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
                          <div className="w-[1px] h-3 bg-slate-300 group-hover:bg-blue-500"></div>
                        </div>
                      </th>

                      {/* Event Type Header */}
                      {(activeView === 'main' || activeView === 'events') && (
                        <th 
                          style={{ width: `${getColWidth('_event_type', 'Tipo de Evento')}px`, minWidth: '90px' }} 
                          className="p-4 bg-slate-50 relative group"
                        >
                          <div className="truncate pr-2">Tipo de Evento</div>
                          <div
                            onMouseDown={(e) => handleStartResize('_event_type', getColWidth('_event_type', 'Tipo de Evento'), e)}
                            onDoubleClick={() => handleAutoFitColumn('_event_type', 'Tipo de Evento')}
                            title="Arrastra para cambiar ancho (Doble clic para autoajustar)"
                            className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/80 transition-colors z-20 flex items-center justify-center ${
                              resizingCol?.colId === '_event_type' ? 'bg-blue-600 w-2.5' : ''
                            }`}
                          >
                            <div className="w-[1px] h-3 bg-slate-300 group-hover:bg-blue-500"></div>
                          </div>
                        </th>
                      )}

                      {/* Expiration Status Header */}
                      {activeView === 'main' && (
                        <th 
                          style={{ width: `${getColWidth('_status', 'Estado / Radar PM')}px`, minWidth: '100px' }} 
                          className="p-4 bg-slate-50 relative group"
                        >
                          <div className="truncate pr-2">Estado / Radar PM</div>
                          <div
                            onMouseDown={(e) => handleStartResize('_status', getColWidth('_status', 'Estado / Radar PM'), e)}
                            onDoubleClick={() => handleAutoFitColumn('_status', 'Estado / Radar PM')}
                            title="Arrastra para cambiar ancho (Doble clic para autoajustar)"
                            className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/80 transition-colors z-20 flex items-center justify-center ${
                              resizingCol?.colId === '_status' ? 'bg-blue-600 w-2.5' : ''
                            }`}
                          >
                            <div className="w-[1px] h-3 bg-slate-300 group-hover:bg-blue-500"></div>
                          </div>
                        </th>
                      )}

                      {/* Visible Column Headers */}
                      {visibleHeaders.map((header) => {
                        const colSchema = sheetConfig.schema?.[activeSheet?.title || '']?.[header];
                        const width = getColWidth(header, header, colSchema?.type);
                        const isResizingThis = resizingCol?.colId === header;

                        return (
                          <th 
                            key={header} 
                            style={{ width: `${width}px`, minWidth: '70px' }}
                            className="p-4 bg-slate-50 relative group transition-colors"
                          >
                            <div className="flex items-center gap-1.5 truncate pr-2">
                              <span className="truncate">{header}</span>
                              {colSchema?.isKey && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-mono font-bold shrink-0">
                                  ID
                                </span>
                              )}
                              {colSchema?.type === 'ref' && (
                                <span className="text-[9px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-mono shrink-0">
                                  REF
                                </span>
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
                              <div className="w-[1px] h-3 bg-slate-300 group-hover:bg-blue-500"></div>
                            </div>
                          </th>
                        );
                      })}
                      
                      {/* Fixed Actions Column Header */}
                      <th className="p-4 text-right bg-slate-50 sticky right-0 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.03)] w-24 min-w-[96px]">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={visibleHeaders.length + 4} className="p-8 text-center text-slate-400">
                          {searchTerm 
                            ? 'No se encontraron resultados que coincidan con la búsqueda.' 
                            : 'No hay datos en esta hoja.'}
                        </td>
                      </tr>
                    ) : (<>
                      {paddingTop > 0 && (
                        <tr><td style={{ height: `${paddingTop}px` }} colSpan={visibleHeaders.length + 3} /></tr>
                      )}
                      {virtualRows.map((virtualRow) => {
                        const item = paginatedItems[virtualRow.index];
                        const idx = virtualRow.index;

                        const eventCategory = getEventCategory(item, headers);
                        const eventCategoryDef = EVENT_CATEGORIES[eventCategory];
                        const status = getItemStatus(item, headers);
                        const isMainOrEvents = activeView === 'main' || activeView === 'events';

                        return (
                          <tr key={idx} data-index={virtualRow.index} ref={rowVirtualizer.measureElement} className={`transition-colors group ${selectedRowIds.includes(item._rowIndex as number) ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50/80'}`}>
                            {/* Selection Cell */}
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                  checked={selectedRowIds.includes(item._rowIndex as number)}
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
                              className="p-4 text-center font-mono text-xs text-slate-400 truncate"
                            >
                              {item._rowIndex}
                            </td>

                            {/* Event Type Badge */}
                            {isMainOrEvents && (
                              <td 
                                style={{ width: `${getColWidth('_event_type', 'Tipo de Evento')}px` }}
                                className="p-4 truncate"
                              >
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${eventCategoryDef.badgeBg} ${eventCategoryDef.badgeText} ${eventCategoryDef.badgeBorder} truncate`}>
                                  {renderEventIcon(eventCategory, 'w-3.5 h-3.5 shrink-0')}
                                  <span className="truncate">{eventCategoryDef.shortLabel}</span>
                                </span>
                              </td>
                            )}

                            {/* Expiration Status Badge (Main view) */}
                            {activeView === 'main' && (
                              <td 
                                style={{ width: `${getColWidth('_status', 'Estado / Radar PM')}px` }}
                                className="p-4 truncate"
                              >
                                {eventCategory === 'VENCIMIENTO' ? (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border truncate ${status.color}`}>
                                    <span className="shrink-0">{status.icon}</span>
                                    <span className="truncate">{status.label}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Incidencia FRC</span>
                                )}
                              </td>
                            )}

                            {/* Cell Values */}
                            {visibleHeaders.map((header) => {
                              const val = item[header];
                              const isSku = /sku|código|codigo/i.test(header);
                              const isProductsView = activeView === 'products';
                              const colWidth = getColWidth(header, header);

                              return (
                                <td 
                                  key={header} 
                                  style={{ width: `${colWidth}px`, maxWidth: `${colWidth}px` }}
                                  className="p-4 truncate"
                                >
                                  {isProductsView && isSku ? (
                                    <button 
                                      onClick={() => setSelectedProduct(item)}
                                      className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 truncate text-left"
                                      title="Ver detalle del producto y registros relacionados"
                                    >
                                      <span className="truncate">{String(val || '')}</span>
                                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-mono shrink-0">
                                        DETALLE
                                      </span>
                                    </button>
                                  ) : isSku && val ? (
                                    <span className="font-mono font-semibold text-slate-800 truncate block">
                                      {String(val)}
                                    </span>
                                  ) : (
                                    <span className="truncate block">
                                      {val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '-'}
                                    </span>
                                  )}
                                </td>
                              );
                            })}


                            {/* Row Actions */}
                            <td className="p-4 text-right sticky right-0 bg-white group-hover:bg-slate-50 transition-colors shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.03)] w-24 min-w-[96px]">
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => handleOpenModal(item)} 
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar registro"
                                >
                                  <Edit2 className="w-4 h-4"/>
                                </button>
                                <button 
                                  onClick={() => handleDelete(item)} 
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                        <tr><td style={{ height: `${paddingBottom}px` }} colSpan={visibleHeaders.length + 3} /></tr>
                      )}
                    </>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Footer summary bar */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
                <span>
                  Mostrando <strong>{filteredItems.length}</strong> de <strong>{items.length}</strong> registros
                </span>
                <span className="text-[11px] text-slate-400">
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
                    exportToCSV(`Seleccion_${new Date().toISOString().split('T')[0]}`, headers, selectedItems);
                  }}
                  className="text-xs hover:bg-slate-700 px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" /> Exportar
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

      {/* 6. COLUMN MANAGER MODAL */}
      {isColumnManagerOpen && activeSheet && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Gestionar Columnas</h3>
                <p className="text-xs text-slate-500 mt-1">Oculta o reordena las columnas para esta vista.</p>
              </div>
              <button onClick={() => setIsColumnManagerOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-xl transition-colors">
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
                    <div key={header} className={`flex items-center justify-between p-3 rounded-xl mb-1 ${isHidden ? 'bg-slate-50/50' : 'hover:bg-slate-50'} transition-colors group`}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <button 
                          onClick={toggleVisibility}
                          className={`p-1.5 rounded-lg transition-colors shrink-0 ${isHidden ? 'text-slate-400 hover:bg-slate-200' : 'text-blue-600 hover:bg-blue-50'}`}
                          title={isHidden ? 'Mostrar columna' : 'Ocultar columna'}
                        >
                          {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <span className={`text-sm font-medium truncate ${isHidden ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {header}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={moveUp} disabled={index === 0} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-30">
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button onClick={moveDown} disabled={index === displayOrder.length - 1} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-30">
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between shrink-0">
              <button 
                onClick={() => {
                  setColumnOrders(prev => ({ ...prev, [activeView]: headers }));
                  setHiddenColumns(prev => ({ ...prev, [activeView]: [] }));
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2"
              >
                Restablecer
              </button>
              <button 
                onClick={() => setIsColumnManagerOpen(false)}
                className="text-sm font-bold bg-slate-800 text-white px-5 py-2.5 rounded-xl hover:bg-slate-700 shadow-sm"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryDashboard;
