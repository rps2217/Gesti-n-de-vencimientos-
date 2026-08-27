import React from 'react';
import { InventoryItem, SheetProperties } from '../../types';
import { EventResolutionCards } from './EventResolutionCards';
import { EventFilterChips } from './EventFilterChips';
import { PmRadarCards } from './PmRadarCards';

interface DashboardFilterPanelsProps {
  areFiltersVisible: boolean;
  quickChips: string[];
  activeQuickChip: string | null;
  setActiveQuickChip: (chip: string | null) => void;
  activeView: string;
  activeSheet: SheetProperties | null;
  items: InventoryItem[];
  eventResolutionFilter: ('pending' | 'completed')[];
  setEventResolutionFilter: React.Dispatch<React.SetStateAction<('pending' | 'completed')[]>>;
  handleFilterToggle: <T>(prev: T[], val: T, isMulti: boolean) => T[];
  eventResolutionMetrics: any;
  eventFilter: any[];
  setEventFilter: React.Dispatch<React.SetStateAction<any[]>>;
  eventMetrics: any;
  frcBodValues: string[];
  frcBodCounts: Record<string, number>;
  frcBodFilter: string[];
  setFrcBodFilter: React.Dispatch<React.SetStateAction<string[]>>;
  pmRadarFilter: string[];
  setPmRadarFilter: React.Dispatch<React.SetStateAction<string[]>>;
  pmMetrics: any;
}

export const DashboardFilterPanels: React.FC<DashboardFilterPanelsProps> = ({
  areFiltersVisible,
  quickChips,
  activeQuickChip,
  setActiveQuickChip,
  activeView,
  activeSheet,
  items,
  eventResolutionFilter,
  setEventResolutionFilter,
  handleFilterToggle,
  eventResolutionMetrics,
  eventFilter,
  setEventFilter,
  eventMetrics,
  frcBodValues,
  frcBodCounts,
  frcBodFilter,
  setFrcBodFilter,
  pmRadarFilter,
  setPmRadarFilter,
  pmMetrics,
}) => {
  if (!areFiltersVisible) return null;

  return (
    <>
      {/* QUICK CHIPS (Píldoras Contextuales) */}
      {quickChips.length > 0 && activeView !== 'schema' && activeView !== 'analytics' && (
        <div className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 px-8 py-2.5 shrink-0 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-2 shrink-0">
            Filtros Rápidos:
          </span>
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => setActiveQuickChip(activeQuickChip === chip ? null : chip)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                activeQuickChip === chip
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {chip}
            </button>
          ))}
          {activeQuickChip && (
            <button
              onClick={() => setActiveQuickChip(null)}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1.5 rounded-full transition-colors shrink-0 underline"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      )}

      {/* INCIDENCIAS & FRC STRIP (When activeView === 'events') */}
      {activeView === 'events' && activeSheet && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-5 shrink-0 flex flex-col gap-4 shadow-xs">
          <EventResolutionCards 
            eventResolutionFilter={eventResolutionFilter} 
            onFilterClick={(val, isMulti) => setEventResolutionFilter(prev => handleFilterToggle(prev, val, isMulti))}
            metrics={eventResolutionMetrics} 
          />
          {/* Categorías FRC Secundarias y Bodegas */}
          <EventFilterChips 
            totalItems={items.length} 
            eventFilter={eventFilter} 
            onFilterClick={(val, isMulti) => setEventFilter(prev => handleFilterToggle(prev, val, isMulti))}
            metrics={eventMetrics} 
            frcBodValues={frcBodValues}
            frcBodCounts={frcBodCounts}
            frcBodFilter={frcBodFilter}
            onFrcBodFilterClick={(val, isMulti) => setFrcBodFilter(prev => handleFilterToggle(prev, val, isMulti))}
          />
        </div>
      )}

      {/* RADAR COMERCIAL (Only in main view, exclusively for Vencimientos) */}
      {activeView === 'main' && activeSheet && (
        <PmRadarCards 
          pmRadarFilter={pmRadarFilter} 
          onFilterClick={(val, isMulti) => setPmRadarFilter(prev => handleFilterToggle(prev, val, isMulti))}
          metrics={pmMetrics} 
        />
      )}
    </>
  );
};
