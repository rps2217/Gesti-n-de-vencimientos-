import React from 'react';
import { Clock, CheckCircle2, Flame, Clock3, AlertTriangle, ArrowLeftRight, Trash2 } from 'lucide-react';

interface PmMetrics {
  total: number;
  enRegla: number;
  drainage: number;
  upcoming: number;
  retireNow: number;
  canjeProveedor?: number;
  mermaDirecta?: number;
}

interface PmRadarCardsProps {
  pmRadarFilter: string[];
  onFilterClick: (filter: string, isMulti: boolean) => void;
  metrics: PmMetrics;
}

export const PmRadarCards: React.FC<PmRadarCardsProps> = ({
  pmRadarFilter,
  onFilterClick,
  metrics,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-4 shrink-0 flex flex-col gap-4 shadow-sm">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <button
          onClick={(e) => onFilterClick('all', false)}
          className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
            pmRadarFilter.length === 0
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/70 dark:bg-blue-950/40 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">{metrics.total}</span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Total Vencimientos</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Registros comerciales</p>
          </div>
        </button>

        <button
          onClick={(e) => onFilterClick('en_regla', e.ctrlKey || e.metaKey)}
          className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
            pmRadarFilter.includes('en_regla')
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          title="Clic normal: Solo este. Ctrl+Clic: Sumar filtro."
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">{metrics.enRegla}</span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">En Regla</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Dentro de política</p>
          </div>
        </button>

        <button
          onClick={(e) => onFilterClick('drainage', e.ctrlKey || e.metaKey)}
          className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
            pmRadarFilter.includes('drainage')
              ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/70 dark:bg-orange-950/40 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          title="Clic normal: Solo este. Ctrl+Clic: Sumar filtro."
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-300 flex items-center justify-center">
              <Flame className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">{metrics.drainage}</span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Drenaje PM</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Prioridad comercial</p>
          </div>
        </button>

        <button
          onClick={(e) => onFilterClick('upcoming', e.ctrlKey || e.metaKey)}
          className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
            pmRadarFilter.includes('upcoming')
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/70 dark:bg-amber-950/40 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          title="Clic normal: Solo este. Ctrl+Clic: Sumar filtro."
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center justify-center">
              <Clock3 className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">{metrics.upcoming}</span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Próximo Retiro</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">&lt; 30 días a política</p>
          </div>
        </button>

        <button
          onClick={(e) => onFilterClick('retire_now', e.ctrlKey || e.metaKey)}
          className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
            pmRadarFilter.includes('retire_now')
              ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/70 dark:bg-red-950/40 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          title="Clic normal: Solo este. Ctrl+Clic: Sumar filtro."
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">{metrics.retireNow}</span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Retirar Ya / Vencido</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Acción inmediata</p>
          </div>
        </button>

        {/* CANJE PROVEEDOR CARD */}
        <button
          onClick={(e) => onFilterClick('canje_proveedor', e.ctrlKey || e.metaKey)}
          className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
            pmRadarFilter.includes('canje_proveedor')
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-sm'
              : 'border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700'
          }`}
          title="Clic normal: Solo Canje Proveedor. Ctrl+Clic: Sumar filtro."
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-indigo-900 dark:text-indigo-100 font-mono">
              {metrics.canjeProveedor ?? 0}
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 truncate">Canje Proveedor</h4>
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">Retorno / Devolución</p>
          </div>
        </button>

        {/* MERMA DIRECTA CARD */}
        <button
          onClick={(e) => onFilterClick('merma_directa', e.ctrlKey || e.metaKey)}
          className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
            pmRadarFilter.includes('merma_directa')
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/80 dark:bg-rose-950/50 shadow-sm'
              : 'border-rose-100 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-50/60 dark:hover:bg-rose-900/30 hover:border-rose-300 dark:hover:border-rose-700'
          }`}
          title="Clic normal: Solo Merma Directa. Ctrl+Clic: Sumar filtro."
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/70 text-rose-700 dark:text-rose-300 flex items-center justify-center">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-rose-900 dark:text-rose-100 font-mono">
              {metrics.mermaDirecta ?? 0}
            </span>
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 truncate">Merma Directa</h4>
            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 truncate">Baja sin retorno</p>
          </div>
        </button>
      </div>
    </div>
  );
};
