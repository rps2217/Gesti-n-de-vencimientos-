import React, { useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, Search, X, FilterX, Scan, Download, ChevronDown, 
  Mail, Flame, FileSpreadsheet, Printer, Barcode, RefreshCw, MessageSquare, Sliders, Settings, CheckCircle2,
  Database, Package, FileText, Sparkles, Plus, PieChart
} from 'lucide-react';
import { InventoryItem, SheetConfig, SheetProperties } from '../../types';
import { VIRTUAL_COLUMNS } from '../../utils/virtualColumns';
import { parseAnyDate } from '../../utils/dateCalculations';
import { exportToExcel } from '../../utils/exportUtils';
import { buildBulkActionContext, isActionEnabledForTable } from '../../utils/bulkActionsRegistry';

interface DashboardTopNavProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  activeView: string;
  activeSheetTitle?: string;
  searchableHeaders: string[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  setIsScannerOpen: (open: boolean) => void;
  isActionsMenuOpen: boolean;
  setIsActionsMenuOpen: (open: boolean) => void;
  setIsGmailModalOpen: (open: boolean) => void;
  setIsWhatsAppModalOpen?: (open: boolean) => void;
  setIsPmReportOpen: (open: boolean) => void;
  onOpenBulkActionsConfig?: () => void;
  onOpenTicketConfig?: () => void;
  drainageReportItems: InventoryItem[];
  headers: string[];
  visibleHeaders?: string[];
  filteredItems: InventoryItem[];
  sheetConfig: SheetConfig;
  products: any[];
  policies: any[];
  handlePrintTicket: (items: InventoryItem[], mode?: 'standard' | 'barcode') => void;
  isOffline: boolean;
  lastCachedAt: number | null;
  isSyncing?: boolean;
  offlineQueue: any[];
  handleSyncOfflineQueue: () => void;
  fetchData: (config: SheetConfig, view: string, force?: boolean) => void;
  loading: boolean;
  // Executive Context & Actions props
  isRelationalActive?: boolean;
  activeSheet?: SheetProperties | null;
  isModalOpen?: boolean;
  handleOpenModal?: () => void;
  setIsBulkImportOpen?: (open: boolean) => void;
  setIsScriptModalOpen?: (open: boolean) => void;
}

