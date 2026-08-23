import React from 'react';
import { Clock3, Truck, CheckCircle2, Tag, FileSpreadsheet, PackageX, RotateCcw } from 'lucide-react';
import { EventCategory } from '../../types';

interface EventMetrics {
  vencimientoCercano: number;
  transporte: number;
  calInterna: number;
  calExterna: number;
  canjes: number;
  diferencia: number;
  averia: number;
  devolucion: number;
}

interface EventFilterChipsProps {
  totalItems: number;
  eventFilter: EventCategory | 'all';
  setEventFilter: (filter: EventCategory | 'all') => void;
  metrics: EventMetrics;
}

export const EventFilterChips: React.FC<EventFilterChipsProps> = ({
  totalItems,
  eventFilter,
  setEventFilter,
  metrics,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
      <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] mr-1">Filtrar Tipo de Incidencia:</span>
      <button 
        onClick={() => setEventFilter('all')}
        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
          eventFilter === 'all'
            ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        Todos los tipos ({totalItems})
      </button>
      <button 
        onClick={() => setEventFilter('VENCIMIENTO_CERCANO')}
        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
          eventFilter === 'VENCIMIENTO_CERCANO'
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none' 
            : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
        }`}
      >
        <Clock3 className="w-3.5 h-3.5" />
        <span>VENC. CERC. ({metrics.vencimientoCercano})</span>
      </button>
      <button 
        onClick={() => setEventFilter('TRANSPORTE')}
        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
          eventFilter === 'TRANSPORTE'
            ? 'bg-amber-600 text-white shadow-sm shadow-amber-200 dark:shadow-none' 
            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
        }`}
      >
        <Truck className="w-3.5 h-3.5" />
        <span>DET. PED ({metrics.transporte})</span>
      </button>
      <button 
        onClick={() => setEventFilter('CAL_INTERNA')}
        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
          eventFilter === 'CAL_INTERNA'
            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200 dark:shadow-none' 
            : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>CAL. INTER ({metrics.calInterna})</span>
      </button>
      <button 
        onClick={() => setEventFilter('CAL_EXTERNA')}
        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
          eventFilter === 'CAL_EXTERNA'
            ? 'bg-teal-600 text-white shadow-sm shadow-teal-200 dark:shadow-none' 
            : 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50'
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>CAL. EXT. ({metrics.calExterna})</span>
      </button>
      <button 
        onClick={() => setEventFilter('CANJES')}
        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
          eventFilter === 'CANJES'
            ? 'bg-pink-600 text-white shadow-sm shadow-pink-200 dark:shadow-none' 
            : 'bg-pink-50 dark:bg-pink-950/50 text-pink-800 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/50'
        }`}
      >
        <Tag className="w-3.5 h-3.5" />
        <span>CANJES ({metrics.canjes})</span>
      </button>
      <button 
        onClick={() => setEventFilter('DIFERENCIA')}
        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
          eventFilter === 'DIFERENCIA'
            ? 'bg-purple-600 text-white shadow-sm shadow-purple-200 dark:shadow-none' 
            : 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50'
        }`}
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        <span>DIF. PED ({metrics.diferencia})</span>
      </button>
      <button 
        onClick={() => setEventFilter('AVERIA')}
        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
          eventFilter === 'AVERIA'
            ? 'bg-rose-600 text-white shadow-sm shadow-rose-200 dark:shadow-none' 
            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50'
        }`}
      >
        <PackageX className="w-3.5 h-3.5" />
        <span>AVERIA ({metrics.averia})</span>
      </button>
      <button 
        onClick={() => setEventFilter('DEVOLUCION')}
        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
          eventFilter === 'DEVOLUCION'
            ? 'bg-teal-600 text-white shadow-sm shadow-teal-200 dark:shadow-none' 
            : 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50'
        }`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>DEVOLUCION ({metrics.devolucion})</span>
      </button>
    </div>
  );
};
