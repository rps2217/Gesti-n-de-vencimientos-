import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Check, Plus, Minus, Trash2, Play, Pause, CheckCircle2, 
  AlertTriangle, ArrowRight, RotateCcw, Download, Calendar, 
  Package, Search, Eye, EyeOff, Sparkles, Layers, FileSpreadsheet, 
  Tag, Barcode, Hash, MapPin, Sliders, ShieldCheck, Database,
  ArrowUpRight, ArrowDownRight, ChevronRight, HelpCircle,
  Lock, Unlock, ListTodo
} from 'lucide-react';
import { 
  StockCountSession, 
  StockCountEntry, 
  StockCountMode, 
  StockCountReconciliationItem, 
  InventoryItem 
} from '../../types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  generateCuVc, 
  calculateLastDayOfMonthDateString, 
  reconcileStockCountSession, 
  buildVencimientosRowFromCount,
  loadStockCountSessionsFromStorage, 
  saveStockCountSessionsToStorage, 
  exportStockCountToExcel,
  generateShortVcId,
  playBeep
} from '../../utils/stockCountUtils';
import { searchMasterProducts, findMasterProduct, getMasterProductSummary } from '../../utils/referenceResolver';
import { formatLocaleNumber, parseLocaleNumber } from '../../utils/pureCalculations';

interface StockCountTerminalProps {
  sheetItems: InventoryItem[];
  headers: string[];
  masterProducts: any[];
  activeSheetTitle: string;
  onSyncRowsToVencimientos: (rows: Record<string, any>[]) => Promise<void>;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info', title?: string) => void;
  onClose?: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const MONTHS_LIST = [
  { val: '01', label: '01 - Ene' },
  { val: '02', label: '02 - Feb' },
  { val: '03', label: '03 - Mar' },
  { val: '04', label: '04 - Abr' },
  { val: '05', label: '05 - May' },
  { val: '06', label: '06 - Jun' },
  { val: '07', label: '07 - Jul' },
  { val: '08', label: '08 - Ago' },
  { val: '09', label: '09 - Sep' },
  { val: '10', label: '10 - Oct' },
  { val: '11', label: '11 - Nov' },
  { val: '12', label: '12 - Dic' }
];

export const StockCountTerminal: React.FC<StockCountTerminalProps> = ({
  sheetItems,
  headers,
  masterProducts,
  activeSheetTitle,
  onSyncRowsToVencimientos,
  showToast,
  onClose
}) => {
  const navigate = useNavigate();
  // Session list & active session
  const [sessions, setSessions] = useState<StockCountSession[]>(() => loadStockCountSessionsFromStorage());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // Navigation view inside modal: 'LIST' | 'COUNTING' | 'RECONCILIATION'
  const [viewState, setViewState] = useState<'LIST' | 'COUNTING' | 'RECONCILIATION'>('LIST');

  // New session creation form states
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionMode, setNewSessionMode] = useState<StockCountMode>('BLIND');
  const [newSessionRequireExpiry, setNewSessionRequireExpiry] = useState<boolean>(true);
  const [newSessionLocation, setNewSessionLocation] = useState('');
  const [newSessionYearFrom, setNewSessionYearFrom] = useState<number>(CURRENT_YEAR);
  const [newSessionYearTo, setNewSessionYearTo] = useState<number>(CURRENT_YEAR + 3);

  // Active counting terminal form states
  const [scannedSku, setScannedSku] = useState('');
  const [selectedProductDesc, setSelectedProductDesc] = useState('');
  const [countQuantity, setCountQuantity] = useState<number>(1);
  const [countLocation, setCountLocation] = useState<string>('');
  const [isLocationLocked, setIsLocationLocked] = useState<boolean>(false);

  // Expiry prompt states for sequential 2-step flow
  const [expiryPromptSku, setExpiryPromptSku] = useState<string | null>(null);
  const [tempMm, setTempMm] = useState<string>('');
  const [tempYyyy, setTempYyyy] = useState<string>('');
  
  // Right panel view & anti-bounce scanner ref
  const [rightTab, setRightTab] = useState<'READINGS' | 'PENDING'>('READINGS');
  const [pendingSearch, setPendingSearch] = useState<string>('');
  const lastScanRef = useRef<{ sku: string; timestamp: number } | null>(null);

  // Autocomplete / Search dropdown
  const [catalogSearchResults, setCatalogSearchResults] = useState<any[]>([]);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const skuInputRef = useRef<HTMLInputElement>(null);

  // Reconciliation filter
  const [reconciliationFilter, setReconciliationFilter] = useState<'ALL' | 'DIF' | 'CUADRADO' | 'FALTANTE' | 'SOBRANTE' | 'NO_CATALOGADO'>('ALL');
  const [isSyncingToSheet, setIsSyncingToSheet] = useState(false);

  // Save sessions to storage whenever they change
  useEffect(() => {
    saveStockCountSessionsToStorage(sessions);
  }, [sessions]);

  // Focus SKU input whenever switching to counting view
  useEffect(() => {
    if (viewState === 'COUNTING') {
      setTimeout(() => {
        skuInputRef.current?.focus();
      }, 100);
    }
  }, [viewState]);

