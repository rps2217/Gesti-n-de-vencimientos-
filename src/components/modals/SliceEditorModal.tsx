import React, { useState, useEffect } from 'react';
import { 
  X, Layers, Sparkles, Tag, Check, Trash2, Sliders, 
  Columns, Filter, ArrowUpDown, Info
} from 'lucide-react';
import { 
  TableSlice, SliceFilterConfig, SliceColor, SortConfig 
} from '../../types';
import { SliceIcon } from '../slices/SliceSelectorBar';
import { SLICE_COLOR_CLASSES } from '../../utils/sliceRegistry';

interface SliceEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableKey: string;
  headers: string[];
  currentFilters: {
    searchTerm?: string;
    quickChip?: string | null;
    eventFilter?: string[];
    pmRadarFilter?: string[];
    eventResolutionFilter?: ('pending' | 'completed')[];
    frcBodFilter?: string[];
    columnFilters?: Record<string, string[]>;
  };
  currentSort?: SortConfig;
  currentGroupBy?: string;
  currentVisibleHeaders?: string[];
  editingSlice?: TableSlice | null;
  onSaveSlice: (slice: TableSlice) => void;
  onDeleteSlice?: (sliceId: string) => void;
}

const AVAILABLE_ICONS = [
  'Layers', 'AlertTriangle', 'Clock', 'Truck', 'Scale', 
  'Flame', 'CheckCircle2', 'RotateCcw', 'Bookmark', 
  'Sparkles', 'Package', 'FileText', 'Tag', 'Filter'
];

const AVAILABLE_COLORS: SliceColor[] = [
  'blue', 'rose', 'amber', 'emerald', 'purple', 'indigo', 'slate'
];

