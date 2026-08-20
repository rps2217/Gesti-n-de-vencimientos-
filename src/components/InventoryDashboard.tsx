import React, { useEffect, useState, useMemo } from 'react';
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
import { 
  Plus, Edit2, Trash2, RefreshCw, Loader2, Database, AlertCircle, Package, 
  FileSpreadsheet, FileText, Search, X, Truck, RotateCcw, 
  PackageX, Sparkles, Clock, Clock3, Flame, AlertTriangle, CheckCircle2, 
  Sliders, Link2
} from 'lucide-react';

// Utilities & Hooks
import { 
  EVENT_CATEGORIES, 
  renderEventIcon, 
  parseAnyDate, 
  getEventCategory, 
  getItemStatus 
} from '../utils/dateCalculations';
import { useColumnResize } from '../hooks/useColumnResize';

// Modals & Drawers & Sub-components
import { Sidebar } from './navigation/Sidebar';
import { SchemaEditorView } from './views/SchemaEditorView';
import { AnalyticsDashboard } from './views/AnalyticsDashboard';
import { ItemDetailDrawer } from './drawers/ItemDetailDrawer';
import { ItemFormModal } from './modals/ItemFormModal';
import { PmReportModal } from './modals/PmReportModal';
import { ScriptCodeModal } from './modals/ScriptCodeModal';
import { GlobalConfigModal } from './modals/GlobalConfigModal';
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

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<EventCategory | 'all'>('all');
  const [pmRadarFilter, setPmRadarFilter] = useState<'all' | 'drainage' | 'upcoming' | 'retire_now'>('all');

  // Sheet configuration state
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(() => {
    try {
      const saved = localStorage.getItem('appsheet_clone_config');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeView, setActiveView] = useState<string>('main');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
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
    return headers.filter(h => sheetConfig.schema?.[activeSheet.title]?.[h]?.visible !== false);
  }, [headers, activeSheet, sheetConfig.schema]);

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
        if (pmRadarFilter === 'en_regla') return st.code === 'GOOD';
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

    headers.forEach(header => {
      const val = (formData[header] || '').trim();
      const colSchema = currentSchema[header];
      const effectiveType = colSchema?.type || (/fecha|vencimiento|retiro/i.test(header) ? 'date' : 'text');
      const isAutoCalculated = colSchema?.behavior === 'auto_id' || 
                              colSchema?.behavior === 'calc_fecha_vc' || 
                              colSchema?.behavior === 'calc_retiro' || 
                              effectiveType === 'calculated' || 
                              /^ID_VC$/i.test(header.trim());

      // Skip validation for calculated fields
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

      // Month/Year validation for expirations
      if (selectedEventCategory === 'VENCIMIENTO') {
        if (/^MM$/i.test(header.trim()) && val !== '') {
          const num = parseInt(val, 10);
          if (isNaN(num) || num < 1 || num > 12) {
            errors[header] = 'El mes debe estar entre 1 y 12.';
          }
        }

        if (/^YYYY$/i.test(header.trim()) && val !== '') {
          const num = parseInt(val, 10);
          if (isNaN(num) || num < 2000 || num > 2100) {
            errors[header] = 'El año debe ser válido (ej. 2026).';
          }
        }
      }
    });

    // Cross-field validation: Expiration vs Withdrawal Date
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

      if (editingItem) {
        await updateRow(activeSheet.title, editingItem._rowIndex, rowValues);
      } else {
        await appendRow(activeSheet.title, rowValues);
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
      
      await deleteRow(activeSheet.sheetId, item._rowIndex);
      await fetchData();
    } catch (err: any) {
      // Rollback
      setItems(originalItems);
      setAllMainItems(originalMainItems);
      alert(`Error eliminando fila (rollback aplicado): ${err.message}`);
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
      
      {/* SIDEBAR NAVIGATION */}
      <Sidebar
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        activeView={activeView}
        setActiveView={setActiveView}
        setSelectedProduct={setSelectedProduct}
        otherSheets={otherSheets}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Header Bar */}
        <div className="px-8 py-5 border-b border-slate-200 bg-white shrink-0 flex flex-col md:flex-row justify-between md:items-center gap-4">
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
            <p className="text-xs text-slate-400 mt-0.5">
              {activeView === 'main' ? 'Monitoreo de lotes críticos, fechas de retiro comercial y solicitud de precio para PM.' :
               activeView === 'events' ? 'Deterioros de transporte, diferencias de pedido, averías de almacén y devoluciones.' :
               activeView === 'products' ? 'Maestro de SKUs con relaciones directas hacia vencimientos e incidencias.' :
               activeView === 'policies' ? 'Reglas de tiempo de anticipación para retiro preventivo de productos.' :
               activeView === 'schema' ? 'Estructura de columnas, claves ID y sincronización de metadatos.' :
               activeView === 'analytics' ? 'Gráficos, tendencias de incidencias y proyecciones de vencimiento.' :
               'Gestión de datos tabulares'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeView === 'schema' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsScriptModalOpen(true)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-bold transition-colors flex items-center gap-1.5"
                >
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Conector Apps Script</span>
                </button>
              </div>
            ) : activeView === 'analytics' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportToCSV(`Exportacion_${new Date().toISOString().split('T')[0]}`, headers, filteredItems)}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Exportar Datos (CSV)</span>
                </button>
                <button onClick={() => fetchData()} className="text-sm bg-white border border-slate-200 px-3 py-2 rounded-xl font-medium shadow-sm hover:bg-slate-50 flex items-center gap-1.5 text-slate-700 transition-colors">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            ) : (
              <>
                {/* PM Drainage Report Trigger (Main view) */}
                {activeView === 'main' && (
                  <button
                    onClick={() => setIsPmReportOpen(true)}
                    className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-3 py-2 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5"
                    title="Generar resumen de productos críticos para enviar a Product Manager"
                  >
                    <Flame className="w-4 h-4 text-orange-600" />
                    <span>Reporte PM ({drainageReportItems.length})</span>
                  </button>
                )}

                {/* Export CSV Button */}
                <button
                  onClick={() => exportToCSV(`${activeView}_${new Date().toISOString().split('T')[0]}`, headers, filteredItems)}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5 hidden sm:flex"
                  title="Exportar la vista actual a CSV"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="hidden md:inline">Exportar CSV</span>
                </button>

                {/* Reset custom column widths button */}
                {hasCustomColWidths && (
                  <button
                    onClick={handleResetColWidths}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-2 rounded-xl font-medium transition-colors flex items-center gap-1"
                    title="Restablecer ancho original de todas las columnas de esta tabla"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Ajuste Columnas</span>
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
                  <span>
                    {activeView === 'main' ? 'Nuevo Vencimiento' :
                     activeView === 'events' ? 'Nueva Incidencia (FRC)' :
                     activeView === 'products' ? 'Nuevo Producto' :
                     activeView === 'policies' ? 'Nueva Política' :
                     'Nuevo Registro'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* INCIDENCIAS & FRC STRIP (When activeView === 'events') */}
        {activeView === 'events' && activeSheet && (
          <div className="bg-white border-b border-slate-200 px-8 py-4 shrink-0 flex flex-col gap-4 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
            <AnalyticsDashboard items={allMainItems} headers={headers} />
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
              <div className="flex-1 overflow-auto relative">
                <table className="text-left border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                  <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider select-none z-10">
                    <tr>
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
                    ) : (
                      filteredItems.map((item, idx) => {
                        const eventCategory = getEventCategory(item, headers);
                        const eventCategoryDef = EVENT_CATEGORIES[eventCategory];
                        const status = getItemStatus(item, headers);
                        const isMainOrEvents = activeView === 'main' || activeView === 'events';

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
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
                      })
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
    </div>
  );
};

export default InventoryDashboard;
