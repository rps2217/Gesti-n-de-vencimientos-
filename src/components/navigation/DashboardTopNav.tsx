import React, { useMemo } from 'react';
import { 
  Menu, Search, X, FilterX, Scan, Download, ChevronDown, 
  Mail, Flame, FileSpreadsheet, Printer, RefreshCw, MessageSquare, Sliders, Settings 
} from 'lucide-react';
import { InventoryItem, SheetConfig } from '../../types';
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
  filteredItems: InventoryItem[];
  sheetConfig: SheetConfig;
  products: any[];
  policies: any[];
  handlePrintTicket: (items: InventoryItem[]) => void;
  isOffline: boolean;
  lastCachedAt: number | null;
  offlineQueue: any[];
  handleSyncOfflineQueue: () => void;
  fetchData: (config: SheetConfig, view: string, force?: boolean) => void;
  loading: boolean;
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
  filteredItems,
  sheetConfig,
  products,
  policies,
  handlePrintTicket,
  isOffline,
  lastCachedAt,
  offlineQueue,
  handleSyncOfflineQueue,
  fetchData,
  loading
}) => {
  const bulkActionCtx = useMemo(() => {
    return buildBulkActionContext(headers, activeView, activeSheetTitle);
  }, [headers, activeView, activeSheetTitle]);

  const isWhatsAppActive = isActionEnabledForTable('whatsapp', bulkActionCtx, sheetConfig);
  const isGmailActive = isActionEnabledForTable('gmail', bulkActionCtx, sheetConfig);
  const isPmReportActive = isActionEnabledForTable('pm_report', bulkActionCtx, sheetConfig);
  const isTicketActive = isActionEnabledForTable('ticket', bulkActionCtx, sheetConfig);
  const isExcelActive = isActionEnabledForTable('excel', bulkActionCtx, sheetConfig);

  return (
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
          <div className="w-full max-w-3xl py-3" />
        )}
      </div>

      {/* Global Utils (Export/Share Menu, View Menu, Sync, Refresh) */}
      <div className="hidden md:flex items-center gap-2.5 shrink-0">
        {activeView !== 'schema' && (
          <div className="relative">
            <button
              id="actions-dropdown-btn"
              onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
              className={`text-xs font-bold px-3.5 py-2.5 rounded-xl border transition-all flex items-center gap-1.5 shadow-sm ${
                isActionsMenuOpen
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="Opciones de exportación, correo y reportes"
            >
              <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Compartir & Exportar</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isActionsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isActionsMenuOpen && (
              <div
                id="actions-dropdown-menu"
                className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Comunicación & Reportes
                </div>
                {isGmailActive && (
                  <button
                    onClick={() => {
                      setIsGmailModalOpen(true);
                      setIsActionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 flex items-center justify-center shrink-0">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100">Borrador Gmail</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">Generar correo formateado</div>
                    </div>
                  </button>
                )}

                {isWhatsAppActive && (
                  <button
                    onClick={() => {
                      setIsWhatsAppModalOpen?.(true);
                      setIsActionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100">WhatsApp Web</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">Enviar mensaje predefinido</div>
                    </div>
                  </button>
                )}

                {isPmReportActive && (
                  <button
                    onClick={() => {
                      setIsPmReportOpen(true);
                      setIsActionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/60 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0">
                      <Flame className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100">Reporte PM ({drainageReportItems.length})</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">Resumen de drenaje crítico</div>
                    </div>
                  </button>
                )}

                <div className="my-1.5 border-t border-slate-100 dark:border-slate-700/80" />
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
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
                      exportToExcel(`${activeView}_${new Date().toISOString().split('T')[0]}`, headers, filteredItems, 'Inventario', activeVirtual, allData);
                      setIsActionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100">Descargar Excel (.xlsx)</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{filteredItems.length} registros</div>
                    </div>
                  </button>
                )}

                {isTicketActive && (
                  <div className="flex items-center hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors pr-2 group">
                    <button
                      onClick={() => {
                        handlePrintTicket(filteredItems);
                        setIsActionsMenuOpen(false);
                      }}
                      className="flex-1 text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                        <Printer className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 dark:text-slate-100">Imprimir Ticket Térmico</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">Formato continuo 80mm/58mm</div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTicketConfig?.();
                        setIsActionsMenuOpen(false);
                      }}
                      className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                      title="Configurar columnas y formato del ticket"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Scoping and Configuration Trigger */}
                <div className="my-1.5 border-t border-slate-100 dark:border-slate-700/80" />
                <button
                  onClick={() => {
                    onOpenBulkActionsConfig?.();
                    setIsActionsMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-2.5 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      Configurar Acciones...
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      Personalizar para esta tabla
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Status & Sync Indicator */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm">
          <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-slate-700 dark:text-slate-200 hidden md:inline">{isOffline ? 'Offline' : 'Conectado'}</span>
          {lastCachedAt && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden lg:inline">({new Date(lastCachedAt).toLocaleTimeString()})</span>
          )}
          {offlineQueue.length > 0 && (
            <button 
              onClick={handleSyncOfflineQueue}
              className="ml-1 bg-blue-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors"
            >
              Sincronizar ({offlineQueue.length})
            </button>
          )}
        </div>

        <button 
          onClick={() => fetchData(sheetConfig, activeView, true)} 
          className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors" 
          title="Refrescar datos"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};