export const DashboardTopNav: React.FC<DashboardTopNavProps> = ({
  setIsMobileMenuOpen,
  activeView,
  activeSheetTitle,
  searchableHeaders,
  searchTerm,
  setSearchTerm,
  hasActiveFilters,
  clearAllFilters,
  setIsScannerOpen,
  isActionsMenuOpen,
  setIsActionsMenuOpen,
  setIsGmailModalOpen,
  setIsWhatsAppModalOpen,
  setIsPmReportOpen,
  onOpenBulkActionsConfig,
  onOpenTicketConfig,
  drainageReportItems,
  headers,
  visibleHeaders,
  filteredItems,
  sheetConfig,
  products,
  policies,
  handlePrintTicket,
  isOffline,
  lastCachedAt,
  isSyncing,
  offlineQueue,
  handleSyncOfflineQueue,
  fetchData,
  loading,
  isRelationalActive = false,
  activeSheet,
  isModalOpen = false,
  handleOpenModal,
  setIsBulkImportOpen,
  setIsScriptModalOpen,
}) => {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard shortcut for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const bulkActionCtx = useMemo(() => {
    return buildBulkActionContext(headers, activeView, activeSheetTitle);
  }, [headers, activeView, activeSheetTitle]);

  const isWhatsAppActive = isActionEnabledForTable('whatsapp', bulkActionCtx, sheetConfig);
  const isGmailActive = isActionEnabledForTable('gmail', bulkActionCtx, sheetConfig);
  const isPmReportActive = isActionEnabledForTable('pm_report', bulkActionCtx, sheetConfig);
  const isTicketActive = isActionEnabledForTable('ticket', bulkActionCtx, sheetConfig);
  const isBarcodeTicketActive = isActionEnabledForTable('barcode_ticket', bulkActionCtx, sheetConfig);
  const isExcelActive = isActionEnabledForTable('excel', bulkActionCtx, sheetConfig);

  const getViewMeta = () => {
    switch (activeView) {
      case 'main':
        return {
          title: 'Vencimientos',
          icon: <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
          actionLabel: 'Nuevo Vencimiento'
        };
      case 'events':
        return {
          title: 'Incidencias FRC',
          icon: <FileSpreadsheet className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          actionLabel: 'Nueva Incidencia'
        };
      case 'products':
        return {
          title: 'Catálogo Maestro',
          icon: <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          actionLabel: 'Nuevo Producto'
        };
      case 'policies':
        return {
          title: 'Políticas Canje',
          icon: <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
          actionLabel: 'Nueva Política'
        };
      case 'schema':
        return {
          title: 'Estructura & Datos',
          icon: <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
          actionLabel: 'Nuevo Registro'
        };
      case 'analytics':
        return {
          title: 'Analítica & Métricas',
          icon: <PieChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
          actionLabel: 'Nuevo'
        };
      default:
        return {
          title: activeSheetTitle || activeView,
          icon: <Database className="w-4 h-4 text-blue-600" />,
          actionLabel: 'Nuevo Registro'
        };
    }
  };

  const viewMeta = getViewMeta();

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 z-30 sticky top-0 shrink-0 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 shadow-2xs">
      
      {/* LEFT: Mobile trigger & View Identity Context */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors shrink-0 cursor-pointer"
          title="Abrir menú de navegación"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* View Badge Pill */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
          <div className="shrink-0">
            {viewMeta.icon}
          </div>
          <span className="font-bold text-xs text-slate-800 dark:text-slate-100 whitespace-nowrap">
            {viewMeta.title}
          </span>
          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200/60 dark:border-slate-600/60 text-slate-600 dark:text-slate-300">
            {filteredItems.length}
          </span>
          {isRelationalActive && activeView === 'main' && (
            <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="w-2.5 h-2.5 text-emerald-500" /> Relacional
            </span>
          )}
        </div>
      </div>

      {/* CENTER: Zen-Inspired Sleek Search Bar */}
      <div className="flex-1 flex justify-center max-w-2xl px-2">
        {(activeView !== 'schema' || searchableHeaders.length > 0) ? (
          <div className="relative w-full flex items-center bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 rounded-xl transition-all shadow-2xs">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 ml-3 shrink-0" />
            
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={activeView === 'analytics' ? "Buscar y filtrar métricas..." : `Buscar en ${searchableHeaders.length} columnas...`}
              className="w-full bg-transparent pl-2.5 pr-2 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            />

            {/* Keyboard shortcut indicator */}
            {!searchTerm && (
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded mr-1.5 shadow-2xs">
                ⌘K
              </kbd>
            )}

            {/* Clear search button */}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="p-1 mr-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Clear all active filters pill */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-2 py-0.5 mr-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/50 transition-colors whitespace-nowrap shrink-0"
                title="Limpiar todos los filtros aplicados"
              >
                <FilterX className="w-3 h-3" />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            )}

            {/* Barcode Camera Scanner */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors mr-1 shrink-0 cursor-pointer"
              title="Escanear código de barras o QR con la cámara"
            >
              <Scan className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="w-full" />
        )}
      </div>

      {/* RIGHT: Primary Action, Utilities & Sync Indicator */}
      <div className="flex items-center gap-2 shrink-0">
        
        {/* Special Action: Bulk Import FRC */}
        {activeView === 'events' && setIsBulkImportOpen && (
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Importar masivamente desde Excel o Portapapeles"
          >
            <Plus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Importar FRC</span>
          </button>
        )}

        {/* Special Action: Apps Script for Schema */}
        {activeView === 'schema' && setIsScriptModalOpen && (
          <button
            onClick={() => setIsScriptModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>Apps Script</span>
          </button>
        )}

        {/* PRIMARY ACTION BUTTON (+ Nuevo Registro) */}
        {activeView !== 'schema' && activeView !== 'analytics' && handleOpenModal && (
          <button 
            disabled={!activeSheet || isModalOpen}
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold shadow-xs shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer shrink-0"
            title={`Crear ${viewMeta.actionLabel}`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">{viewMeta.actionLabel}</span>
          </button>
        )}

        {/* Conteo Físico Terminal */}
        <button
          onClick={() => navigate('/conteo')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer"
          title="Módulo de conteo masivo de existencias físicas"
        >
          <Barcode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Conteo</span>
        </button>

        {/* Compartir & Exportar Menu */}
        {activeView !== 'schema' && (
          <div className="relative">
            <button
              id="actions-dropdown-btn"
              onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                isActionsMenuOpen
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="Opciones de exportación a Excel, Gmail, WhatsApp y Tickets"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Exportar</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isActionsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isActionsMenuOpen && (
              <div
                id="actions-dropdown-menu"
                className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Comunicación & Reportes
                </div>
                {isGmailActive && (
                  <button
                    onClick={() => {
                      setIsGmailModalOpen(true);
                      setIsActionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 flex items-center justify-center shrink-0">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">Borrador Gmail</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Generar correo formateado</div>
                    </div>
                  </button>
                )}

                {isWhatsAppActive && (
                  <button
                    onClick={() => {
                      setIsWhatsAppModalOpen?.(true);
                      setIsActionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">WhatsApp Web</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Enviar mensaje predefinido</div>
                    </div>
                  </button>
                )}

                {isPmReportActive && (
                  <button
                    onClick={() => {
                      setIsPmReportOpen(true);
                      setIsActionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/60 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0">
                      <Flame className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">Reporte PM ({drainageReportItems.length})</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Resumen de drenaje crítico</div>
                    </div>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100 dark:border-slate-700/80" />
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Archivos & Físico
                </div>

                {isExcelActive && (
                  <button
                    onClick={() => {
                      const activeVirtual = [
                        ...VIRTUAL_COLUMNS.filter(vc => sheetConfig.activeVirtualColumns?.includes(vc.id)),
                        ...(sheetConfig.userVirtualColumns || []).map(uvc => ({
                          id: uvc.id,
                          label: uvc.label,
                          calculate: (item: any) => {
                            const values = uvc.sourceColumns.map(sc => item[sc] || '');
                            if (uvc.operation === 'concatenate') return values.join(' ');
                            if (uvc.operation === 'sum') return values.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                            if (uvc.operation === 'diff_days') { 
                              const d1 = parseAnyDate(values[0]); 
                              const d2 = parseAnyDate(values[1]); 
                              if (d1 && d2) return Math.round(Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)); 
                              return '-'; 
                            }
                            return '-';
                          }
                        }))
                      ];
                      const allData = { products, policies, events: [] };
                      const exportHeaders = (visibleHeaders && visibleHeaders.length > 0) ? visibleHeaders : headers;
                      
                      const columnLabelsMap: Record<string, string> = {};
                      VIRTUAL_COLUMNS.forEach(vc => { columnLabelsMap[vc.id] = vc.label; });
                      (sheetConfig.userVirtualColumns || []).forEach(uvc => { columnLabelsMap[uvc.id] = uvc.label; });
                      const schemaForSheet = activeSheetTitle ? sheetConfig.schema?.[activeSheetTitle] : undefined;
                      if (schemaForSheet) {
                        Object.keys(schemaForSheet).forEach(colId => {
                          if (schemaForSheet[colId]?.label) {
                            columnLabelsMap[colId] = schemaForSheet[colId].label;
                          }
                        });
                      }

                      exportToExcel(
                        `${activeView}_${new Date().toISOString().split('T')[0]}`, 
                        exportHeaders, 
                        filteredItems, 
                        'Inventario', 
                        activeVirtual, 
                        allData, 
                        columnLabelsMap
                      );
                      setIsActionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">Descargar Excel (.xlsx)</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{filteredItems.length} registros</div>
                    </div>
                  </button>
                )}

                {isTicketActive && (
                  <div className="flex items-center hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors pr-2 group">
                    <button
                      onClick={() => {
                        handlePrintTicket(filteredItems, 'standard');
                        setIsActionsMenuOpen(false);
                      }}
                      className="flex-1 text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                        <Printer className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">Imprimir Ticket Térmico</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Formato continuo 80mm/58mm</div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTicketConfig?.();
                        setIsActionsMenuOpen(false);
                      }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors cursor-pointer"
                      title="Configurar formato del ticket"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {isBarcodeTicketActive && (
                  <button
                    onClick={() => {
                      handlePrintTicket(filteredItems, 'barcode');
                      setIsActionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors rounded-xl cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                      <Barcode className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">Imprimir Códigos de Barras</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Etiquetas térmicas con SKU</div>
                    </div>
                  </button>
                )}

                {/* Scoping and Configuration Trigger */}
                <div className="my-1 border-t border-slate-100 dark:border-slate-700/80" />
                <button
                  onClick={() => {
                    onOpenBulkActionsConfig?.();
                    setIsActionsMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-xs">
                      Configurar Acciones...
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      Personalizar para esta tabla
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Compact Status & Sync Indicator */}
        <div className="hidden lg:flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-2xs shrink-0">
          {isSyncing && !isOffline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span className="text-blue-600 dark:text-blue-400 text-[11px] font-medium">Sincronizando...</span>
            </>
          ) : isOffline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-600 dark:text-amber-400 text-[11px]">Offline</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-300 text-[11px]">En línea</span>
            </>
          )}
          {lastCachedAt && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden xl:inline">
              ({new Date(lastCachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
            </span>
          )}
          {offlineQueue.length > 0 && (
            <button 
              onClick={handleSyncOfflineQueue}
              className="ml-1 bg-blue-600 text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold hover:bg-blue-700 transition-colors"
            >
              Sync ({offlineQueue.length})
            </button>
          )}
        </div>

        {/* Refresh button */}
        <button 
          onClick={() => fetchData(sheetConfig, activeView, true)} 
          className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-2 rounded-xl shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0" 
          title="Refrescar datos desde la nube"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>
    </header>
  );
};
