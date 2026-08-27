import React from 'react';
import { Search, X, FilterX } from 'lucide-react';

interface DashboardFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeQuickChip: string | null;
  setActiveQuickChip: (chip: string | null) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
  placeholder?: string;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  activeQuickChip,
  setActiveQuickChip,
  clearAllFilters,
  hasActiveFilters,
  placeholder = "Buscar registros..."
}) => {
  return (
    <div className="relative w-full max-w-3xl flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-10 py-3 bg-slate-200/70 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl text-base font-medium text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>
      {hasActiveFilters && (
        <button onClick={clearAllFilters} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors">
          <FilterX className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
