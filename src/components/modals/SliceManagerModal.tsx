import React, { useState } from 'react';
import { 
  X, Layers, Plus, Edit2, Trash2, Check, Sparkles, 
  Search, SlidersHorizontal, ArrowRight, Eye, Shield, User
} from 'lucide-react';
import { TableSlice } from '../../types';
import { SliceIcon } from '../slices/SliceSelectorBar';
import { SLICE_COLOR_CLASSES } from '../../utils/sliceRegistry';

interface SliceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableKey: string;
  slices: TableSlice[];
  sliceCounts: Record<string, number>;
  activeSliceId: string | null;
  onSelectSlice: (slice: TableSlice | null) => void;
  onEditSlice: (slice: TableSlice) => void;
  onCreateSlice: () => void;
  onDeleteSlice: (sliceId: string) => void;
}

export const SliceManagerModal: React.FC<SliceManagerModalProps> = ({
  isOpen,
  onClose,
  tableKey,
  slices,
  sliceCounts,
  activeSliceId,
  onSelectSlice,
  onEditSlice,
  onCreateSlice,
  onDeleteSlice
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredSlices = slices.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const builtInSlices = filteredSlices.filter(s => s.isBuiltIn);
  const customSlices = filteredSlices.filter(s => !s.isBuiltIn);

  const getTableNameLabel = (key: string) => {
    switch (key) {
      case 'main': return 'Radar de Vencimientos';
      case 'events': return 'Registro de Incidencias & FRC';
      case 'products': return 'Catálogo de Productos';
      case 'policies': return 'Políticas de Retiro';
      default: return 'Tabla Activa';
    }
  };

  const renderSliceCard = (slice: TableSlice) => {
    const isActive = activeSliceId === slice.id;
    const count = sliceCounts[slice.id] ?? 0;
    const colorScheme = SLICE_COLOR_CLASSES[slice.color || 'blue'] || SLICE_COLOR_CLASSES.blue;

    const filterDetails: string[] = [];
    if (slice.filterConfig.searchTerm) filterDetails.push(`Búsqueda: "${slice.filterConfig.searchTerm}"`);
    if (slice.filterConfig.pmRadarFilter?.length) filterDetails.push(`Radar: ${slice.filterConfig.pmRadarFilter.join(', ')}`);
    if (slice.filterConfig.eventFilter?.length) filterDetails.push(`Categorías: ${slice.filterConfig.eventFilter.join(', ')}`);
    if (slice.filterConfig.eventResolutionFilter?.length) {
      filterDetails.push(slice.filterConfig.eventResolutionFilter.includes('pending') ? 'Sin Traspaso TR' : 'Regularizados');
    }
    if (slice.filterConfig.frcBodFilter?.length) filterDetails.push(`Bodegas: ${slice.filterConfig.frcBodFilter.join(', ')}`);
    if (slice.filterConfig.quickChip) filterDetails.push(`Filtro: ${slice.filterConfig.quickChip}`);
    if (slice.visibleColumns?.length) filterDetails.push(`${slice.visibleColumns.length} columnas visibles`);
    if (slice.sortConfig?.column) filterDetails.push(`Orden: ${slice.sortConfig.column} (${slice.sortConfig.direction?.toUpperCase()})`);
    if (slice.groupByColumn) filterDetails.push(`Agrupado: ${slice.groupByColumn}`);

    return (
      <div
        key={slice.id}
        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
          isActive 
            ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 shadow-sm'
            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl border shrink-0 ${colorScheme.bg} ${colorScheme.text} ${colorScheme.border}`}>
              <SliceIcon iconName={slice.icon} className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {slice.name}
                </h4>
                {isActive && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                    Activo
                  </span>
                )}
                {slice.isBuiltIn ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-slate-400" /> Sistema
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                    <User className="w-2.5 h-2.5 text-amber-500" /> Personalizado
                  </span>
                )}
              </div>
              {slice.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {slice.description}
                </p>
              )}
            </div>
          </div>

          <div className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold shrink-0 ${colorScheme.badgeBg} ${colorScheme.badgeText}`}>
            {count} filas
          </div>
        </div>

        {/* Filter Summary Tags */}
        {filterDetails.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            {filterDetails.map((detail, idx) => (
              <span 
                key={idx}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-medium"
              >
                {detail}
              </span>
            ))}
          </div>
        )}

        {/* Card Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50 mt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onSelectSlice(isActive ? null : slice);
                onClose();
              }}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
              }`}
            >
              {isActive ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Desactivar Vista</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Aplicar a Tabla</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onEditSlice(slice);
                onClose();
              }}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title={slice.isBuiltIn ? "Crear una copia personalizada de esta vista" : "Editar configuración de esta vista"}
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{slice.isBuiltIn ? 'Personalizar' : 'Editar'}</span>
            </button>

            {!slice.isBuiltIn && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Estás seguro de eliminar la vista personalizada "${slice.name}"?`)) {
                    onDeleteSlice(slice.id);
                  }
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                title="Eliminar vista personalizada"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Administrador de Vistas (Slices)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                  {getTableNameLabel(tableKey)}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestiona y personaliza las vistas segmentadas de la tabla sin saturar la barra principal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-900/40">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar vista o criterio..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onCreateSlice();
              onClose();
            }}
            className="w-full sm:w-auto text-xs px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nueva Vista</span>
          </button>
        </div>

        {/* List of Slices */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Custom Slices Section */}
          {customSlices.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Vistas Creadas por el Usuario ({customSlices.length})
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {customSlices.map(renderSliceCard)}
              </div>
            </div>
          )}

          {/* Built-in Slices Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Vistas Predeterminadas del Sistema ({builtInSlices.length})
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {builtInSlices.map(renderSliceCard)}
            </div>
          </div>

          {filteredSlices.length === 0 && (
            <div className="text-center py-10">
              <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                No se encontraron vistas que coincidan con &quot;{searchTerm}&quot;
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Total de vistas disponibles: <strong>{slices.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
