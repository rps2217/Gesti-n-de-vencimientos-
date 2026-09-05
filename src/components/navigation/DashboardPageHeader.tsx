import React from 'react';
import { 
  Columns, ChevronDown, Tag, Sliders, Settings, 
  RotateCcw, Plus, Layers, Edit2, SlidersHorizontal, Eye, EyeOff, LayoutGrid, Maximize2,
  ArrowUpAZ, ArrowDownZA
} from 'lucide-react';
import { SheetProperties, TableSlice } from '../../types';
import { SLICE_COLOR_CLASSES } from '../../utils/sliceRegistry';
import { SliceIcon } from '../slices/SliceSelectorBar';

interface DashboardPageHeaderProps {
  activeView: string;
  isRelationalActive: boolean;
  isViewMenuOpen: boolean;
  setIsViewMenuOpen: (open: boolean) => void;
  groupByColumn: string;
  setGroupByColumn: (col: string) => void;
  groupByDirection?: 'asc' | 'desc';
  onToggleGroupByDirection?: () => void;
  visibleHeaders: string[];
  setIsColumnManagerOpen: (open: boolean) => void;
  areFiltersVisible: boolean;
  setAreFiltersVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsTicketConfigOpen: (open: boolean) => void;
  hasCustomColWidths: boolean;
  handleResetColWidths: () => void;
  setIsBulkImportOpen?: (open: boolean) => void;
  setIsScriptModalOpen?: (open: boolean) => void;
  activeSheet?: SheetProperties | null;
  isModalOpen?: boolean;
  handleOpenModal?: () => void;
  onOpenCreateSlice?: () => void;
  onOpenSliceManager?: () => void;
  activeSlice?: TableSlice | null;
  onEditSlice?: (slice: TableSlice) => void;
  isSummaryView?: boolean;
  onToggleSummaryView?: () => void;
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  onOpenStockCount?: () => void;
  // Slices integration
  slices?: TableSlice[];
  activeSliceId?: string | null;
  onSelectSlice?: (slice: TableSlice | null) => void;
  sliceCounts?: Record<string, number>;
  totalItemsCount?: number;
}