  // Current active session
  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  // Dynamic years list based on session configuration
  const yearsList = useMemo(() => {
    if (currentSession?.rangoAnos) {
      const { desde, hasta } = currentSession.rangoAnos;
      const list = [];
      for (let y = desde; y <= hasta; y++) {
        list.push(String(y));
      }
      return list.length > 0 ? list : [String(CURRENT_YEAR)];
    }
    return Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR + i));
  }, [currentSession]);

  // Handle master product search / SKU matching
  const handleSkuChange = (val: string) => {
    setScannedSku(val);
    if (!val.trim()) {
      setSelectedProductDesc('');
      setCatalogSearchResults([]);
      setIsSearchDropdownOpen(false);
      return;
    }

    // 1. Exact match check
    const exact = findMasterProduct(val.trim(), masterProducts);
    if (exact) {
      const summary = getMasterProductSummary(exact);
      setSelectedProductDesc(summary.name);
      setIsSearchDropdownOpen(false);
      return;
    }

    // 2. Multi-match search
    const results = searchMasterProducts(val, masterProducts, 6);
    setCatalogSearchResults(results);
    setIsSearchDropdownOpen(results.length > 0);
  };

  const handleSelectProductFromCatalog = (product: any) => {
    setScannedSku(product.sku);
    setSelectedProductDesc(product.name);
    setIsSearchDropdownOpen(false);
    skuInputRef.current?.focus();
  };

  // Start new session
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSessionName.trim() || `Conteo ${newSessionMode === 'BLIND' ? 'a Ciegas' : 'Doc'} - ${new Date().toLocaleDateString('es-CL')}`;
    
    const newSession: StockCountSession = {
      id: generateShortVcId(),
      nombre: name,
      modo: newSessionMode,
      requiereVencimiento: newSessionRequireExpiry,
      hojaOrigen: activeSheetTitle || 'main',
      estado: 'IN_PROGRESS',
      fechaInicio: new Date().toISOString(),
      conteos: [],
      notas: newSessionLocation ? `Ubicación inicial: ${newSessionLocation}` : undefined,
      rangoAnos: newSessionRequireExpiry ? { desde: newSessionYearFrom, hasta: newSessionYearTo } : undefined
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setCountLocation(newSessionLocation);
    setNewSessionName('');
    setNewSessionLocation('');
    setViewState('COUNTING');
    showToast(`Sesión "${name}" iniciada correctamente`, 'info', 'Conteo Activo');
  };

  // Resume or open existing session
  const handleOpenSession = (session: StockCountSession) => {
    setActiveSessionId(session.id);
    if (session.estado === 'COMPLETED') {
      setViewState('RECONCILIATION');
    } else {
      setViewState('COUNTING');
    }
  };

  // Delete session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de eliminar esta sesión de conteo?')) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setViewState('LIST');
      }
      showToast('Sesión de conteo eliminada', 'info');
    }
  };

  // Record a physical count entry with full business logic and validation
  const commitCountEntry = (sku: string, mmVal?: string, yyyyVal?: string, isOmitted: boolean = false) => {
    if (!currentSession) return;

    const cleanSku = sku.trim();
    const qty = countQuantity;

    // Lookup master info to enrich entry
    const master = findMasterProduct(cleanSku, masterProducts);
    const summary = master ? getMasterProductSummary(master) : null;
    const finalDesc = selectedProductDesc || (summary ? summary.name : 'Producto sin descripción');

    let cu_vc: string | undefined = undefined;
    let fecha_vc: string | undefined = undefined;

    if (mmVal && yyyyVal && !isOmitted) {
      cu_vc = generateCuVc(cleanSku, yyyyVal, mmVal);
      fecha_vc = calculateLastDayOfMonthDateString(yyyyVal, mmVal);
    }

    const newEntry: StockCountEntry = {
      id: generateShortVcId(),
      sku: cleanSku,
      descripcion: finalDesc,
      cu_vc,
      mm: isOmitted ? undefined : mmVal,
      yyyy: isOmitted ? undefined : yyyyVal,
      fecha_vc,
      cantidad: qty,
      ubicacion: countLocation.trim() || undefined,
      timestamp: new Date().toISOString(),
      rutProveedor: summary?.provider,
      politica: (master?.POLITICA || master?.politica || '30'),
      diasRetiro: (master?.['DIAS RETIRO_VC'] || master?.dias_retiro || '30'),
      mundo: summary?.category || master?.MUNDO,
      pm: master?.PM || master?.pm
    };

    setSessions(prev => prev.map(s => {
      if (s.id === currentSession.id) {
        return {
          ...s,
          conteos: [newEntry, ...s.conteos]
        };
      }
      return s;
    }));

    // Reset input fields for next fast scan
    setScannedSku('');
    setSelectedProductDesc('');
    setCountQuantity(1);
    if (!isLocationLocked) {
      setCountLocation('');
    }
    setExpiryPromptSku(null);
    setTempMm('');
    setTempYyyy('');
    setIsSearchDropdownOpen(false);

    // Dynamic beep and toast confirmation
    if (isOmitted) {
      playBeep('skip');
      showToast(`Registrado sin vencimiento: ${cleanSku} (+${qty})`, 'info');
    } else if (mmVal && yyyyVal) {
      playBeep('success');
      showToast(`Registrado con vencimiento ${mmVal}/${yyyyVal}: ${cleanSku} (+${qty})`, 'success');
    } else {
      playBeep('success');
      showToast(`Registrado: ${cleanSku} (+${qty})`, 'success');
    }

    // Retain input focus
    setTimeout(() => {
      skuInputRef.current?.focus();
    }, 50);
  };

  const handleSkuScannedOrEntered = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentSession) return;

    const cleanSku = scannedSku.trim();
    if (!cleanSku) {
      playBeep('error');
      showToast('Ingresa o escanea un SKU válido', 'warning');
      skuInputRef.current?.focus();
      return;
    }

    if (countQuantity <= 0) {
      playBeep('error');
      showToast('La cantidad debe ser mayor a 0', 'warning');
      return;
    }

    // Anti-rebounce (debouncing) scanner check (800ms threshold)
    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.sku === cleanSku && (now - lastScanRef.current.timestamp) < 800) {
      playBeep('error');
      showToast(`Escaneo duplicado por rebote de pistola ignorado (${cleanSku})`, 'warning');
      setScannedSku('');
      return;
    }
    lastScanRef.current = { sku: cleanSku, timestamp: now };

    // Fetch product name if any to show in prompt
    const master = findMasterProduct(cleanSku, masterProducts);
    const summary = master ? getMasterProductSummary(master) : null;
    const finalDesc = selectedProductDesc || (summary ? summary.name : 'Producto sin descripción');
    setSelectedProductDesc(finalDesc);

    // Validate requirement for expiry date
    if (currentSession.requiereVencimiento) {
      // PER-PRODUCT MEMORY: Check if SKU has already been scanned in this active session with an associated date
      const previousMatch = currentSession.conteos.find(c => c.sku === cleanSku && c.mm && c.yyyy);
      if (previousMatch) {
        // Auto-apply this pre-associated date and commit instantly!
        commitCountEntry(cleanSku, previousMatch.mm, previousMatch.yyyy, false);
      } else {
        // No previous date found, trigger sequential prompt
        setExpiryPromptSku(cleanSku);
        setTempMm('');
        setTempYyyy('');
      }
    } else {
      // Expiry not required, save immediately
      commitCountEntry(cleanSku, undefined, undefined, false);
    }
  };

  // Remove individual count entry
  const handleRemoveEntry = (entryId: string) => {
    if (!currentSession) return;
    setSessions(prev => prev.map(s => {
      if (s.id === currentSession.id) {
        return {
          ...s,
          conteos: s.conteos.filter(c => c.id !== entryId)
        };
      }
      return s;
    }));
    showToast('Lectura eliminada del conteo', 'info');
  };

  // Update adjustment for stock in motion
  const handleUpdateAdjustment = (itemKey: string, value: number) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s;
      const currentAdjustments = s.ajustesMovimiento || {};
      return {
        ...s,
        ajustesMovimiento: {
          ...currentAdjustments,
          [itemKey]: value
        }
      };
    }));
  };

  // Reconciled items for the active session
  const reconciliation = useMemo(() => {
    if (!currentSession) return [];
    return reconcileStockCountSession(currentSession, sheetItems, headers, masterProducts);
  }, [currentSession, sheetItems, headers, masterProducts]);

  // Filtered reconciliation list for display
  const filteredReconciliation = useMemo(() => {
    if (reconciliationFilter === 'ALL') return reconciliation;
    if (reconciliationFilter === 'DIF') return reconciliation.filter(r => r.estado !== 'CUADRADO');
    return reconciliation.filter(r => r.estado === reconciliationFilter);
  }, [reconciliation, reconciliationFilter]);

  // Virtualization for high-volume reconciliation table (10,000+ items)
  const reconciliationTableContainerRef = useRef<HTMLDivElement>(null);
  const reconciliationRowVirtualizer = useVirtualizer({
    count: filteredReconciliation.length,
    getScrollElement: () => reconciliationTableContainerRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  const virtualReconciliationRows = reconciliationRowVirtualizer.getVirtualItems();
  const reconciliationPaddingTop = virtualReconciliationRows.length > 0 ? virtualReconciliationRows[0]?.start || 0 : 0;
  const reconciliationPaddingBottom =
    virtualReconciliationRows.length > 0
      ? reconciliationRowVirtualizer.getTotalSize() - (virtualReconciliationRows[virtualReconciliationRows.length - 1]?.end || 0)
      : 0;

  // Reconciliation summary KPIs
  const metrics = useMemo(() => {
    let totalContado = 0;
    let totalTeorico = 0;
    let cuadrados = 0;
    let faltantes = 0;
    let sobrantes = 0;
    let noCatalogados = 0;

    for (const r of reconciliation) {
      totalContado += r.contado;
      totalTeorico += (r.teorico + r.ajusteMovimiento);
      if (r.estado === 'CUADRADO') cuadrados++;
      else if (r.estado === 'FALTANTE') faltantes++;
      else if (r.estado === 'SOBRANTE') sobrantes++;
      else if (r.estado === 'NO_CATALOGADO') noCatalogados++;
    }

    const itemsContadosCount = reconciliation.filter(r => r.contado > 0).length;
    const totalItemsCount = reconciliation.length || 1;
    const cobertura = Math.round((itemsContadosCount / totalItemsCount) * 100);

    return {
      totalContado,
      totalTeorico,
      diferenciaNeta: totalContado - totalTeorico,
      cuadrados,
      faltantes,
      sobrantes,
      noCatalogados,
      conDiferencia: faltantes + sobrantes + noCatalogados,
      cobertura
    };
  }, [reconciliation]);

  // Pending items list for operational checklist
  const pendingItems = useMemo(() => {
    if (!currentSession) return [];
    const items = reconciliation.filter(r => r.contado === 0 && r.teorico > 0);
    if (!pendingSearch.trim()) return items;
    const term = pendingSearch.toLowerCase().trim();
    return items.filter(r => 
      r.sku.toLowerCase().includes(term) || 
      r.descripcion.toLowerCase().includes(term)
    );
  }, [currentSession, reconciliation, pendingSearch]);

  // Export reconciliation report to Excel
  const handleExportExcel = async (exportScope: 'FILTERED' | 'COUNTED_ONLY' | 'ALL' = 'FILTERED') => {
    if (!currentSession) return;
    try {
      let exportList = filteredReconciliation;
      if (exportScope === 'COUNTED_ONLY') {
        exportList = reconciliation.filter(r => r.contado > 0);
      } else if (exportScope === 'ALL') {
        exportList = reconciliation;
      }

      if (exportList.length === 0) {
        showToast('No hay registros para exportar con el criterio seleccionado', 'warning');
        return;
      }

      await exportStockCountToExcel(currentSession, exportList);
      showToast(`Planilla de cuadratura exportada (${exportList.length} registros)`, 'success', 'Excel Generado');
    } catch (e: any) {
      showToast(`Error al exportar: ${e.message}`, 'error');
    }
  };

  // Sync physical count records to the VENCIMIENTOS sheet
  const handleSyncToVencimientos = async () => {
    if (!currentSession || reconciliation.length === 0) return;
    setIsSyncingToSheet(true);

    try {
      // Items that were physically counted AND have expiry dates (skip omitted ones)
      const countedItems = reconciliation.filter(r => r.contado > 0 && r.mm && r.yyyy);
      if (countedItems.length === 0) {
        showToast('No hay productos con fechas de vencimiento registradas para sincronizar (las lecturas sin fecha fueron omitidas)', 'warning');
        setIsSyncingToSheet(false);
        return;
      }

      // Build 14-column records matching the VENCIMIENTOS sheet
      const rowsToSave = countedItems.map(item => {
        return buildVencimientosRowFromCount(item, item.rowIndexOriginal);
      });

      await onSyncRowsToVencimientos(rowsToSave);

      // Mark session as COMPLETED
      setSessions(prev => prev.map(s => {
        if (s.id === currentSession.id) {
          return {
            ...s,
            estado: 'COMPLETED',
            fechaCierre: new Date().toISOString()
          };
        }
        return s;
      }));

      showToast(`Se han sincronizado ${rowsToSave.length} registros con la pestaña VENCIMIENTOS`, 'success', 'Sincronización Exitosa');
    } catch (e: any) {
      showToast(`Error al sincronizar: ${e.message}`, 'error');
    } finally {
      setIsSyncingToSheet(false);
    }
  };

  return (
    <div className="flex-1 w-full h-full bg-white dark:bg-slate-900 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* ======================================================== */}
        {/* HEADER                                                  */}
        {/* ======================================================== */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  Módulo de Conteo de Existencias
                </h2>
                {currentSession && (
                  <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    currentSession.modo === 'BLIND' 
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                  }`}>
                    {currentSession.modo === 'BLIND' ? 'Conteo a Ciegas' : 'Contra Documento'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {viewState === 'LIST' && 'Administra sesiones de inventario físico y conteo de existencias.'}
                {viewState === 'COUNTING' && `Sesión activa: ${currentSession?.nombre} • ${currentSession?.conteos.length || 0} lecturas registradas`}
                {viewState === 'RECONCILIATION' && `Cuadratura: ${currentSession?.nombre} • Comparativa Físico vs Teórico`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {viewState !== 'LIST' && (
              <button
                onClick={() => setViewState('LIST')}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Mis Sesiones</span>
              </button>
            )}

            <button
              onClick={() => onClose ? onClose() : navigate('/')}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* BODY - VIEW 1: SESSIONS LIST & NEW SESSION CREATOR       */}
        {/* ======================================================== */}
        {viewState === 'LIST' && (
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: New Session Creator */}
            <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Nueva Sesión de Conteo
                  </h3>
                </div>

                <form onSubmit={handleCreateSession} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      Nombre o Identificador de la Sesión
                    </label>
                    <input
                      type="text"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      placeholder="Ej: Pasillo 3 - Lácteos y Refrigerados"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      Modalidad de Conteo
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setNewSessionMode('BLIND')}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          newSessionMode === 'BLIND'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                            <EyeOff className="w-3.5 h-3.5" /> A Ciegas
                          </span>
                          {newSessionMode === 'BLIND' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          Sin stock teórico visible al operario. Auditoría limpia.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewSessionMode('DOCUMENT')}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          newSessionMode === 'DOCUMENT'
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Contra Doc.
                          </span>
                          {newSessionMode === 'DOCUMENT' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          Valida contra la hoja activa y muestra avance en tiempo real.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Expiry Date Toggle (MM/YYYY) */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 pr-2">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Capturar Fecha de Vencimiento
                        </span>
                        <span className="text-[11px] text-slate-400 block leading-tight">
                          Registra Mes y Año (genera <code className="text-blue-600 dark:text-blue-400 font-mono">CU_VC</code> y calcula <code className="text-blue-600 dark:text-blue-400 font-mono">FECHA_VC</code>).
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={newSessionRequireExpiry}
                        onChange={(e) => setNewSessionRequireExpiry(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Range of Years (Configurable) */}
                  {newSessionRequireExpiry && (
                    <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/50 flex flex-col gap-2.5 animate-in slide-in-from-top-3 duration-150">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-200 block">
                        Rango de Años de Interés
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Desde Año</label>
                          <select
                            value={newSessionYearFrom}
                            onChange={(e) => {
                              const from = parseInt(e.target.value);
                              setNewSessionYearFrom(from);
                              if (newSessionYearTo < from) {
                                setNewSessionYearTo(from);
                              }
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-700 dark:text-slate-200"
                          >
                            {Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - 2 + i).map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Hasta Año</label>
                          <select
                            value={newSessionYearTo}
                            onChange={(e) => setNewSessionYearTo(Math.max(newSessionYearFrom, parseInt(e.target.value)))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-700 dark:text-slate-200"
                          >
                            {Array.from({ length: 8 }, (_, i) => newSessionYearFrom + i).map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Ubicación o Bodega (Opcional)
                    </label>
                    <input
                      type="text"
                      value={newSessionLocation}
                      onChange={(e) => setNewSessionLocation(e.target.value)}
                      placeholder="Ej: Bodega Central - Rack A4"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Comenzar Conteo Físico</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right: Existing Sessions List */}
            <div className="lg:col-span-7 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>Historial de Sesiones ({sessions.length})</span>
                </h3>
              </div>

              {sessions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                  <Barcode className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No hay sesiones de conteo registradas</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Inicia tu primera sesión de conteo a ciegas o contra documento para auditar inventario físico.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                  {sessions.map(s => {
                    const totalLecturas = s.conteos.length;
                    const totalUnidades = s.conteos.reduce((acc, curr) => acc + curr.cantidad, 0);

                    return (
                      <div
                        key={s.id}
                        onClick={() => handleOpenSession(s)}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className={`p-3 rounded-xl ${
                            s.estado === 'COMPLETED'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                          }`}>
                            {s.estado === 'COMPLETED' ? <CheckCircle2 className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {s.nombre}
                              </h4>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                s.modo === 'BLIND'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                              }`}>
                                {s.modo === 'BLIND' ? 'A Ciegas' : 'Contra Doc.'}
                              </span>
                              {s.requiereVencimiento && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                                  MM/YYYY
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mt-1">
                              <span>📅 {new Date(s.fechaInicio).toLocaleDateString('es-CL')}</span>
                              <span>📦 {totalLecturas} lecturas ({formatLocaleNumber(totalUnidades)} unids)</span>
                              <span className="font-semibold text-slate-600 dark:text-slate-300">
                                {s.estado === 'COMPLETED' ? 'Completado' : 'En progreso'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Eliminar sesión"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* BODY - VIEW 2: ACTIVE COUNTING TERMINAL                  */}
        {/* ======================================================== */}
        {viewState === 'COUNTING' && currentSession && (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            
            {/* Left: Input & Keypad Terminal */}
            <div className="flex-1 p-6 overflow-y-auto border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                {/* Session Context & Location Bar */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between flex-1">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="text-xs font-bold text-slate-500 shrink-0">Sesión:</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{currentSession.nombre}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setViewState('RECONCILIATION')}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Cuadratura</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Location / Pasillo with Lock Toggle */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={countLocation}
                      onChange={(e) => setCountLocation(e.target.value)}
                      placeholder="Ubicación / Pasillo..."
                      className="w-32 sm:w-40 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextLock = !isLocationLocked;
                        setIsLocationLocked(nextLock);
                        playBeep('skip');
                        showToast(nextLock ? 'Ubicación fijada' : 'Ubicación libre', 'info');
                      }}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        isLocationLocked
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                      }`}
                      title={isLocationLocked ? 'Ubicación FIJA (se mantiene en cada escaneo)' : 'Ubicación LIBRE (se borra en cada escaneo)'}
                    >
                      {isLocationLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {expiryPromptSku ? (
                  <div className="bg-blue-50/70 dark:bg-slate-800 p-6 rounded-2xl border-2 border-blue-400 dark:border-blue-900 shadow-lg animate-in zoom-in-95 duration-150">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400 block">
                          Asistente de Vencimiento Requerido
                        </span>
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                          ¿Cuándo vence {selectedProductDesc || 'este producto'}?
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          SKU: {expiryPromptSku} • Cantidad: {countQuantity} {countLocation ? `• Ubicador: ${countLocation}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setExpiryPromptSku(null);
                          playBeep('skip');
                        }}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Expiry Selector (Mes / Año) */}
                    <div className="flex flex-col gap-4 mb-5">
                      {/* Year Selector First (Or Month) */}
                      <div>
                        <span className="text-xs font-bold text-slate-500 mb-2 block">1. Selecciona el Año de Vencimiento</span>
                        <div className="flex flex-wrap gap-1.5">
                          {yearsList.map(y => {
                            const isSelected = tempYyyy === y;
                            return (
                              <button
                                key={y}
                                type="button"
                                onClick={() => {
                                  setTempYyyy(y);
                                  // Auto-commit if month is already selected
                                  if (tempMm) {
                                    commitCountEntry(expiryPromptSku, tempMm, y, false);
                                  } else {
                                    showToast('Ahora selecciona el mes de vencimiento', 'info');
                                  }
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-[1.03]'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                {y}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Month Selector */}
                      <div>
                        <span className="text-xs font-bold text-slate-500 mb-2 block">2. Selecciona el Mes</span>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                          {MONTHS_LIST.map(m => {
                            const isSelected = tempMm === m.val;
                            return (
                              <button
                                key={m.val}
                                type="button"
                                onClick={() => {
                                  setTempMm(m.val);
                                  // Auto-commit if year is already selected
                                  if (tempYyyy) {
                                    commitCountEntry(expiryPromptSku, m.val, tempYyyy, false);
                                  } else {
                                    showToast('Ahora selecciona el año de vencimiento', 'info');
                                  }
                                }}
                                className={`py-2.5 px-1.5 rounded-xl text-xs font-extrabold transition-all text-center border cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-[1.02]'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                {m.label.split(' - ')[0]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      {/* Omitir Fecha Button */}
                      <button
                        type="button"
                        onClick={() => commitCountEntry(expiryPromptSku, undefined, undefined, true)}
                        className="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span>Omitir Fecha (No gestionar vencimiento)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSkuScannedOrEntered} className="flex flex-col gap-4">
                    
                    {/* SKU / Barcode input */}
                    <div className="relative">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Barcode className="w-4 h-4 text-blue-600" />
                          <span>Escanear Código / Digitar SKU</span>
                        </span>
                        {selectedProductDesc && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[250px]">
                            ✓ {selectedProductDesc}
                          </span>
                        )}
                      </label>

                      <div className="relative">
                        <input
                          ref={skuInputRef}
                          type="text"
                          value={scannedSku}
                          onChange={(e) => handleSkuChange(e.target.value)}
                          placeholder="Ej: 2000210218569 o buscar por nombre..."
                          className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base font-bold text-slate-800 dark:text-slate-100 focus:border-blue-600 outline-none transition-all"
                          autoComplete="off"
                        />
                        {scannedSku && (
                          <button
                            type="button"
                            onClick={() => handleSkuChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Autocomplete dropdown from master catalog */}
                      {isSearchDropdownOpen && catalogSearchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto p-1.5">
                          <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                            Catálogo Maestro de Productos
                          </div>
                          {catalogSearchResults.map(prod => (
                            <button
                              key={prod.sku}
                              type="button"
                              onClick={() => handleSelectProductFromCatalog(prod)}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between text-xs transition-colors"
                            >
                              <div className="truncate pr-2">
                                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono mr-2">{prod.sku}</span>
                                <span className="text-slate-700 dark:text-slate-200 font-medium">{prod.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0 font-medium">{prod.provider || prod.category}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Expiry Status Indicator for Fast Scanners */}
                    {currentSession.requiereVencimiento && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 leading-tight flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          La fecha de vencimiento se solicitará de forma secuencial al registrar un SKU por primera vez. Para los siguientes escaneos del mismo SKU, se reutilizará de forma automática.
                        </span>
                      </div>
                    )}

                    {/* Quantity Stepper & Direct Input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Hash className="w-3.5 h-3.5 text-blue-600" />
                          <span>Cantidad Contada</span>
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCountQuantity(Math.max(1, countQuantity - 1))}
                          className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          <Minus className="w-5 h-5" />
                        </button>

                        <input
                          type="number"
                          min="1"
                          value={countQuantity}
                          onChange={(e) => setCountQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="flex-1 py-3 text-center rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xl font-extrabold text-blue-600 dark:text-blue-400 focus:border-blue-600 outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => setCountQuantity(countQuantity + 1)}
                          className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Quick increment buttons */}
                      <div className="grid grid-cols-5 gap-1.5 mt-2">
                        {[1, 5, 10, 25, 50].map(inc => (
                          <button
                            key={inc}
                            type="button"
                            onClick={() => setCountQuantity(inc)}
                            className="py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                          >
                            +{inc}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Registrar Lectura</span>
                    </button>
                  </form>
                )}
              </div>

              {/* Bottom Quick KPI */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500">Total en sesión:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {currentSession.conteos.length} lecturas • {formatLocaleNumber(currentSession.conteos.reduce((a, b) => a + b.cantidad, 0))} unidades
                </span>
              </div>
            </div>

            {/* Right: Readings History & Pending Checklist Tabs */}
            <div className="w-full md:w-80 lg:w-96 bg-slate-50 dark:bg-slate-800/40 p-4 flex flex-col border-t md:border-t-0 border-slate-200 dark:border-slate-800">
              {/* Tab Selector Header */}
              <div className="flex items-center p-1 bg-slate-200/80 dark:bg-slate-900 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() => setRightTab('READINGS')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    rightTab === 'READINGS'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Lecturas ({currentSession.conteos.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightTab('PENDING')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    rightTab === 'PENDING'
                      ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>Pendientes ({pendingItems.length})</span>
                </button>
              </div>

              {rightTab === 'READINGS' ? (
                /* READINGS LIST */
                currentSession.conteos.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <Barcode className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-xs font-semibold">Esperando primera lectura...</p>
                    <p className="text-[11px] mt-1 text-slate-400">Escanea o ingresa un SKU a la izquierda para comenzar.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                    {currentSession.conteos.map(entry => (
                      <div
                        key={entry.id}
                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between text-xs"
                      >
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{entry.sku}</span>
                            {entry.mm && entry.yyyy && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                {entry.mm}/{entry.yyyy}
                              </span>
                            )}
                            {entry.ubicacion && (
                              <span className="text-[9px] font-semibold text-slate-400 flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" /> {entry.ubicacion}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 truncate font-medium mt-0.5">
                            {entry.descripcion}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(entry.timestamp).toLocaleTimeString('es-CL')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                            +{entry.cantidad}
                          </span>
                          <button
                            onClick={() => handleRemoveEntry(entry.id)}
                            className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                            title="Eliminar lectura"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* PENDING ITEMS CHECKLIST */
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="relative mb-2 shrink-0">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={pendingSearch}
                      onChange={(e) => setPendingSearch(e.target.value)}
                      placeholder="Buscar SKU o nombre..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  {pendingItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                      <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500 opacity-60" />
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">¡Sin pendientes!</p>
                      <p className="text-[11px] mt-1 text-slate-400">Todos los productos teóricos han sido contados.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                      {pendingItems.map(item => (
                        <div
                          key={item.sku}
                          className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-amber-200/60 dark:border-amber-900/40 shadow-sm flex items-center justify-between text-xs"
                        >
                          <div className="truncate pr-2">
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-400 block">{item.sku}</span>
                            <p className="text-slate-600 dark:text-slate-300 truncate font-medium mt-0.5">
                              {item.descripcion}
                            </p>
                            <span className="text-[10px] font-bold text-slate-400">
                              Teórico: {formatLocaleNumber(item.teorico)} unids
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              handleSkuChange(item.sku);
                              setSelectedProductDesc(item.descripcion);
                              skuInputRef.current?.focus();
                              showToast(`SKU cargado: ${item.sku}`, 'info');
                            }}
                            className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold rounded-lg border border-amber-200 dark:border-amber-800 transition-all text-[11px] shrink-0 cursor-pointer"
                          >
                            Cargar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* BODY - VIEW 3: RECONCILIATION & SHEET SYNCHRONIZATION    */}
        {/* ======================================================== */}
        {viewState === 'RECONCILIATION' && currentSession && (
          <div className="flex-1 overflow-hidden flex flex-col p-6">
            
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5 shrink-0">
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900">
                <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300 block">Total Físico</span>
                <span className="text-xl font-extrabold text-blue-900 dark:text-blue-100 mt-1 block">
                  {formatLocaleNumber(metrics.totalContado)}
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 block">Unidades contadas</span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Teórico</span>
                <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-1 block">
                  {formatLocaleNumber(metrics.totalTeorico)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Según hoja</span>
              </div>

              <div className={`p-3.5 rounded-xl border ${
                metrics.diferenciaNeta === 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                  : metrics.diferenciaNeta > 0
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
              }`}>
                <span className="text-[10px] font-bold uppercase block">Diferencia Neta</span>
                <span className="text-xl font-extrabold mt-1 block">
                  {metrics.diferenciaNeta > 0 ? `+${formatLocaleNumber(metrics.diferenciaNeta)}` : formatLocaleNumber(metrics.diferenciaNeta)}
                </span>
                <span className="text-[10px] mt-0.5 block">Físico - Teórico</span>
              </div>

              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900">
                <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">Cuadrados</span>
                <span className="text-xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-1 block">
                  {metrics.cuadrados}
                </span>
                <span className="text-[10px] text-emerald-600 mt-0.5 block">Exactitud 100%</span>
              </div>

              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900">
                <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300 block">Faltantes</span>
                <span className="text-xl font-extrabold text-rose-900 dark:text-rose-100 mt-1 block">
                  {metrics.faltantes}
                </span>
                <span className="text-[10px] text-rose-600 mt-0.5 block">Menor a teórico</span>
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900">
                <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 block">Sobrantes</span>
                <span className="text-xl font-extrabold text-amber-900 dark:text-amber-100 mt-1 block">
                  {metrics.sobrantes + metrics.noCatalogados}
                </span>
                <span className="text-[10px] text-amber-600 mt-0.5 block">Mayor a teórico</span>
              </div>
            </div>

            {/* Filter Tabs & Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <button
                  onClick={() => setReconciliationFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reconciliationFilter === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  Todos ({reconciliation.length})
                </button>

                <button
                  onClick={() => setReconciliationFilter('DIF')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reconciliationFilter === 'DIF'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  Con Diferencias ({metrics.conDiferencia})
                </button>

                <button
                  onClick={() => setReconciliationFilter('CUADRADO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reconciliationFilter === 'CUADRADO'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  Cuadrados ({metrics.cuadrados})
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => handleExportExcel('FILTERED')}
                    title={`Exportar vista actual filtrada (${filteredReconciliation.length} registros)`}
                    className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Exportar ({filteredReconciliation.length})</span>
                  </button>

                  {reconciliation.filter(r => r.contado > 0).length > 0 && reconciliation.filter(r => r.contado > 0).length !== filteredReconciliation.length && (
                    <button
                      type="button"
                      onClick={() => handleExportExcel('COUNTED_ONLY')}
                      title="Exportar únicamente los productos con conteo físico registrado"
                      className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ml-1"
                    >
                      Solo Contados ({reconciliation.filter(r => r.contado > 0).length})
                    </button>
                  )}

                  {reconciliation.length > filteredReconciliation.length && (
                    <button
                      type="button"
                      onClick={() => handleExportExcel('ALL')}
                      title={`Exportar padrón teórico completo (${reconciliation.length} registros)`}
                      className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ml-1"
                    >
                      Todo ({reconciliation.length})
                    </button>
                  )}
                </div>

                <button
                  onClick={handleSyncToVencimientos}
                  disabled={isSyncingToSheet}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Database className="w-4 h-4" />
                  <span>{isSyncingToSheet ? 'Sincronizando...' : 'Sincronizar a VENCIMIENTOS'}</span>
                </button>
              </div>
            </div>

            {/* Reconciliation Table */}
            <div ref={reconciliationTableContainerRef} className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700 z-10">
                  <tr>
                    <th className="p-3 font-bold text-slate-600 dark:text-slate-400">SKU</th>
                    <th className="p-3 font-bold text-slate-600 dark:text-slate-400">Descripción</th>
                    {currentSession.requiereVencimiento && (
                      <>
                        <th className="p-3 font-bold text-slate-600 dark:text-slate-400">Mes/Año</th>
                        <th className="p-3 font-bold text-slate-600 dark:text-slate-400">CU_VC</th>
                      </>
                    )}
                    {currentSession.modo !== 'BLIND' ? (
                      <>
                        <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-right" title="Stock teórico capturado al iniciar la sesión">Teórico Base</th>
                        <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-center" title="Ajuste por ventas (- unidades) o recepciones (+ unidades) durante el conteo">Ajuste Flujo (Venta/Recep)</th>
                        <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-right" title="Teórico Base + Ajuste de Flujo">Teórico Ajustado</th>
                      </>
                    ) : (
                      <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-right">Teórico</th>
                    )}
                    <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-right">Físico</th>
                    <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-right">Diferencia</th>
                    <th className="p-3 font-bold text-slate-600 dark:text-slate-400 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reconciliationPaddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${reconciliationPaddingTop}px` }} colSpan={currentSession.requiereVencimiento ? 9 : 7} />
                    </tr>
                  )}
                  {virtualReconciliationRows.map((virtualRow) => {
                    const item = filteredReconciliation[virtualRow.index];
                    if (!item) return null;

                    return (
                      <tr 
                        key={item.itemKey + virtualRow.index} 
                        ref={reconciliationRowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{item.sku}</td>
                        <td className="p-3 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate">{item.descripcion}</td>
                        {currentSession.requiereVencimiento && (
                          <>
                            <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">
                              {item.mm && item.yyyy ? `${item.mm}/${item.yyyy}` : '-'}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {item.cu_vc || '-'}
                            </td>
                          </>
                        )}
                        {currentSession.modo !== 'BLIND' ? (
                          <>
                            <td className="p-3 text-right font-semibold text-slate-500">
                              {formatLocaleNumber(item.teorico)}
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                value={item.ajusteMovimiento || ''}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  handleUpdateAdjustment(item.itemKey, val);
                                }}
                                placeholder="0"
                                title="Ajuste por ventas (- unidades) o recepciones (+ unidades) durante el conteo"
                                className="w-20 px-2 py-1 text-center font-mono font-bold text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-800 dark:text-slate-100"
                              />
                            </td>
                            <td className="p-3 text-right font-semibold text-slate-600 dark:text-slate-300">
                              {formatLocaleNumber(item.teorico + item.ajusteMovimiento)}
                            </td>
                          </>
                        ) : (
                          <td className="p-3 text-right font-semibold text-slate-500">{formatLocaleNumber(item.teorico)}</td>
                        )}
                        <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-100">{formatLocaleNumber(item.contado)}</td>
                        <td className={`p-3 text-right font-extrabold ${
                          item.diferencia === 0 ? 'text-emerald-600' :
                          item.diferencia < 0 ? 'text-rose-600' : 'text-amber-600'
                        }`}>
                          {item.diferencia > 0 ? `+${formatLocaleNumber(item.diferencia)}` : formatLocaleNumber(item.diferencia)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            item.estado === 'CUADRADO' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' :
                            item.estado === 'FALTANTE' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300' :
                            item.estado === 'SOBRANTE' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' :
                            'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                          }`}>
                            {item.estado === 'NO_CATALOGADO' ? 'No en Hoja' : item.estado}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {reconciliationPaddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${reconciliationPaddingBottom}px` }} colSpan={currentSession.requiereVencimiento ? 9 : 7} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>
  );
};
