import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Barcode, Package, Search, EyeOff, FileSpreadsheet, Calendar, 
  Trash2, CheckCircle2, Play, Save, ChevronDown, RefreshCw, X, MapPin, Lock, Unlock
} from 'lucide-react';
import { 
  StockCountSession, StockCountEntry, StockCountMode, InventoryItem 
} from '../types';
import { 
  generateShortVcId, loadStockCountSessionsFromStorage, saveStockCountSessionsToStorage, 
  playBeep, reconcileStockCountSession, generateCuVc, calculateLastDayOfMonthDateString 
} from '../../utils/stockCountUtils';
import { searchMasterProducts, findMasterProduct, getMasterProductSummary } from '../utils/referenceResolver';
import { formatLocaleNumber } from '../utils/pureCalculations';

interface StockCountViewProps {
  sheetItems: InventoryItem[];
  headers: string[];
  masterProducts: any[];
  activeSheetTitle: string;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info', title?: string) => void;
}

export const StockCountView: React.FC<StockCountViewProps> = ({
  sheetItems,
  headers,
  masterProducts,
  activeSheetTitle,
  showToast
}) => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<StockCountSession[]>(() => loadStockCountSessionsFromStorage());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Persistence
  useEffect(() => {
    saveStockCountSessionsToStorage(sessions);
  }, [sessions]);

  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Conteo de Inventario {currentSession ? `- ${currentSession.nombre}` : ''}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!currentSession ? (
          <div className="max-w-4xl mx-auto">
            {/* Logic to create/list sessions */}
            <p>Selector de sesiones (Migración de lista)</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            <p>Terminal de conteo y reconciliación para {currentSession.nombre}</p>
          </div>
        )}
      </div>
    </div>
  );
};
