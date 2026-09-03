import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { InventoryItem } from '../../types';
import { StockCountTerminal } from './StockCountTerminal';

interface StockCountViewProps {
  sheetItems: InventoryItem[];
  headers: string[];
  masterProducts: any[];
  activeSheetTitle: string;
  onSyncRowsToVencimientos: (rows: Record<string, any>[]) => Promise<void>;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info', title?: string) => void;
}

export const StockCountView: React.FC<StockCountViewProps> = ({
  sheetItems,
  headers,
  masterProducts,
  activeSheetTitle,
  onSyncRowsToVencimientos,
  showToast
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Conteo de Inventario
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <StockCountTerminal
          sheetItems={sheetItems}
          headers={headers}
          masterProducts={masterProducts}
          activeSheetTitle={activeSheetTitle}
          onSyncRowsToVencimientos={onSyncRowsToVencimientos}
          showToast={showToast}
        />
      </div>
    </div>
  );
};