export const SliceEditorModal: React.FC<SliceEditorModalProps> = ({
  isOpen,
  onClose,
  tableKey,
  headers,
  currentFilters,
  currentSort,
  currentGroupBy,
  currentVisibleHeaders = [],
  editingSlice,
  onSaveSlice,
  onDeleteSlice
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Layers');
  const [color, setColor] = useState<SliceColor>('blue');
  const [filterConfig, setFilterConfig] = useState<SliceFilterConfig>({});
  const [groupByColumn, setGroupByColumn] = useState<string>('none');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [useCustomColumns, setUseCustomColumns] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (!isOpen) return;

    if (editingSlice) {
      setName(editingSlice.name);
      setDescription(editingSlice.description || '');
      setIcon(editingSlice.icon || 'Layers');
      setColor(editingSlice.color || 'blue');
      setFilterConfig(editingSlice.filterConfig || {});
      setGroupByColumn(editingSlice.groupByColumn || 'none');
      if (editingSlice.sortConfig && editingSlice.sortConfig.column) {
        setSortColumn(editingSlice.sortConfig.column);
        setSortDirection(editingSlice.sortConfig.direction === 'desc' ? 'desc' : 'asc');
      } else {
        setSortColumn('');
        setSortDirection('asc');
      }
      if (editingSlice.visibleColumns && editingSlice.visibleColumns.length > 0) {
        setUseCustomColumns(true);
        setSelectedColumns(editingSlice.visibleColumns);
      } else {
        setUseCustomColumns(false);
        setSelectedColumns(currentVisibleHeaders.length > 0 ? currentVisibleHeaders : headers);
      }
    } else {
      // Initialize with captured current view criteria
      setName('');
      setDescription('');
      setIcon('Bookmark');
      setColor('blue');
      setFilterConfig({
        searchTerm: currentFilters.searchTerm || undefined,
        quickChip: currentFilters.quickChip || undefined,
        eventFilter: currentFilters.eventFilter?.length ? [...currentFilters.eventFilter] : undefined,
        pmRadarFilter: currentFilters.pmRadarFilter?.length ? [...currentFilters.pmRadarFilter] : undefined,
        eventResolutionFilter: currentFilters.eventResolutionFilter?.length ? [...currentFilters.eventResolutionFilter] : undefined,
        frcBodFilter: currentFilters.frcBodFilter?.length ? [...currentFilters.frcBodFilter] : undefined,
        columnFilters: currentFilters.columnFilters && Object.keys(currentFilters.columnFilters).length > 0
          ? { ...currentFilters.columnFilters }
          : undefined
      });
      setGroupByColumn(currentGroupBy || 'none');
      if (currentSort && currentSort.column) {
        setSortColumn(currentSort.column);
        setSortDirection(currentSort.direction === 'desc' ? 'desc' : 'asc');
      } else {
        setSortColumn('');
        setSortDirection('asc');
      }
      setUseCustomColumns(false);
      setSelectedColumns(currentVisibleHeaders.length > 0 ? currentVisibleHeaders : headers);
    }
    setErrors({});
  }, [isOpen, editingSlice, currentFilters, currentSort, currentGroupBy, currentVisibleHeaders, headers]);

  if (!isOpen) return null;

  const handleToggleColumn = (col: string) => {
    setSelectedColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleSelectAllColumns = () => {
    setSelectedColumns([...headers]);
  };

  const handleClearColumns = () => {
    setSelectedColumns([]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'El nombre del slice es obligatorio' });
      return;
    }

    const newSlice: TableSlice = {
      id: editingSlice ? editingSlice.id : `slice_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      description: description.trim() || undefined,
      tableKey,
      icon,
      color,
      isBuiltIn: false,
      filterConfig,
      groupByColumn: groupByColumn !== 'none' ? groupByColumn : undefined,
      sortConfig: sortColumn ? { column: sortColumn, direction: sortDirection } : undefined,
      visibleColumns: useCustomColumns && selectedColumns.length > 0 ? selectedColumns : undefined
    };

    onSaveSlice(newSlice);
    onClose();
  };

  // Human-readable summary of captured filters
  const filterSummary: string[] = [];
  if (filterConfig.searchTerm) filterSummary.push(`Búsqueda: "${filterConfig.searchTerm}"`);
  if (filterConfig.quickChip) filterSummary.push(`Píldora: "${filterConfig.quickChip}"`);
  if (filterConfig.pmRadarFilter && filterConfig.pmRadarFilter.length > 0) {
    filterSummary.push(`Radar PM: ${filterConfig.pmRadarFilter.join(', ')}`);
  }
  if (filterConfig.eventFilter && filterConfig.eventFilter.length > 0) {
    filterSummary.push(`Categorías: ${filterConfig.eventFilter.join(', ')}`);
  }
  if (filterConfig.eventResolutionFilter && filterConfig.eventResolutionFilter.length > 0) {
    filterSummary.push(`Resolución: ${filterConfig.eventResolutionFilter.map(s => s === 'pending' ? 'Pendiente' : 'Realizado').join(', ')}`);
  }
  if (filterConfig.frcBodFilter && filterConfig.frcBodFilter.length > 0) {
    filterSummary.push(`Bodegas: ${filterConfig.frcBodFilter.join(', ')}`);
  }
  if (filterConfig.columnFilters && Object.keys(filterConfig.columnFilters).length > 0) {
    const colCount = Object.keys(filterConfig.columnFilters).length;
    filterSummary.push(`${colCount} filtro(s) de columnas específicos`);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {editingSlice ? 'Editar Vista Personalizada (Slice)' : 'Crear Vista Personalizada (Slice)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Segmento inteligente de datos basado en filtros, orden y columnas (estilo AppSheet).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Nombre y Descripción */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nombre de la Vista / Slice <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({});
                }}
                placeholder="Ej. Mermas Bodega Central, Lotes Mayo 2026, Reclamos Urgentes..."
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                }`}
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1 font-semibold">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Descripción Operativa (Opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve nota sobre qué registros agrupa este slice..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Color & Icon Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Color de Distinción
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {AVAILABLE_COLORS.map((c) => {
                  const scheme = SLICE_COLOR_CLASSES[c];
                  const isSelected = color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-all ${
                        scheme.bg
                      } ${scheme.border} ${
                        isSelected ? 'ring-2 ring-blue-500 scale-110 shadow-xs' : 'hover:scale-105'
                      }`}
                      title={`Color ${c}`}
                    >
                      {isSelected && <Check className={`w-3.5 h-3.5 ${scheme.text}`} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Ícono Representativo
              </label>
              <div className="flex items-center gap-1.5 flex-wrap max-h-20 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                {AVAILABLE_ICONS.map((ic) => {
                  const isSelected = icon === ic;
                  return (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                      }`}
                      title={ic}
                    >
                      <SliceIcon iconName={ic} className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Captured Filter Rules Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Criterios y Filtros Capturados
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {filterSummary.length} condición(es)
              </span>
            </div>

            {filterSummary.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {filterSummary.map((item, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                Sin filtros aplicados actualmente. Este slice mostrará todos los registros con su orden y columnas asignadas.
              </p>
            )}
          </div>

          {/* Grouping & Default Sorting */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-blue-500" /> Agrupación Predeterminada
              </label>
              <select
                value={groupByColumn}
                onChange={(e) => setGroupByColumn(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="none">Sin agrupación</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-blue-500" /> Orden Predeterminado
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={sortColumn}
                  onChange={(e) => setSortColumn(e.target.value)}
                  className="flex-1 text-xs font-medium px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Predeterminado</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {sortColumn && (
                  <button
                    type="button"
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                  >
                    {sortDirection === 'asc' ? 'ASC' : 'DESC'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Visible Columns in Slice (AppSheet Slice Feature) */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Columns className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Columnas de este Slice
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomColumns}
                  onChange={(e) => setUseCustomColumns(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Personalizar columnas
                </span>
              </label>
            </div>

            {useCustomColumns && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {selectedColumns.length} de {headers.length} columnas visibles
                  </span>
                  <div className="flex gap-2 font-bold text-blue-600 dark:text-blue-400">
                    <button type="button" onClick={handleSelectAllColumns} className="hover:underline">
                      Todas
                    </button>
                    <span>•</span>
                    <button type="button" onClick={handleClearColumns} className="hover:underline">
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1">
                  {headers.map(col => {
                    const isChecked = selectedColumns.includes(col);
                    return (
                      <label
                        key={col}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-medium'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(col)}
                          className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <span className="truncate" title={col}>{col}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <div>
            {editingSlice && onDeleteSlice && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Estás seguro de eliminar el slice "${editingSlice.name}"?`)) {
                    onDeleteSlice(editingSlice.id);
                    onClose();
                  }
                }}
                className="text-xs px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold transition-colors flex items-center gap-1.5 border border-transparent hover:border-red-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Slice</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="text-xs px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-200 dark:shadow-none transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{editingSlice ? 'Actualizar Slice' : 'Guardar Slice'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
