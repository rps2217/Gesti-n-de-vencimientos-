import React, { useState, useEffect, useMemo } from 'react';
import { 
  getSpreadsheetMetadata, getSheetData, appendRow, updateRow, deleteRow, SPREADSHEET_ID,
  loadCloudConfig, saveCloudConfig, getScriptPropertiesConfig, saveScriptPropertiesConfig, APPS_SCRIPT_TEMPLATE
} from '../lib/sheets';
import { 
  Loader2, Plus, AlertCircle, RefreshCw, ExternalLink, Package, Database, Zap, Settings, 
  FileText, List, ChevronRight, LayoutTemplate, PanelLeftClose, PanelLeftOpen, TableProperties, 
  Eye, EyeOff, Search, X, Calculator, Hash, Calendar, Clock, Tag, ListFilter, Check, CheckSquare, Square,
  Cloud, CloudOff, CheckCircle2, ShieldAlert, UploadCloud, DownloadCloud, Key, Link2, Copy, CheckCheck,
  TrendingDown, Clock3, AlertTriangle, ArrowUpRight, Flame, Layers, Send,
  Truck, FileSpreadsheet, PackageX, RotateCcw, HelpCircle, Boxes, FileWarning,
  Code2, Terminal, Sliders, Sparkles
} from 'lucide-react';
import { InventoryItem, ColumnSchema, ColumnType, ColumnBehavior, EventCategory } from '../types';

export const EVENT_CATEGORIES: Record<EventCategory, {
  id: EventCategory;
  name: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBorder: string;
  cardBg: string;
  iconBg: string;
}> = {
  VENCIMIENTO: {
    id: 'VENCIMIENTO',
    name: 'Vencimiento Regular',
    shortLabel: 'Vencimiento',
    description: 'Control de caducidad, fecha de retiro preventivo y radar comercial para PM',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    cardBorder: 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50',
    cardBg: 'bg-blue-600 text-white',
    iconBg: 'bg-blue-100 text-blue-700'
  },
  TRANSPORTE: {
    id: 'TRANSPORTE',
    name: 'Deterioro de Transporte',
    shortLabel: 'Deterioro Transporte',
    description: 'Embalaje dañado, golpe o rotura física durante el flete o recepción',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    cardBorder: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50',
    cardBg: 'bg-amber-600 text-white',
    iconBg: 'bg-amber-100 text-amber-800'
  },
  DIFERENCIA: {
    id: 'DIFERENCIA',
    name: 'Diferencia de Pedido',
    shortLabel: 'Diferencia Pedido',
    description: 'Inconsistencia de unidades recibidas vs factura o guía (faltante / sobrante / trocado)',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
    cardBorder: 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/50',
    cardBg: 'bg-purple-600 text-white',
    iconBg: 'bg-purple-100 text-purple-800'
  },
  AVERIA: {
    id: 'AVERIA',
    name: 'Avería / Merma Almacén',
    shortLabel: 'Avería Almacén',
    description: 'Derrame, caída accidental o rotura interna de producto en bodega',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200',
    cardBorder: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/50',
    cardBg: 'bg-rose-600 text-white',
    iconBg: 'bg-rose-100 text-rose-800'
  },
  DEVOLUCION: {
    id: 'DEVOLUCION',
    name: 'Reclamo / Devolución',
    shortLabel: 'Devolución Proveedor',
    description: 'Producto no conforme retenido para gestión de canje o nota de crédito',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-200',
    cardBorder: 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/50',
    cardBg: 'bg-teal-600 text-white',
    iconBg: 'bg-teal-100 text-teal-800'
  }
};

export function renderEventIcon(category: EventCategory, className = 'w-4 h-4') {
  switch (category) {
    case 'TRANSPORTE':
      return <Truck className={className} />;
    case 'DIFERENCIA':
      return <FileSpreadsheet className={className} />;
    case 'AVERIA':
      return <PackageX className={className} />;
    case 'DEVOLUCION':
      return <RotateCcw className={className} />;
    case 'VENCIMIENTO':
    default:
      return <Clock className={className} />;
  }
}

// Helper to determine the event category of any item
export function getEventCategory(item: InventoryItem, headers: string[]): EventCategory {
  const eventHeader = headers.find(h => /tipo.*evento|evento|tipo.*registro|incidencia|categor[ií]a/i.test(h));
  if (eventHeader && item[eventHeader]) {
    const raw = String(item[eventHeader]).toUpperCase();
    if (raw.includes('TRANSP') || raw.includes('FLETE') || raw.includes('DAÑO') || raw.includes('DETERIORO')) return 'TRANSPORTE';
    if (raw.includes('DIFER') || raw.includes('PEDIDO') || raw.includes('FALT') || raw.includes('SOBR') || raw.includes('TROC')) return 'DIFERENCIA';
    if (raw.includes('AVER') || raw.includes('MERMA') || raw.includes('ROTURA')) return 'AVERIA';
    if (raw.includes('DEVOL') || raw.includes('RECLAM') || raw.includes('CANJE_PROV')) return 'DEVOLUCION';
    if (raw.includes('VENC') || raw.includes('CADUC')) return 'VENCIMIENTO';
  }
  
  // Check if item has FECHA_VC or MM/YYYY
  const vcCol = headers.find(h => /^FECHA_VC$|vencimiento|caducidad/i.test(h));
  if (vcCol && item[vcCol]) return 'VENCIMIENTO';

  return 'VENCIMIENTO';
}

