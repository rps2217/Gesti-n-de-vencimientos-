import React from 'react';
import { 
  Sparkles, Columns, ChevronDown, Tag, Sliders, Settings, 
  RotateCcw, Plus, Layers 
} from 'lucide-react';
import { SheetProperties } from '../../types';

interface DashboardPageHeaderProps {
  activeView: string;
  isRelationalActive: boolean;
  isViewMenuOpen: boolean;
  setIsViewMenuOpen: (open: boolean) => void;
  groupByColumn: string;
  setGroupByColumn: (col: string) => void;
  visibleHeaders: string[];
  setIsColumnManagerOpen: (open: boolean) => void;
  areFiltersVisible: boolean;
  setAreFiltersVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsTicketConfigOpen: (open: boolean) => void;
  hasCustomColWidths: boolean;
  handleResetColWidths: () => void;
  setIsBulkImportOpen: (open: boolean) => void;
  setIsScriptModalOpen: (open: boolean) => void;
  activeSheet: SheetProperties | null;
  isModalOpen: boolean;
  handleOpenModal: () => void;
  onOpenCreateSlice?: () => void;
}

export const DashboardPageHeader: React.FC<DashboardPageHeaderProps> = ({
  activeView,
  isRelationalActive,
  isViewMenuOpen,
  setIsViewMenuOpen,
  groupByColumn,
  setGroupByColumn,
  visibleHeaders,
  setIsColumnManagerOpen,
  areFiltersVisible,
  setAreFiltersVisible,
  setIsTicketConfigOpen,
  hasCustomColWidths,
  handleResetColWidths,
  setIsBulkImportOpen,
  setIsScriptModalOpen,
  activeSheet,
  isModalOpen,
  handleOpenModal,
  onOpenCreateSlice,
}) => {
  return (
    <div className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 px-8 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

      <div className="flex flex-wrap items-center gap-2.5">
        {/* View Config & Layout Menu */}
        {activeView !== 'schema' && activeView !== 'analytics' && (
          <div className="relative">
            <button
              id="view-dropdown-btn"
              onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
              className={`text-xs bg-white dark:bg-slate-800 border hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                isViewMenuOpen ? 'border-blue-400 dark:border-blue-600 text-blue-600' : 'border-slate-200 dark:border-slate-700'
              }`}
              title="Configurar columnas, agrupación y visualización"
            >
              <Columns className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Personalizar Vista</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isViewMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isViewMenuOpen && (
              <div
                id="view-dropdown-menu"
                className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Quick Grouping inside menu */}
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Agrupar por
                    </span>
                    {groupByColumn !== 'none' && (
                      <button
                        onClick={() => setGroupByColumn('none')}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <select
                    value={groupByColumn}
                    onChange={(e) => setGroupByColumn(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="none">Sin agrupación</option>
                    {visibleHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => {
                    setIsColumnManagerOpen(true);
                    setIsViewMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors"
                >
                  <Columns className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Gestionar & Ocultar Columnas</span>
                </button>

                {onOpenCreateSlice && (
                  <button
                    onClick={() => {
                      onOpenCreateSlice();
                      setIsViewMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors"
                  >
                    <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Crear Vista Personalizada (Slice)</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setAreFiltersVisible(prev => !prev);
                    setIsViewMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors"
                >
                  <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{areFiltersVisible ? 'Ocultar Paneles de Filtro' : 'Mostrar Paneles de Filtro'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsTicketConfigOpen(true);
                    setIsViewMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Configurar Ticket Térmico</span>
                </button>

                {hasCustomColWidths && (
                  <button
                    onClick={() => {
                      handleResetColWidths();
                      setIsViewMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2.5 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    <span>Restablecer Ancho Columnas</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Grouping Selector */}
        {activeView !== 'schema' && activeView !== 'analytics' && (
          <div className="hidden lg:flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
            <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-2 shrink-0" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">Agrupar:</span>
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

        {/* Special Action: Bulk Import FRC */}
        {activeView === 'events' && (
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Importar Masivo FRC</span>
          </button>
        )}

        {/* Special Action: Apps Script for Schema */}
        {activeView === 'schema' && (
          <button
            onClick={() => setIsScriptModalOpen(true)}
            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Conector Apps Script</span>
          </button>
        )}

        {/* Primary Action Button (Add new item) */}
        {activeView !== 'schema' && activeView !== 'analytics' && (
          <button 
            disabled={!activeSheet || isModalOpen}
            onClick={() => handleOpenModal()}
            className="text-xs bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-blue-200 dark:shadow-none flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all"
          >
            <Plus className="w-4 h-4"/>
            <span>
              {activeView === 'main' ? 'Nuevo Vencimiento' : 
               activeView === 'events' ? 'Nueva Incidencia' : 
               activeView === 'products' ? 'Nuevo Producto' : 
               activeView === 'policies' ? 'Nueva Política' : 
               'Nuevo Registro'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