export const DashboardPageHeader: React.FC<DashboardPageHeaderProps> = ({
  activeView,
  isViewMenuOpen,
  setIsViewMenuOpen,
  groupByColumn,
  setGroupByColumn,
  groupByDirection = 'asc',
  onToggleGroupByDirection,
  visibleHeaders,
  setIsColumnManagerOpen,
  areFiltersVisible,
  setAreFiltersVisible,
  setIsTicketConfigOpen,
  hasCustomColWidths,
  handleResetColWidths,
  onOpenCreateSlice,
  onOpenSliceManager,
  activeSlice,
  onEditSlice,
  isSummaryView = false,
  onToggleSummaryView,
  isZenMode = false,
  onToggleZenMode,
  slices = [],
  activeSliceId = null,
  onSelectSlice,
  sliceCounts = {},
  totalItemsCount = 0,
}) => {
  const hasSlices = slices.length > 0 && activeView !== 'schema' && activeView !== 'analytics';

  return (
    <div className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 shrink-0 px-3 sm:px-6 py-1.5 flex items-center justify-between gap-3 text-xs">
      
      {/* LEFT ZONE: Slices & Custom Views (AppSheet Style) or Context */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0 py-0.5">
        {hasSlices ? (
          <>
            {/* "Todas las filas" base slice button */}
            <button
              onClick={() => onSelectSlice?.(null)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs ${
                !activeSliceId
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Mostrar todas las filas de la tabla sin restricción de vista"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Todas</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono font-bold ${
                !activeSliceId
                  ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {totalItemsCount}
              </span>
            </button>

            {/* Configured table slices */}
            {slices.map((slice) => {
              const isSelected = activeSliceId === slice.id;
              const colorClasses = SLICE_COLOR_CLASSES[slice.color || 'blue'] || SLICE_COLOR_CLASSES.blue;
              const count = sliceCounts[slice.id] ?? 0;

              return (
                <button
                  key={slice.id}
                  onClick={() => onSelectSlice?.(isSelected ? null : slice)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs border ${
                    isSelected
                      ? `${colorClasses.activeBg} ${colorClasses.activeText} border-transparent shadow-xs ring-1 ${colorClasses.ring}`
                      : `${colorClasses.bg} ${colorClasses.text} ${colorClasses.border} hover:opacity-90`
                  }`}
                  title={slice.description || slice.name}
                >
                  <SliceIcon iconName={slice.icon} className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{slice.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                    isSelected ? 'bg-white/25 text-white' : `${colorClasses.badgeBg} ${colorClasses.badgeText}`
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Quick action: Create new slice */}
            {onOpenCreateSlice && (
              <button
                onClick={onOpenCreateSlice}
                className="px-2 py-1 rounded-xl text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                title="Capturar vista actual como nuevo Slice"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Vista</span>
              </button>
            )}

            {/* Slice Manager shortcut */}
            {onOpenSliceManager && (
              <button
                onClick={onOpenSliceManager}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer"
                title="Administrar vistas guardadas (Slices)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>
              {activeView === 'schema'
                ? 'Estructura de columnas, tipos y claves primarias'
                : activeView === 'analytics'
                ? 'Métricas gerenciales y análisis de distribución'
                : 'Inventario general de datos'}
            </span>
          </div>
        )}
      </div>

      {/* RIGHT ZONE: Unified Tools Cluster */}
      <div className="flex items-center gap-2 shrink-0">
        
        {/* Quick Grouping Selector */}
        {activeView !== 'schema' && activeView !== 'analytics' && (
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-2 py-1 shadow-2xs gap-1.5">
            <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <select
              value={groupByColumn}
              onChange={(e) => setGroupByColumn(e.target.value)}
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
              title="Agrupar filas por valor de columna"
            >
              <option value="none">Sin agrupar</option>
              {visibleHeaders.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            {groupByColumn !== 'none' && onToggleGroupByDirection && (
              <button
                onClick={onToggleGroupByDirection}
                className="pl-1.5 border-l border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 font-bold text-xs flex items-center gap-0.5 transition-colors cursor-pointer"
                title={`Orden: ${groupByDirection === 'desc' ? 'Descendente (Z-A)' : 'Ascendente (A-Z)'}`}
              >
                {groupByDirection === 'desc' ? (
                  <ArrowDownZA className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                ) : (
                  <ArrowUpAZ className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                )}
                <span className="text-[10px]">{groupByDirection === 'desc' ? 'Z-A' : 'A-Z'}</span>
              </button>
            )}
          </div>
        )}

        {/* View Settings & Columns Dropdown */}
        {activeView !== 'schema' && activeView !== 'analytics' && (
          <div className="relative">
            <button
              id="view-dropdown-btn"
              onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
              className={`text-xs bg-white dark:bg-slate-800 border hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                isViewMenuOpen ? 'border-blue-500 text-blue-600' : 'border-slate-200/80 dark:border-slate-700/80'
              }`}
              title="Personalizar columnas y diseño"
            >
              <Columns className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden md:inline">Columnas</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isViewMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isViewMenuOpen && (
              <div
                id="view-dropdown-menu"
                className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs"
              >
                {/* Active Slice Quick Edit option if a slice is currently selected */}
                {activeSlice && onEditSlice && (
                  <button
                    onClick={() => {
                      onEditSlice(activeSlice);
                      setIsViewMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-2.5 transition-colors border-b border-slate-100 dark:border-slate-700/60 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">Editar Vista: <strong>{activeSlice.name}</strong></span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsColumnManagerOpen(true);
                    setIsViewMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Columns className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Gestionar & Ocultar Columnas</span>
                </button>

                {onOpenSliceManager && (
                  <button
                    onClick={() => {
                      onOpenSliceManager();
                      setIsViewMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Administrar Vistas (Slices)</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsTicketConfigOpen(true);
                    setIsViewMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span>Configurar Ticket Térmico</span>
                </button>

                {hasCustomColWidths && (
                  <button
                    onClick={() => {
                      handleResetColWidths();
                      setIsViewMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Restablecer Ancho Columnas</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Toggle Summary View Preset */}
        {activeView !== 'schema' && activeView !== 'analytics' && onToggleSummaryView && (
          <button
            onClick={onToggleSummaryView}
            className={`px-2.5 py-1 rounded-xl font-bold border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              isSummaryView
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
            title="Vista Resumida: muestra únicamente las columnas indispensables"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Resumida</span>
          </button>
        )}

        {/* Toggle KPI Header Collapse */}
        {activeView !== 'schema' && activeView !== 'analytics' && (
          <button
            onClick={() => setAreFiltersVisible(prev => !prev)}
            className={`px-2.5 py-1 rounded-xl font-bold border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              areFiltersVisible 
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' 
                : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
            title={areFiltersVisible ? "Ocultar tarjetas KPI para ganar espacio" : "Mostrar tarjetas KPI"}
          >
            {areFiltersVisible ? <EyeOff className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
            <span className="hidden sm:inline">KPIs</span>
          </button>
        )}

        {/* Toggle Zen Focus Mode */}
        {activeView !== 'schema' && activeView !== 'analytics' && onToggleZenMode && (
          <button
            onClick={onToggleZenMode}
            className={`px-3 py-1 rounded-xl font-bold border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              isZenMode
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60'
            }`}
            title="Modo Zen: Oculta barras superiores y periféricas para máxima concentración (Esc para salir)"
          >
            <Maximize2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Modo Zen</span>
          </button>
        )}
      </div>
    </div>
  );
};