function SidebarItem({ icon, label, active, onClick, collapsed }: any) {
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-medium transition-all ${
        active 
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
      }`}
    >
      {React.cloneElement(icon, { className: `w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}` })}
      {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
      {!collapsed && active && <ChevronRight className="w-4 h-4 opacity-70 shrink-0" />}
    </button>
  );
}

// Helper to compute expiration, retirement and drainage status for an item
function getItemStatus(item: InventoryItem, headers: string[]) {
  const retCol = headers.find(h => /retiro|canje/i.test(h));
  const vcCol = headers.find(h => /^FECHA_VC$|vencimiento|caducidad/i.test(h));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let daysToRetire: number | null = null;
  let daysToExpiry: number | null = null;

  if (retCol && item[retCol]) {
    const parts = String(item[retCol]).split('-');
    if (parts.length === 3) {
      const dRet = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!isNaN(dRet.getTime())) {
        daysToRetire = Math.ceil((dRet.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
  }

  if (vcCol && item[vcCol]) {
    const parts = String(item[vcCol]).split('-');
    if (parts.length === 3) {
      const dVc = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!isNaN(dVc.getTime())) {
        daysToExpiry = Math.ceil((dVc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
  }

  let code: 'EXPIRED' | 'RETIRE_NOW' | 'UPCOMING' | 'DRAINAGE_PM' | 'NORMAL' = 'NORMAL';
  let label = 'En Tiempo';
  let color = 'bg-slate-100 text-slate-700 border-slate-200';
  let icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;

  if (daysToExpiry !== null && daysToExpiry <= 0) {
    code = 'EXPIRED';
    label = 'Vencido';
    color = 'bg-rose-100 text-rose-800 border-rose-200';
    icon = <AlertCircle className="w-3.5 h-3.5 text-rose-600" />;
  } else if (daysToRetire !== null && daysToRetire <= 0) {
    code = 'RETIRE_NOW';
    label = 'Retirar Inmediatamente';
    color = 'bg-red-100 text-red-800 border-red-200 font-bold';
    icon = <AlertTriangle className="w-3.5 h-3.5 text-red-600" />;
  } else if (daysToRetire !== null && daysToRetire <= 30) {
    code = 'UPCOMING';
    label = `Próximo Retiro (${daysToRetire}d)`;
    color = 'bg-amber-100 text-amber-800 border-amber-200 font-semibold';
    icon = <Clock3 className="w-3.5 h-3.5 text-amber-600" />;
  } else if (daysToRetire !== null && daysToRetire <= 90) {
    code = 'DRAINAGE_PM';
    label = `Alerta Drenaje PM (${daysToRetire}d)`;
    color = 'bg-orange-100 text-orange-900 border-orange-200 font-semibold';
    icon = <Flame className="w-3.5 h-3.5 text-orange-600" />;
  }

  return { code, label, color, icon, daysToRetire, daysToExpiry };
}

export default function InventoryDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [activeSheet, setActiveSheet] = useState<any>(null);
  const [activeView, setActiveView] = useState<string>('main');
  const [headers, setHeaders] = useState<string[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);

  // Relational Engine State
  const [products, setProducts] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [allMainItems, setAllMainItems] = useState<InventoryItem[]>([]);
  const [isRelationalActive, setIsRelationalActive] = useState(false);

  // Master-Detail Product Drawer
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // PM Radar Filter & Event Filter
  const [pmRadarFilter, setPmRadarFilter] = useState<'all' | 'drainage' | 'upcoming' | 'retire_now'>('all');
  const [eventFilter, setEventFilter] = useState<'all' | EventCategory>('all');
  const [selectedEventCategory, setSelectedEventCategory] = useState<EventCategory>('VENCIMIENTO');
  const [isPmReportOpen, setIsPmReportOpen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Cloud Config & Script Properties State
  const [configStorageMode, setConfigStorageMode] = useState<'properties' | 'sheet' | 'local'>('local');
  const [hasCloudConfigSheet, setHasCloudConfigSheet] = useState(false);
  const [cloudConfigSheetName, setCloudConfigSheetName] = useState('_CONFIG_APP');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [copiedScriptCode, setCopiedScriptCode] = useState(false);

  // Form Validation State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Config State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);
  const [sheetConfig, setSheetConfig] = useState({
    main: '',
    products: '',
    policies: '',
    schema: {} as Record<string, Record<string, ColumnSchema>>
  });

  // Load config on mount
  useEffect(() => {
    const saved = localStorage.getItem('appsheet_clone_config');
    if (saved) {
      try {
        setSheetConfig(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveConfig = async (newConfig: any, syncToCloud = true) => {
    setSheetConfig(newConfig);
    localStorage.setItem('appsheet_clone_config', JSON.stringify(newConfig));
    setIsConfigOpen(false);

    if (syncToCloud) {
      if (configStorageMode === 'properties') {
        setIsSyncingCloud(true);
        try {
          await saveScriptPropertiesConfig(newConfig);
          setSyncSuccessMessage('Estructura sincronizada con Google Apps Script (PropertiesService).');
          setTimeout(() => setSyncSuccessMessage(null), 4000);
        } catch (err: any) {
          console.error('Error saving to properties config:', err);
        } finally {
          setIsSyncingCloud(false);
        }
      } else if (hasCloudConfigSheet) {
        setIsSyncingCloud(true);
        try {
          await saveCloudConfig(newConfig, cloudConfigSheetName);
          setSyncSuccessMessage(`Estructura sincronizada con la pestaña ${cloudConfigSheetName}.`);
          setTimeout(() => setSyncSuccessMessage(null), 4000);
        } catch (err: any) {
          console.error('Error saving to cloud config:', err);
        } finally {
          setIsSyncingCloud(false);
        }
      }
    }

    fetchData(newConfig, activeView);
  };

  // Push explicitly to PropertiesService (Option 2)
  const handlePushPropertiesConfig = async () => {
    setIsSyncingCloud(true);
    try {
      await saveScriptPropertiesConfig(sheetConfig);
      setConfigStorageMode('properties');
      setSyncSuccessMessage('¡Configuración guardada en Apps Script PropertiesService exitosamente!');
      setTimeout(() => setSyncSuccessMessage(null), 4000);
    } catch (e: any) {
      alert(`Error al guardar en Script Properties: ${e.message}. Asegúrate de haber actualizado el código de Apps Script con la nueva versión.`);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handlePushCloudConfig = async () => {
    setIsSyncingCloud(true);
    try {
      await saveCloudConfig(sheetConfig, cloudConfigSheetName);
      setHasCloudConfigSheet(true);
      setConfigStorageMode('sheet');
      setSyncSuccessMessage(`Configuración guardada exitosamente en ${cloudConfigSheetName}.`);
      setTimeout(() => setSyncSuccessMessage(null), 4000);
    } catch (e: any) {
      alert(`Error al sincronizar con Google Sheets: ${e.message}`);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const searchableHeaders = useMemo(() => {
    if (!activeSheet) return headers;
    const currentSchema = sheetConfig.schema?.[activeSheet.title];
    return headers.filter(h => {
      if (currentSchema && currentSchema[h] !== undefined) {
        return currentSchema[h].searchable !== false;
      }
      return true; // Default to searchable if not configured
    });
  }, [headers, activeSheet, sheetConfig.schema]);

  // Event Metrics Summary
  const eventMetrics = useMemo(() => {
    if (activeView !== 'main' || items.length === 0) {
      return {
        total: items.length,
        vencimientos: 0,
        transporte: 0,
        diferencia: 0,
        averia: 0,
        devolucion: 0,
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
      drainagePm,
      upcoming,
      retireNow
    };
  }, [items, headers, activeView]);

  // PM Radar Metrics (for vencimientos)
  const pmMetrics = useMemo(() => {
    return {
      total: eventMetrics.vencimientos,
      drainage: eventMetrics.drainagePm,
      upcoming: eventMetrics.upcoming,
      retireNow: eventMetrics.retireNow
    };
  }, [eventMetrics]);

  const filteredItems = useMemo(() => {
    let list = items;

    // Apply Event Category Filter in main view
    if (activeView === 'main' && eventFilter !== 'all') {
      list = list.filter(item => getEventCategory(item, headers) === eventFilter);
    }

    // Apply PM Radar Filter when in main view
    if (activeView === 'main' && pmRadarFilter !== 'all') {
      list = list.filter(item => {
        const cat = getEventCategory(item, headers);
        if (cat !== 'VENCIMIENTO') return false;
        const st = getItemStatus(item, headers);
        if (pmRadarFilter === 'drainage') return st.code === 'DRAINAGE_PM';
        if (pmRadarFilter === 'upcoming') return st.code === 'UPCOMING';
        if (pmRadarFilter === 'retire_now') return st.code === 'RETIRE_NOW' || st.code === 'EXPIRED';
        return true;
      });
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    return list.filter(item => {
      return searchableHeaders.some(h => {
        const val = item[h];
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [items, searchTerm, searchableHeaders, activeView, eventFilter, pmRadarFilter, headers]);

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

      let mainSheetTitle = currentConfig.main || allSheets[0];
      let prodSheetTitle = currentConfig.products || allSheets.find((t: string) => /producto/i.test(t));
      let polSheetTitle = currentConfig.policies || allSheets.find((t: string) => /política|politica|canje/i.test(t));
      
      if (!currentConfig.main && mainSheetTitle) currentConfig.main = mainSheetTitle;
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
      if (currentView === 'main') targetSheetTitle = currentConfig.main || allSheets[0];
      else if (currentView === 'products') targetSheetTitle = currentConfig.products;
      else if (currentView === 'policies') targetSheetTitle = currentConfig.policies;
      else targetSheetTitle = currentView;

      const targetSheetProp = meta.sheets.find((s: any) => s.properties.title === targetSheetTitle)?.properties;
      
      if (targetSheetProp) {
        setActiveSheet(targetSheetProp);
        const rows = await getSheetData(targetSheetProp.title);
        
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
      console.error(err);
      setError(err.message || 'Error al cargar los datos de la hoja.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(sheetConfig, activeView);
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
        // Autofill details
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

    headers.forEach(header => {
      const val = (formData[header] || '').trim();
      const colSchema = currentSchema[header];
      const effectiveType = colSchema?.type || (/fecha|vencimiento|retiro/i.test(header) ? 'date' : 'text');
      const isAutoCalculated = colSchema?.behavior === 'auto_id' || colSchema?.behavior === 'calc_fecha_vc' || colSchema?.behavior === 'calc_retiro' || effectiveType === 'calculated' || /^ID_VC$/i.test(header.trim());

      // Skip validation for calculated fields that will be generated automatically
      if (isAutoCalculated) return;

      // Number validation
      if (effectiveType === 'number' && val !== '') {
        if (isNaN(Number(val))) {
          errors[header] = 'Debe ser un número válido.';
        }
      }

      // Date validation
      if (effectiveType === 'date' && val !== '') {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          errors[header] = 'Formato de fecha inválido (AAAA-MM-DD).';
        }
      }

      // If logging an Incident (e.g. Transporte, Diferencia), MM/YYYY are not required
      if (selectedEventCategory === 'VENCIMIENTO') {
        // MM Month validation
        if (/^MM$/i.test(header.trim()) && val !== '') {
          const num = parseInt(val, 10);
          if (isNaN(num) || num < 1 || num > 12) {
            errors[header] = 'El mes debe estar entre 1 y 12.';
          }
        }

        // YYYY Year validation
        if (/^YYYY$/i.test(header.trim()) && val !== '') {
          const num = parseInt(val, 10);
          if (isNaN(num) || num < 2000 || num > 2100) {
            errors[header] = 'El año debe ser válido (ej. 2026).';
          }
        }
      }
    });

    // Cross-field validation: Expiration vs Withdrawal Date (only for regular expirations)
    if (selectedEventCategory === 'VENCIMIENTO') {
      const fechaVcHeader = headers.find(h => /^FECHA_VC$/i.test(h.trim()) || sheetConfig.schema?.[activeSheet.title]?.[h]?.behavior === 'calc_fecha_vc');
      const withdrawalHeader = headers.find(h => /retiro/i.test(h) || sheetConfig.schema?.[activeSheet.title]?.[h]?.behavior === 'calc_retiro');

      if (fechaVcHeader && withdrawalHeader) {
        const vcVal = formData[fechaVcHeader];
        const retVal = formData[withdrawalHeader];
        if (vcVal && retVal) {
          const vcDate = new Date(vcVal);
          const retDate = new Date(retVal);
          if (!isNaN(vcDate.getTime()) && !isNaN(retDate.getTime()) && retDate > vcDate) {
            errors[withdrawalHeader] = 'La fecha de retiro no puede ser posterior al vencimiento.';
          }
        }
      }
    }

    return errors;
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newForm = { ...formData, [name]: value };
    
    // Clear field error on change
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
                     const parts = currentExpiry.split('-');
                     if (parts.length === 3) {
                       const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
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

    try {
      setIsSaving(true);
      const rowValues = headers.map(h => formData[h] || '');

      if (editingItem) {
        await updateRow(activeSheet.title, editingItem._rowIndex, rowValues);
      } else {
        await appendRow(activeSheet.title, rowValues);
      }
      
      await fetchData();
      handleCloseModal();
    } catch (err: any) {
      alert(`Error guardando datos: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!activeSheet) return;
    const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar la fila ${item._rowIndex}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
      setLoading(true);
      await deleteRow(activeSheet.sheetId, item._rowIndex);
      await fetchData();
    } catch (err: any) {
      alert(`Error eliminando fila: ${err.message}`);
      setLoading(false);
    }
  };

  const copyPmReportToClipboard = () => {
    const lines = [
      '🚨 SOLICITUD DE PRECIO ESPECIAL / DRENAJE PARA PRODUCT MANAGER',
      `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
      `Total productos críticos: ${drainageReportItems.length}`,
      '------------------------------------------------------------'
    ];

    drainageReportItems.forEach((it, idx) => {
      const sku = it[Object.keys(it).find(k => /sku|código|codigo/i.test(k)) || 'SKU'] || '-';
      const desc = it[Object.keys(it).find(k => /nombre|desc|producto/i.test(k)) || ''] || '-';
      const fVc = it[Object.keys(it).find(k => /^FECHA_VC$|vencimiento/i.test(k)) || ''] || '-';
      const fRet = it[Object.keys(it).find(k => /retiro|canje/i.test(k)) || ''] || '-';
      const st = getItemStatus(it, Object.keys(it));
      lines.push(`${idx + 1}. [SKU: ${sku}] ${desc} | Vence: ${fVc} | Retiro: ${fRet} (${st.label})`);
    });

    lines.push('------------------------------------------------------------');
    lines.push('Acción requerida: Definir descuento o precio especial para drenar unidades antes de fecha de retiro.');

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  if (loading && !metadata) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Identify unmapped sheets (excluding technical/hidden sheets starting with _)
  const mappedSheets = [sheetConfig.main, sheetConfig.products, sheetConfig.policies].filter(Boolean);
  const otherSheets = metadata?.sheets
    .map((s: any) => s.properties.title)
    .filter((t: string) => !mappedSheets.includes(t) && !/^_/i.test(t.trim())) || [];

  return (
    <div className="flex h-full overflow-hidden bg-[#F8FAFC]">
      
      {/* SIDEBAR NAVIGATION */}
      <div className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 transition-all duration-300`}>
        <div className={`p-4 border-b border-slate-100 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Módulos</p>}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" title={isSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}>
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <SidebarItem 
              icon={<Database />} 
              label="Vencimientos & Radar" 
              active={activeView === 'main'} 
              onClick={() => { setActiveView('main'); setSelectedProduct(null); }}
              collapsed={isSidebarCollapsed}
            />
            <SidebarItem 
              icon={<Package />} 
              label="Catálogo Productos" 
              active={activeView === 'products'} 
              onClick={() => { setActiveView('products'); setSelectedProduct(null); }}
              collapsed={isSidebarCollapsed}
            />
            <SidebarItem 
              icon={<FileText />} 
              label="Políticas de Canje" 
              active={activeView === 'policies'} 
              onClick={() => { setActiveView('policies'); setSelectedProduct(null); }}
              collapsed={isSidebarCollapsed}
            />
            
            <div className="my-2 border-t border-slate-100"></div>
            
            <SidebarItem 
              icon={<TableProperties />} 
              label="Estructura de Datos" 
              active={activeView === 'schema'} 
              onClick={() => { setActiveView('schema'); setSelectedProduct(null); }}
              collapsed={isSidebarCollapsed}
            />
          </div>

          {otherSheets.length > 0 && (
            <div>
              {!isSidebarCollapsed ? (
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-3 border-t border-slate-100 pt-6">Otras Pestañas</p>
              ) : (
                <div className="border-t border-slate-100 pt-6 mb-3 mx-2"></div>
              )}
              <div className="flex flex-col gap-1">
                {otherSheets.map((title: string) => (
                  <SidebarItem 
                    key={title}
                    icon={<List />} 
                    label={title} 
                    active={activeView === title} 
                    onClick={() => { setActiveView(title); setSelectedProduct(null); }}
                    collapsed={isSidebarCollapsed}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={() => setIsConfigOpen(true)} 
            title={isSidebarCollapsed ? "Configuración" : undefined}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition-all`}
          >
            <Settings className="w-5 h-5 text-slate-400" />
            {!isSidebarCollapsed && "Configuración"}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-200 bg-white shrink-0 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              {activeView === 'main' ? 'Radar de Vencimientos & Drenaje' : 
               activeView === 'products' ? 'Catálogo de Productos' : 
               activeView === 'policies' ? 'Políticas de Canje' : 
               activeView === 'schema' ? 'Estructura de Datos' :
               activeSheet?.title || 'Vista'}
              {activeView === 'main' && pmMetrics.drainage > 0 && (
                <span className="text-xs px-2.5 py-1 bg-orange-100 text-orange-800 rounded-full font-bold border border-orange-200 animate-pulse flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-600" /> {pmMetrics.drainage} para PM
                </span>
              )}
            </h1>
            <div className="text-slate-500 mt-1 text-sm flex flex-wrap items-center gap-2">
              {activeView === 'schema' ? (
                <>
                  <TableProperties className="w-4 h-4 text-slate-400" />
                  <span>Configura relaciones ID Key, tipos de datos, visibilidad y reglas de cálculo</span>
                </>
              ) : activeSheet ? (
                <>
                  <LayoutTemplate className="w-4 h-4 text-slate-400" />
                  Pestaña <span className="font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{activeSheet.title}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-slate-600">
                    {searchTerm || pmRadarFilter !== 'all' ? `${filteredItems.length} de ${items.length} registros` : `${items.length} registros`}
                  </span>
                  {isRelationalActive && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wide flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-emerald-500" /> Relaciones ID Activas
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-orange-500 font-medium flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Módulo no configurado</span>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {activeView !== 'schema' && (
              <>
                {/* PM Report Button */}
                {activeView === 'main' && (
                  <button 
                    onClick={() => setIsPmReportOpen(true)}
                    className="text-sm bg-orange-50 text-orange-800 border border-orange-200 px-3.5 py-2 rounded-xl font-bold hover:bg-orange-100 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Send className="w-4 h-4 text-orange-600" />
                    <span>Reporte para PM</span>
                  </button>
                )}

                {/* Universal Search Bar */}
                <div className="relative w-full sm:w-64 md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Buscar en ${searchableHeaders.length} columnas...`}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/60 transition-colors"
                      title="Limpiar búsqueda"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button onClick={() => fetchData()} className="text-sm bg-white border border-slate-200 px-3 py-2 rounded-xl font-medium shadow-sm hover:bg-slate-50 flex items-center gap-1.5 text-slate-700 transition-colors">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button 
                  disabled={!activeSheet || isModalOpen} 
                  onClick={() => handleOpenModal()} 
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl font-bold shadow-md shadow-blue-200 flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all"
                >
                  <Plus className="w-4 h-4"/>
                  <span>Nuevo Registro</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* RADAR COMERCIAL & EVENT INCIDENT STRIP (Only in main view) */}
        {activeView === 'main' && activeSheet && (
          <div className="bg-white border-b border-slate-200 px-8 py-4 shrink-0 flex flex-col gap-4 shadow-sm">
            {/* Event Category Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* 1. Vencimientos */}
              <button
                onClick={() => {
                  setEventFilter(eventFilter === 'VENCIMIENTO' ? 'all' : 'VENCIMIENTO');
                  setPmRadarFilter('all');
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  eventFilter === 'VENCIMIENTO'
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-xl font-black text-slate-800 font-mono">{eventMetrics.vencimientos}</span>
                </div>
                <div className="mt-2.5">
                  <h4 className="text-xs font-bold text-slate-800">Vencimientos</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {eventMetrics.drainagePm > 0 ? (
                      <span className="text-orange-600 font-bold">{eventMetrics.drainagePm} alerta PM</span>
                    ) : (
                      'Control comercial'
                    )}
                  </p>
                </div>
              </button>

              {/* 2. Deterioro de Transporte */}
              <button
                onClick={() => {
                  setEventFilter(eventFilter === 'TRANSPORTE' ? 'all' : 'TRANSPORTE');
                  setPmRadarFilter('all');
                }}
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

              {/* 3. Diferencias de Pedido */}
              <button
                onClick={() => {
                  setEventFilter(eventFilter === 'DIFERENCIA' ? 'all' : 'DIFERENCIA');
                  setPmRadarFilter('all');
                }}
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
                  <p className="text-[10px] text-slate-500 mt-0.5">Faltante / sobrante</p>
                </div>
              </button>

              {/* 4. Avería Almacén */}
              <button
                onClick={() => {
                  setEventFilter(eventFilter === 'AVERIA' ? 'all' : 'AVERIA');
                  setPmRadarFilter('all');
                }}
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
                  <p className="text-[10px] text-slate-500 mt-0.5">Derrame o caída</p>
                </div>
              </button>

              {/* 5. Devolución Proveedor */}
              <button
                onClick={() => {
                  setEventFilter(eventFilter === 'DEVOLUCION' ? 'all' : 'DEVOLUCION');
                  setPmRadarFilter('all');
                }}
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
            </div>

            {/* Filter Navigation Bar & PM Radar Sub-filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mr-1">Filtrar:</span>
                
                <button 
                  onClick={() => { setEventFilter('all'); setPmRadarFilter('all'); }}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    eventFilter === 'all' && pmRadarFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({eventMetrics.total})
                </button>

                <button 
                  onClick={() => { setEventFilter('VENCIMIENTO'); }}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                    eventFilter === 'VENCIMIENTO'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' 
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Vencimientos ({eventMetrics.vencimientos})</span>
                </button>

                <button 
                  onClick={() => { setEventFilter('TRANSPORTE'); setPmRadarFilter('all'); }}
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
                  onClick={() => { setEventFilter('DIFERENCIA'); setPmRadarFilter('all'); }}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                    eventFilter === 'DIFERENCIA'
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-200' 
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Dif. Pedido ({eventMetrics.diferencia})</span>
                </button>

                <button 
                  onClick={() => { setEventFilter('AVERIA'); setPmRadarFilter('all'); }}
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
                  onClick={() => { setEventFilter('DEVOLUCION'); setPmRadarFilter('all'); }}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                    eventFilter === 'DEVOLUCION'
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-200' 
                      : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Devolución ({eventMetrics.devolucion})</span>
                </button>
              </div>

              {/* PM Radar Sub-filter (active when viewing all or vencimientos) */}
              {(eventFilter === 'all' || eventFilter === 'VENCIMIENTO') && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mr-1">Radar PM:</span>
                  
                  <button 
                    onClick={() => setPmRadarFilter('drainage')}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                      pmRadarFilter === 'drainage' 
                        ? 'bg-orange-600 text-white shadow-sm shadow-orange-200' 
                        : 'text-orange-800 hover:bg-orange-100'
                    }`}
                  >
                    <Flame className="w-3 h-3" />
                    <span>Drenaje PM ({pmMetrics.drainage})</span>
                  </button>

                  <button 
                    onClick={() => setPmRadarFilter('upcoming')}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                      pmRadarFilter === 'upcoming' 
                        ? 'bg-amber-600 text-white shadow-sm shadow-amber-200' 
                        : 'text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    <Clock3 className="w-3 h-3" />
                    <span>Próximos ({pmMetrics.upcoming})</span>
                  </button>

                  <button 
                    onClick={() => setPmRadarFilter('retire_now')}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                      pmRadarFilter === 'retire_now' 
                        ? 'bg-red-600 text-white shadow-sm shadow-red-200' 
                        : 'text-red-800 hover:bg-red-100'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Retirar Ya ({pmMetrics.retireNow})</span>
                  </button>
                </div>
              )}
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
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 max-w-6xl mx-auto">
              
              {/* Cloud Sync Status Banner (Multi-Option: Script Properties vs Sheet vs Local) */}
              {configStorageMode === 'properties' ? (
                <div className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-200">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                        Sincronización en la Nube Activa (Opción 2)
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 font-mono font-bold">
                          PropertiesService (Cero Hojas Extras)
                        </span>
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                        Toda la estructura de columnas, claves ID y políticas se guardan en el motor de Apps Script. Tu Google Sheet se mantiene 100% limpio y protegido.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setIsScriptModalOpen(true)}
                      className="px-3.5 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Code2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ver Código Script</span>
                    </button>
                    <button
                      onClick={handlePushPropertiesConfig}
                      disabled={isSyncingCloud}
                      className="px-3.5 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSyncingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                      <span>Guardar en Cloud</span>
                    </button>
                  </div>
                </div>
              ) : configStorageMode === 'sheet' || hasCloudConfigSheet ? (
                <div className="mb-6 bg-teal-50 border border-teal-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-teal-200">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-teal-950 flex items-center gap-2">
                        Sincronización en Pestaña Oculta (Opción 1)
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-200 text-teal-900 font-mono font-bold">
                          {cloudConfigSheetName}
                        </span>
                      </h4>
                      <p className="text-xs text-teal-800 mt-0.5 leading-relaxed">
                        La configuración está activa en la pestaña oculta <code className="font-mono font-bold">{cloudConfigSheetName}</code>. Puedes migrarla a <strong>PropertiesService (Opción 2)</strong> para no requerir pestañas extras.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => setIsScriptModalOpen(true)}
                      className="px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Code2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ver Código</span>
                    </button>
                    <button
                      onClick={handlePushPropertiesConfig}
                      disabled={isSyncingCloud}
                      title="Migrar y guardar directamente en Apps Script PropertiesService"
                      className="px-3.5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Migrar a Opción 2</span>
                    </button>
                    <button
                      onClick={handlePushCloudConfig}
                      disabled={isSyncingCloud}
                      className="px-3 py-2 text-xs font-bold bg-teal-700 text-white rounded-xl hover:bg-teal-800 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSyncingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                      <span>Guardar en Hoja</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-6 bg-slate-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center shrink-0">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Configuración Local
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                          Navegador
                        </span>
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        Guarda tu estructura en la nube con la <strong>Opción 2 (PropertiesService)</strong> para que todos los usuarios compartan la misma configuración sin alterar el Google Sheet.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => setIsScriptModalOpen(true)}
                      className="px-3 py-2 text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700 rounded-xl hover:bg-slate-700 shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Code2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Instrucciones & Código</span>
                    </button>
                    <button
                      onClick={handlePushPropertiesConfig}
                      disabled={isSyncingCloud}
                      className="px-3.5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-500 shadow-sm shadow-blue-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSyncingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>Activar Opción 2</span>
                    </button>
                  </div>
                </div>
              )}

              {syncSuccessMessage && (
                <div className="mb-6 bg-emerald-500 text-white rounded-xl p-3.5 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{syncSuccessMessage}</span>
                </div>
              )}

              <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-sm text-slate-700 font-medium leading-relaxed">
                  <strong>Editor de Metadatos y Relaciones Relacionales:</strong> Define claves primarias (ID Key), referencias entre tablas (Ref), columnas indexables para el buscador, y reglas de cálculo para cada pestaña de tu Google Sheet.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">Selecciona una pestaña para configurar:</label>
                <select 
                  className="w-full max-w-sm border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-blue-500 outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm bg-slate-50 disabled:opacity-50"
                  disabled={isSchemaLoading}
                  onChange={async (e) => {
                    const sheetTitle = e.target.value;
                    if (sheetTitle) {
                      const sheetProp = metadata?.sheets.find((s:any) => s.properties.title === sheetTitle)?.properties || null;
                      setActiveSheet(sheetProp);
                      
                      if (sheetProp) {
                        setIsSchemaLoading(true);
                        try {
                          const rows = await getSheetData(sheetProp.title);
                          if (rows.length > 0) {
                            setHeaders(rows[0]);
                          } else {
                            setHeaders([]);
                          }
                        } catch (err) {
                          console.error(err);
                          setHeaders([]);
                        } finally {
                          setIsSchemaLoading(false);
                        }
                      }
                    } else {
                      setActiveSheet(null);
                      setHeaders([]);
                    }
                  }}
                  value={activeSheet?.title || ''}
                >
                  <option value="">-- Seleccionar Pestaña --</option>
                  {metadata?.sheets
                    .filter((s: any) => !/^_/i.test(s.properties.title))
                    .map((s: any) => (
                      <option key={s.properties.sheetId} value={s.properties.title}>{s.properties.title}</option>
                    ))}
                </select>
              </div>

              {isSchemaLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              )}
              
              {!isSchemaLoading && activeSheet && headers.length === 0 && (
                <div className="py-8 text-center text-slate-500">
                  La pestaña seleccionada está vacía. Necesita al menos una fila de encabezados.
                </div>
              )}

              {!isSchemaLoading && activeSheet && headers.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase">Columna</th>
                        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center w-24">ID Key</th>
                        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Visible</th>
                        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center w-28">Indexable</th>
                        <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase w-48">Tipo de Dato</th>
                        <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase">Opciones / Referencia</th>
                        <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase w-56">Automatización</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {headers.map((header) => {
                        const isNaturalKey = /^ID_VC$|^ID_EVENTO$|^ID$|^SKU$/i.test(header.trim());
                        const schema: ColumnSchema = sheetConfig.schema?.[activeSheet.title]?.[header] || { 
                          visible: true, 
                          searchable: true, 
                          type: (/fecha|vencimiento|retiro/i.test(header) ? 'date' : (/sku/i.test(header) && activeView === 'main' ? 'ref' : 'text')), 
                          behavior: (isNaturalKey && /^ID_VC$/i.test(header.trim()) ? 'auto_id' : 'none'),
                          isKey: isNaturalKey,
                          options: '',
                          refTable: sheetConfig.products || ''
                        };
                        
                        const updateCol = (key: keyof ColumnSchema, value: any) => {
                          const newSchema = { ...sheetConfig.schema };
                          if (!newSchema[activeSheet.title]) newSchema[activeSheet.title] = {};
                          newSchema[activeSheet.title][header] = { ...schema, [key]: value };
                          saveConfig({ ...sheetConfig, schema: newSchema });
                        };

                        const isEnum = schema.type === 'enum' || schema.type === 'enumlist';
                        const isRef = schema.type === 'ref';

                        return (
                          <tr key={header} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-4 text-sm font-bold text-slate-700 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span>{header}</span>
                                {schema.isKey && (
                                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                                    <Key className="w-3 h-3 text-amber-600" /> KEY
                                  </span>
                                )}
                                {schema.behavior !== 'none' && (
                                  <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono font-bold">
                                    {schema.behavior}
                                  </span>
                                )}
                              </div>
                            </td>
                            
                            {/* Key Toggle */}
                            <td className="px-4 py-4 text-center">
                              <button 
                                onClick={() => updateCol('isKey', !schema.isKey)}
                                title={schema.isKey ? "Columna clave primaria (ID)" : "Marcar como clave primaria"}
                                className={`p-2 rounded-lg transition-colors ${schema.isKey ? 'text-amber-600 hover:bg-amber-50 bg-amber-50/60' : 'text-slate-300 hover:bg-slate-100'}`}
                              >
                                <Key className="w-4 h-4" />
                              </button>
                            </td>

                            {/* Visible Toggle */}
                            <td className="px-4 py-4 text-center">
                              <button 
                                onClick={() => updateCol('visible', schema.visible === false ? true : false)}
                                title={schema.visible !== false ? "Visible en la tabla principal" : "Oculto en la tabla principal"}
                                className={`p-2 rounded-lg transition-colors ${schema.visible !== false ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-300 hover:bg-slate-100'}`}
                              >
                                {schema.visible !== false ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                              </button>
                            </td>

                            {/* Searchable Toggle */}
                            <td className="px-4 py-4 text-center">
                              <button 
                                onClick={() => updateCol('searchable', schema.searchable === false ? true : false)}
                                title={schema.searchable !== false ? "Indexado en el buscador universal" : "Ignorado en el buscador"}
                                className={`p-2 rounded-lg transition-colors ${schema.searchable !== false ? 'text-emerald-600 hover:bg-emerald-50 bg-emerald-50/50' : 'text-slate-300 hover:bg-slate-100'}`}
                              >
                                <Search className="w-4 h-4 inline" />
                              </button>
                            </td>

                            {/* Data Type */}
                            <td className="px-5 py-4">
                              <select 
                                value={schema.type || 'text'}
                                onChange={(e) => updateCol('type', e.target.value as ColumnType)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-500 outline-none font-medium"
                              >
                                <option value="text">Texto (Text)</option>
                                <option value="longtext">Texto Largo (LongText)</option>
                                <option value="number">Número (Number)</option>
                                <option value="date">Fecha (Date)</option>
                                <option value="datetime">Fecha y Hora (DateTime)</option>
                                <option value="enum">Selección Única (Enum)</option>
                                <option value="enumlist">Selección Múltiple (EnumList)</option>
                                <option value="ref">Referencia / Relación (Ref)</option>
                                <option value="calculated">Calculada (Calculated)</option>
                              </select>
                            </td>

                            {/* Options / Ref Config */}
                            <td className="px-5 py-4">
                              {isRef ? (
                                <div>
                                  <select
                                    value={schema.refTable || ''}
                                    onChange={(e) => updateCol('refTable', e.target.value)}
                                    className="w-full border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs bg-blue-50/50 text-blue-900 focus:border-blue-500 outline-none font-medium"
                                  >
                                    <option value="">-- Tabla Destino (Ref) --</option>
                                    {metadata?.sheets.map((s: any) => (
                                      <option key={s.properties.sheetId} value={s.properties.title}>
                                        {s.properties.title}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="text-[10px] text-blue-600 mt-0.5 block flex items-center gap-1">
                                    <Link2 className="w-3 h-3" /> Relacionada por clave ID
                                  </span>
                                </div>
                              ) : isEnum ? (
                                <div>
                                  <input 
                                    type="text"
                                    placeholder="Ej: Activo, Pendiente, Cancelado"
                                    value={schema.options || ''}
                                    onChange={(e) => updateCol('options', e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:border-blue-500 outline-none placeholder:text-slate-300"
                                  />
                                  <span className="text-[10px] text-slate-400 mt-0.5 block">Separadas por coma</span>
                                </div>
                              ) : schema.type === 'calculated' ? (
                                <span className="text-xs text-slate-400 italic">Definida por automatización</span>
                              ) : (
                                <span className="text-xs text-slate-300 font-mono">-</span>
                              )}
                            </td>

                            {/* Behavior */}
                            <td className="px-5 py-4">
                              <select 
                                value={schema.behavior || 'none'}
                                onChange={(e) => updateCol('behavior', e.target.value as ColumnBehavior)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-500 outline-none"
                              >
                                <option value="none">-- Sin automatización --</option>
                                <option value="auto_id">Generar ID Único (auto_id)</option>
                                <option value="calc_fecha_vc">Calcular Fecha VC (MM/YYYY)</option>
                                <option value="calc_retiro">Calcular Retiro (Política)</option>
                                <option value="sku_lookup">Autocompletar Relacional</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-16">Fila</th>
                      
                      {/* Tipo de Evento Column in Main View */}
                      {activeView === 'main' && (
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          Tipo de Evento
                        </th>
                      )}

                      {/* Estado Semáforo / Incidencia Column in Main View */}
                      {activeView === 'main' && (
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          Estado / Radar PM
                        </th>
                      )}

                      {headers.filter(h => sheetConfig.schema?.[activeSheet.title]?.[h]?.visible !== false).map((header, i) => {
                        const colSchema = sheetConfig.schema?.[activeSheet.title]?.[header];
                        const isKeyCol = colSchema?.isKey || /^ID_VC$|^ID$|^SKU$/i.test(header.trim());
                        return (
                          <th key={i} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isKeyCol && <Key className="w-3.5 h-3.5 text-amber-500" title="Columna Clave Primaria (ID)" />}
                              <span>{header}</span>
                              {colSchema?.searchable !== false && (
                                <Search className="w-3 h-3 text-slate-300 inline" title="Columna indexada en búsqueda" />
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={headers.filter(h => sheetConfig.schema?.[activeSheet.title]?.[h]?.visible !== false).length + (activeView === 'main' ? 3 : 1)} className="px-6 py-12 text-center text-sm text-slate-500">
                          {searchTerm 
                            ? `No se encontraron registros que coincidan con "${searchTerm}".`
                            : eventFilter !== 'all'
                              ? `No hay registros categorizados como "${EVENT_CATEGORIES[eventFilter]?.name}".`
                              : pmRadarFilter !== 'all'
                                ? `No hay registros en el filtro de radar "${pmRadarFilter}".`
                                : headers.length === 0 
                                  ? "La pestaña está vacía o cargando."
                                  : "No hay registros en esta pestaña."}
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => {
                        const itemCategory = activeView === 'main' ? getEventCategory(item, headers) : 'VENCIMIENTO';
                        const itemStatus = activeView === 'main' ? getItemStatus(item, headers) : null;
                        const catDef = EVENT_CATEGORIES[itemCategory];

                        return (
                          <tr 
                            key={idx} 
                            className={`cursor-pointer transition-colors ${editingItem?._rowIndex === item._rowIndex ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`} 
                            onClick={() => {
                              if (activeView === 'products') {
                                setSelectedProduct(item);
                              } else {
                                handleOpenModal(item);
                              }
                            }}
                          >
                            <td className="px-6 py-4 text-sm font-mono font-medium text-slate-400">
                              {item._rowIndex}
                            </td>

                            {/* Event Category Badge in Main View */}
                            {activeView === 'main' && (
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 w-fit ${catDef.badgeBg} ${catDef.badgeText} ${catDef.badgeBorder}`}>
                                  {renderEventIcon(itemCategory, 'w-3.5 h-3.5')}
                                  <span>{catDef.shortLabel}</span>
                                </span>
                              </td>
                            )}

                            {/* Status badge in main view */}
                            {activeView === 'main' && (
                              <td className="px-6 py-4 whitespace-nowrap">
                                {itemCategory === 'VENCIMIENTO' && itemStatus ? (
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 w-fit ${itemStatus.color}`}>
                                    {itemStatus.icon}
                                    <span>{itemStatus.label}</span>
                                  </span>
                                ) : (
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 w-fit ${catDef.badgeBg} ${catDef.badgeText} ${catDef.badgeBorder}`}>
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Incidencia Registrada</span>
                                  </span>
                                )}
                              </td>
                            )}

                            {headers.filter(h => sheetConfig.schema?.[activeSheet.title]?.[h]?.visible !== false).map((header, i) => {
                              const rawVal = item[header];
                              const colSchema = sheetConfig.schema?.[activeSheet.title]?.[header];
                              const isKeyCol = colSchema?.isKey || /^ID_VC$|^ID$|^SKU$/i.test(header.trim());

                              return (
                                <td key={i} className="px-6 py-4 text-sm font-medium text-slate-700 max-w-xs truncate">
                                  {(() => {
                                    if (!rawVal) return <span className="text-slate-300">-</span>;

                                    if (isKeyCol) {
                                      return (
                                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                          {rawVal}
                                        </span>
                                      );
                                    }

                                    // EnumList display
                                    if (colSchema?.type === 'enumlist') {
                                      const tags = String(rawVal).split(',').map(s => s.trim()).filter(Boolean);
                                      return (
                                        <div className="flex flex-wrap gap-1">
                                          {tags.map((t, tidx) => (
                                            <span key={tidx} className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                              {t}
                                            </span>
                                          ))}
                                        </div>
                                      );
                                    }

                                    // Enum display
                                    if (colSchema?.type === 'enum') {
                                      return (
                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                          {rawVal}
                                        </span>
                                      );
                                    }

                                    // Number display
                                    if (colSchema?.type === 'number') {
                                      return <span className="font-mono">{rawVal}</span>;
                                    }

                                    return rawVal;
                                  })()}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MASTER-DETAIL PRODUCT DRAWER (When viewing a product in CATALOGO) */}
        {selectedProduct && (
          <div className="absolute inset-0 z-40 flex justify-end bg-slate-900/20 backdrop-blur-sm">
            <div className="w-full max-w-xl h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">
                      {selectedProduct[Object.keys(selectedProduct).find(k => /nombre|desc|producto/i.test(k)) || ''] || 'Detalle del Producto'}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      SKU Key: <span className="font-bold text-blue-600">{selectedProduct[Object.keys(selectedProduct).find(k => /sku|código|codigo/i.test(k)) || 'SKU']}</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProduct(null)} 
                  className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Product Fields Summary */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                  {Object.keys(selectedProduct).filter(k => k !== '_rowIndex').map((k) => (
                    <div key={k}>
                      <span className="font-bold text-slate-400 uppercase text-[10px] block">{k}</span>
                      <span className="font-semibold text-slate-700">{selectedProduct[k] || '-'}</span>
                    </div>
                  ))}
                </div>

                {/* Master-Detail Related Items (Vencimientos & Incidencias) */}
                <div className="space-y-6">
                  {/* Action Buttons for this Product */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const skuVal = selectedProduct[Object.keys(selectedProduct).find(k => /sku|código|codigo/i.test(k)) || 'SKU'];
                        handleOpenModal(undefined, skuVal, 'VENCIMIENTO');
                      }}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-1.5 shadow-sm shadow-blue-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Vencimiento</span>
                    </button>
                    <button
                      onClick={() => {
                        const skuVal = selectedProduct[Object.keys(selectedProduct).find(k => /sku|código|codigo/i.test(k)) || 'SKU'];
                        handleOpenModal(undefined, skuVal, 'TRANSPORTE');
                      }}
                      className="flex-1 px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 flex items-center justify-center gap-1.5 shadow-sm shadow-amber-200"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>+ Incidencia / Evento</span>
                    </button>
                  </div>

                  {(() => {
                    const skuVal = selectedProduct[Object.keys(selectedProduct).find(k => /sku|código|codigo/i.test(k)) || 'SKU'];
                    const related = allMainItems.filter(it => {
                      const itSku = it[Object.keys(it).find(k => /sku|código|codigo/i.test(k)) || ''];
                      return String(itSku).trim() === String(skuVal).trim();
                    });

                    const vencimientos = related.filter(it => getEventCategory(it, Object.keys(it)) === 'VENCIMIENTO');
                    const incidencias = related.filter(it => getEventCategory(it, Object.keys(it)) !== 'VENCIMIENTO');

                    return (
                      <>
                        {/* 1. Vencimientos */}
                        <div>
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-blue-600" />
                              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                                Vencimientos ({vencimientos.length})
                              </h4>
                            </div>
                          </div>

                          {vencimientos.length === 0 ? (
                            <div className="text-center py-5 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-3">
                              <p className="text-xs text-slate-500">Sin registros de fecha de vencimiento.</p>
                            </div>
                          ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="p-2.5">ID_VC</th>
                                    <th className="p-2.5">Vencimiento</th>
                                    <th className="p-2.5">Retiro</th>
                                    <th className="p-2.5">Estado PM</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {vencimientos.map((it, idx) => {
                                    const st = getItemStatus(it, Object.keys(it));
                                    const idVc = it[Object.keys(it).find(k => /^ID_VC$/i.test(k)) || 'ID_VC'] || `#${it._rowIndex}`;
                                    const fVc = it[Object.keys(it).find(k => /^FECHA_VC$|vencimiento/i.test(k)) || ''] || '-';
                                    const fRet = it[Object.keys(it).find(k => /retiro|canje/i.test(k)) || ''] || '-';

                                    return (
                                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-2.5 font-mono font-bold text-blue-600">{idVc}</td>
                                        <td className="p-2.5 font-medium text-slate-700">{fVc}</td>
                                        <td className="p-2.5 font-medium text-slate-700">{fRet}</td>
                                        <td className="p-2.5">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${st.color}`}>
                                            {st.icon}
                                            <span>{st.label}</span>
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* 2. Incidencias y Eventos */}
                        <div>
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <FileWarning className="w-4 h-4 text-amber-600" />
                              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                                Incidencias y Eventos ({incidencias.length})
                              </h4>
                            </div>
                          </div>

                          {incidencias.length === 0 ? (
                            <div className="text-center py-5 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-3">
                              <p className="text-xs text-slate-500">Sin incidencias de transporte, diferencias o mermas.</p>
                            </div>
                          ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="p-2.5">ID</th>
                                    <th className="p-2.5">Tipo Incidencia</th>
                                    <th className="p-2.5">Detalle</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {incidencias.map((it, idx) => {
                                    const cat = getEventCategory(it, Object.keys(it));
                                    const catDef = EVENT_CATEGORIES[cat];
                                    const idVc = it[Object.keys(it).find(k => /^ID_VC$/i.test(k)) || 'ID_VC'] || `#${it._rowIndex}`;
                                    const obs = it[Object.keys(it).find(k => /obs|motivo|detalle|comentario/i.test(k)) || ''] || '-';

                                    return (
                                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-2.5 font-mono font-bold text-blue-600">{idVc}</td>
                                        <td className="p-2.5">
                                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 ${catDef.badgeBg} ${catDef.badgeText} ${catDef.badgeBorder}`}>
                                            {renderEventIcon(cat, 'w-3 h-3')}
                                            <span>{catDef.shortLabel}</span>
                                          </span>
                                        </td>
                                        <td className="p-2.5 text-slate-600 font-medium truncate max-w-[120px]">{obs}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PM DRAINAGE REPORT MODAL */}
        {isPmReportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-orange-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-500 text-white rounded-xl shadow-md shadow-orange-200">
                    <Flame className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Reporte de Drenaje para Product Manager (PM)</h3>
                    <p className="text-xs text-orange-800">
                      Productos con vencimiento próximo para solicitar precio especial o descuento de liquidación.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPmReportOpen(false)} 
                  className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {drainageReportItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <h4 className="font-bold text-slate-700">¡Todo en orden!</h4>
                    <p className="text-xs text-slate-400 mt-1">No hay productos en ventana crítica de retiro actualmente.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">SKU</th>
                          <th className="p-3">Producto / Descripción</th>
                          <th className="p-3">Vencimiento</th>
                          <th className="p-3">Fecha Retiro</th>
                          <th className="p-3">Días Restantes</th>
                          <th className="p-3">Estado Comercial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {drainageReportItems.map((it, idx) => {
                          const st = getItemStatus(it, Object.keys(it));
                          const sku = it[Object.keys(it).find(k => /sku|código|codigo/i.test(k)) || 'SKU'] || '-';
                          const desc = it[Object.keys(it).find(k => /nombre|desc|producto/i.test(k)) || ''] || '-';
                          const fVc = it[Object.keys(it).find(k => /^FECHA_VC$|vencimiento/i.test(k)) || ''] || '-';
                          const fRet = it[Object.keys(it).find(k => /retiro|canje/i.test(k)) || ''] || '-';

                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-mono font-bold text-blue-600">{sku}</td>
                              <td className="p-3 font-medium text-slate-800">{desc}</td>
                              <td className="p-3 font-medium text-slate-600">{fVc}</td>
                              <td className="p-3 font-medium text-slate-600">{fRet}</td>
                              <td className="p-3 font-mono font-bold text-slate-800">{st.daysToRetire ?? '-'} días</td>
                              <td className="p-3">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${st.color}`}>
                                  {st.icon}
                                  <span>{st.label}</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 font-medium">
                  {drainageReportItems.length} registros listos para enviar al PM
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPmReportOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={copyPmReportToClipboard}
                    disabled={drainageReportItems.length === 0}
                    className="px-4 py-2 bg-orange-600 text-white font-bold text-xs rounded-xl hover:bg-orange-700 flex items-center gap-1.5 shadow-sm shadow-orange-200 disabled:opacity-50"
                  >
                    {copiedReport ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedReport ? '¡Copiado al Portapapeles!' : 'Copiar Resumen para PM'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Modal (Overlay) */}
        {isModalOpen && (
          <div className="absolute inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm">
            <div className="w-[460px] h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">
                    {editingItem ? `Editar Fila ${editingItem._rowIndex}` : 'Nuevo Registro'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {activeView === 'main' ? 'Gestión de vencimientos e incidencias de producto' : activeSheet?.title}
                  </p>
                </div>
                <button onClick={handleCloseModal} className="text-slate-400 hover:bg-slate-100 hover:text-slate-700 p-2 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 flex flex-col gap-5 overflow-y-auto flex-1">
                  
                  {/* Event Category Selector in Main View */}
                  {activeView === 'main' && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <label className="block text-[11px] uppercase font-bold text-slate-500 mb-2.5 tracking-wider flex items-center gap-1.5">
                        <FileWarning className="w-3.5 h-3.5 text-blue-600" />
                        <span>Clasificación del Evento</span>
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(EVENT_CATEGORIES).map((cat) => {
                          const isSelected = selectedEventCategory === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => handleSelectEventCategory(cat.id)}
                              className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                                isSelected 
                                  ? `${cat.cardBorder} shadow-sm` 
                                  : 'border-slate-200 bg-white hover:bg-slate-100'
                              } ${cat.id === 'DEVOLUCION' ? 'col-span-2' : ''}`}
                            >
                              <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? cat.cardBg : 'bg-slate-100 text-slate-600'}`}>
                                {renderEventIcon(cat.id, 'w-3.5 h-3.5')}
                              </div>
                              <div className="min-w-0">
                                <span className={`text-xs font-bold block truncate ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                                  {cat.name}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Selected Category Explainer Banner */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-start gap-2 text-[11px] text-slate-600">
                        <span className="shrink-0 mt-0.5">{renderEventIcon(selectedEventCategory, 'w-3.5 h-3.5 text-blue-600')}</span>
                        <span>{EVENT_CATEGORIES[selectedEventCategory].description}</span>
                      </div>
                    </div>
                  )}

                  {headers.map((header) => {
                    const colSchema = activeSheet ? sheetConfig.schema?.[activeSheet.title]?.[header] : undefined;
                    
                    const isDate = /fecha|vencimiento|retiro|caducidad/i.test(header);
                    const isSku = /sku|código|codigo/i.test(header);
                    const isIdVc = /^ID_VC$/i.test(header.trim());
                    const isFechaVc = /^FECHA_VC$/i.test(header.trim());
                    const isEventHeader = /tipo.*evento|evento|tipo.*registro|incidencia|categor[ií]a/i.test(header);
                    
                    const hasMmYyyy = headers.some(h => /^MM$/i.test(h.trim())) && headers.some(h => /^YYYY$/i.test(h.trim()));
                    const isAutoCalculated = isIdVc || (isFechaVc && hasMmYyyy) || colSchema?.behavior === 'auto_id' || colSchema?.behavior === 'calc_fecha_vc' || colSchema?.behavior === 'calc_retiro' || colSchema?.type === 'calculated';
                    const prodSkuCol = products.length > 0 ? Object.keys(products[0]).find(k => /sku|código|codigo/i.test(k)) : null;

                    const effectiveType: ColumnType = colSchema?.type || (isDate ? 'date' : (isSku ? 'ref' : 'text'));

                    return (
                      <div key={header}>
                        <label className="block text-[11px] uppercase font-bold text-slate-500 mb-2 flex justify-between items-center tracking-wide">
                          <div className="flex items-center gap-1.5">
                            {colSchema?.isKey && <Key className="w-3.5 h-3.5 text-amber-500" />}
                            <span>{header}</span>
                            <span className="text-[9px] font-normal text-slate-400 lowercase">({effectiveType})</span>
                          </div>
                          {isSku && isRelationalActive && activeView === 'main' && (
                            <span className="text-blue-500 flex items-center text-[9px]"><Zap className="w-3 h-3 mr-0.5 fill-blue-500"/> AUTOFILL</span>
                          )}
                          {isAutoCalculated && (
                            <span className="text-emerald-600 flex items-center text-[9px] tracking-widest font-mono"><Zap className="w-3 h-3 mr-0.5 fill-emerald-500"/> CALC</span>
                          )}
                        </label>

                        {/* RENDER BY TYPE */}
                        {(() => {
                          if (isEventHeader) {
                            return (
                              <div className="relative">
                                <input
                                  type="text"
                                  name={header}
                                  value={formData[header] || EVENT_CATEGORIES[selectedEventCategory].name}
                                  readOnly
                                  className="w-full border rounded-xl px-4 py-3 text-sm font-bold bg-slate-50 border-slate-200 text-slate-700 cursor-not-allowed shadow-inner"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                                  {renderEventIcon(selectedEventCategory, 'w-3 h-3')} Sincronizado
                                </span>
                              </div>
                            );
                          }

                          if (isAutoCalculated) {
                            return (
                              <div className="relative">
                                <input
                                  type="text"
                                  name={header}
                                  value={formData[header] || ''}
                                  readOnly
                                  placeholder="Calculado automáticamente..."
                                  className="w-full border rounded-xl px-4 py-3 text-sm font-mono font-medium bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed shadow-inner"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-200/70 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                                  <Calculator className="w-3 h-3" /> Auto
                                </span>
                              </div>
                            );
                          }

                          if (effectiveType === 'ref' && products.length > 0) {
                            const prodSkuKey = Object.keys(products[0]).find(k => /sku|código|codigo/i.test(k)) || Object.keys(products[0])[0];
                            const prodDescKey = Object.keys(products[0]).find(k => /nombre|desc|producto/i.test(k)) || prodSkuKey;

                            return (
                              <div>
                                <select
                                  name={header}
                                  value={formData[header] || ''}
                                  onChange={handleFormChange as any}
                                  className={`w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none bg-white shadow-sm transition-colors ${
                                    formErrors[header] 
                                      ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
                                      : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                                  }`}
                                >
                                  <option value="">-- Seleccionar Producto Relacionado --</option>
                                  {products.map((p, i) => (
                                    <option key={i} value={p[prodSkuKey]}>
                                      {p[prodSkuKey]} - {p[prodDescKey]}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[10px] text-blue-600 mt-1 block flex items-center gap-1">
                                  <Link2 className="w-3 h-3" /> Relación Ref directa con Catálogo de Productos
                                </span>
                              </div>
                            );
                          }

                          if (effectiveType === 'longtext') {
                            return (
                              <textarea
                                name={header}
                                rows={3}
                                value={formData[header] || ''}
                                onChange={handleFormChange}
                                placeholder={`Ingresa ${header}...`}
                                className={`w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none bg-white shadow-sm resize-none transition-colors ${
                                  formErrors[header] 
                                    ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
                                    : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                                }`}
                              />
                            );
                          }

                          if (effectiveType === 'number') {
                            return (
                              <input
                                type="number"
                                step="any"
                                name={header}
                                value={formData[header] || ''}
                                onChange={handleFormChange}
                                placeholder="0.00"
                                className={`w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none bg-white shadow-sm font-mono transition-colors ${
                                  formErrors[header] 
                                    ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
                                    : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                                }`}
                              />
                            );
                          }

                          if (effectiveType === 'date') {
                            return (
                              <input
                                type="date"
                                name={header}
                                value={formData[header] || ''}
                                onChange={handleFormChange}
                                className={`w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none bg-white shadow-sm transition-colors ${
                                  formErrors[header] 
                                    ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
                                    : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                                }`}
                              />
                            );
                          }

                          if (effectiveType === 'datetime') {
                            return (
                              <input
                                type="datetime-local"
                                name={header}
                                value={formData[header] || ''}
                                onChange={handleFormChange}
                                className={`w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none bg-white shadow-sm transition-colors ${
                                  formErrors[header] 
                                    ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
                                    : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                                }`}
                              />
                            );
                          }

                          if (effectiveType === 'enum') {
                            const opts = colSchema?.options?.split(',').map(s => s.trim()).filter(Boolean) || [];
                            return (
                              <select
                                name={header}
                                value={formData[header] || ''}
                                onChange={handleFormChange as any}
                                className={`w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none bg-white shadow-sm transition-colors ${
                                  formErrors[header] 
                                    ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
                                    : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                                }`}
                              >
                                <option value="">-- Seleccionar --</option>
                                {opts.map((opt, i) => (
                                  <option key={i} value={opt}>{opt}</option>
                                ))}
                              </select>
                            );
                          }

                          if (effectiveType === 'enumlist') {
                            const opts = colSchema?.options?.split(',').map(s => s.trim()).filter(Boolean) || [];
                            const selectedValues = (formData[header] || '').split(',').map(s => s.trim()).filter(Boolean);
                            const toggleValue = (val: string) => {
                              const exists = selectedValues.includes(val);
                              const next = exists ? selectedValues.filter(v => v !== val) : [...selectedValues, val];
                              setFormData({ ...formData, [header]: next.join(', ') });
                            };

                            return (
                              <div className={`flex flex-wrap gap-2 p-3 border rounded-xl bg-slate-50/50 ${
                                formErrors[header] ? 'border-red-400' : 'border-slate-200'
                              }`}>
                                {opts.length === 0 ? (
                                  <span className="text-xs text-slate-400 italic p-1">No hay opciones definidas en Estructura de Datos.</span>
                                ) : (
                                  opts.map((opt, i) => {
                                    const isSelected = selectedValues.includes(opt);
                                    return (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => toggleValue(opt)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                          isSelected 
                                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' 
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                      >
                                        {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 opacity-40" />}
                                        {opt}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            );
                          }

                          // Default Text input with optional SKU datalist
                          return (
                            <>
                              <input
                                type="text"
                                name={header}
                                list={isSku ? `datalist-${header}` : undefined}
                                value={formData[header] || ''}
                                onChange={handleFormChange}
                                className={`w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none bg-white shadow-sm transition-colors ${
                                  formErrors[header] 
                                    ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
                                    : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                                }`}
                              />
                              {isSku && prodSkuCol && activeView === 'main' && (
                                <datalist id={`datalist-${header}`}>
                                  {products.map((p, i) => (
                                    <option key={i} value={p[prodSkuCol]}>
                                      {p[Object.keys(p).find(k => /nombre|desc|producto/i.test(k)) || prodSkuCol]}
                                    </option>
                                  ))}
                                </datalist>
                              )}
                            </>
                          );
                        })()}

                        {/* FIELD ERROR MESSAGE */}
                        {formErrors[header] && (
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-red-600 font-semibold animate-in fade-in">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>{formErrors[header]}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
                  {editingItem ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingItem)}
                      className="text-xs font-bold text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      Eliminar Fila
                    </button>
                  ) : <div></div>}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-200 flex items-center gap-2 disabled:opacity-50 transition-all"
                    >
                      {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Guardar</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Global Config Modal */}
        {isConfigOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-800 text-base">Asignar Pestañas del Sistema</h3>
                <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 p-2 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pestaña Principal (Vencimientos)</label>
                  <select 
                    value={sheetConfig.main} 
                    onChange={(e) => saveConfig({ ...sheetConfig, main: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Seleccionar --</option>
                    {metadata?.sheets
                      .filter((s: any) => !/^_/i.test(s.properties.title))
                      .map((s: any) => (
                        <option key={s.properties.sheetId} value={s.properties.title}>{s.properties.title}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Catálogo de Productos</label>
                  <select 
                    value={sheetConfig.products} 
                    onChange={(e) => saveConfig({ ...sheetConfig, products: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Seleccionar --</option>
                    {metadata?.sheets
                      .filter((s: any) => !/^_/i.test(s.properties.title))
                      .map((s: any) => (
                        <option key={s.properties.sheetId} value={s.properties.title}>{s.properties.title}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Políticas de Canje</label>
                  <select 
                    value={sheetConfig.policies} 
                    onChange={(e) => saveConfig({ ...sheetConfig, policies: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Seleccionar --</option>
                    {metadata?.sheets
                      .filter((s: any) => !/^_/i.test(s.properties.title))
                      .map((s: any) => (
                        <option key={s.properties.sheetId} value={s.properties.title}>{s.properties.title}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button onClick={() => setIsConfigOpen(false)} className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors">
                  Listo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Apps Script Code Modal (Option 2 Deployment Guide) */}
        {isScriptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Google Apps Script (Code.gs)</h3>
                    <p className="text-xs text-slate-400">Código con soporte integrado para PropertiesService (Opción 2)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsScriptModalOpen(false)} 
                  className="text-slate-400 hover:bg-slate-800 hover:text-white p-2 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex flex-col gap-5 text-sm text-slate-600">
                {/* 3 Step Guide */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mb-2">1</span>
                    <strong className="text-xs font-bold text-slate-800">Abre Apps Script</strong>
                    <span className="text-[11px] text-slate-500 mt-1">En tu Google Sheet: <em>Extensiones &gt; Apps Script</em></span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mb-2">2</span>
                    <strong className="text-xs font-bold text-slate-800">Pega el Código</strong>
                    <span className="text-[11px] text-slate-500 mt-1">Reemplaza todo el archivo <code>Code.gs</code> con el código de abajo.</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mb-2">3</span>
                    <strong className="text-xs font-bold text-slate-800">Nueva Implementación</strong>
                    <span className="text-[11px] text-slate-500 mt-1">Implementar &gt; Nueva impl. &gt; App web &gt; Acceso: <strong>Cualquiera</strong>.</span>
                  </div>
                </div>

                {/* Code Container */}
                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs text-slate-200">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
                    <span className="text-[11px] text-slate-400 font-sans font-bold flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      Code.gs
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
                        setCopiedScriptCode(true);
                        setTimeout(() => setCopiedScriptCode(false), 3000);
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-sans font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      {copiedScriptCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedScriptCode ? '¡Copiado!' : 'Copiar Código'}</span>
                    </button>
                  </div>
                  <pre className="p-4 max-h-60 overflow-y-auto leading-relaxed select-all">
                    {APPS_SCRIPT_TEMPLATE}
                  </pre>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Al terminar de implementar, presiona <strong>Guardar en Cloud / Activar Opción 2</strong> en la sección de Estructura.
                </span>
                <button 
                  onClick={() => setIsScriptModalOpen(false)} 
                  className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
