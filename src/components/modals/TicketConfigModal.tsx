import React, { useState, useEffect } from 'react';
import { X, Settings } from 'lucide-react';
import { ViewTicketConfig, TicketColumnConfig } from '../../types';

interface TicketConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  activeView: string;
  config: ViewTicketConfig;
  onSave: (view: string, newConfig: ViewTicketConfig) => void;
}

export const TicketConfigModal: React.FC<TicketConfigModalProps> = ({ 
  isOpen, onClose, headers, activeView, config, onSave 
}) => {
  const [localConfig, setLocalConfig] = useState<ViewTicketConfig>({});

  useEffect(() => {
    if (isOpen) {
      const mergedConfig: ViewTicketConfig = { ...config };
      headers.forEach(header => {
        if (!mergedConfig[header]) {
          mergedConfig[header] = { show: false, size: 10, bold: false };
        }
      });
      setLocalConfig(mergedConfig);
    }
  }, [isOpen, headers, config]);

  if (!isOpen) return null;

  const handleUpdate = (header: string, updates: Partial<TicketColumnConfig>) => {
    setLocalConfig(prev => ({
      ...prev,
      [header]: { ...prev[header], ...updates }
    }));
  };

  const renderConfigRow = (header: string) => {
    const colConfig = localConfig[header] || { show: false, size: 10, bold: false };
    
    return (
      <div key={header} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg mb-1.5 border border-slate-100 dark:border-slate-700/50">
        <label className="flex items-center gap-2 cursor-pointer flex-1 overflow-hidden pr-3">
          <input 
            type="checkbox" 
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 shrink-0"
            checked={colConfig.show}
            onChange={(e) => handleUpdate(header, { show: e.target.checked })}
          />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate" title={header}>{header}</span>
        </label>
        
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1">
            <input 
              type="number" 
              className="w-14 px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={colConfig.size}
              onChange={(e) => handleUpdate(header, { size: parseInt(e.target.value, 10) || 10 })}
              min={8} max={20}
            />
            <span className="text-xs text-slate-500">px</span>
          </div>
          
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input 
              type="checkbox" 
              className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
              checked={colConfig.bold}
              onChange={(e) => handleUpdate(header, { bold: e.target.checked })}
            />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Negrita</span>
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            Ticket - Vista: {activeView}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Selecciona las columnas de esta tabla que deseas imprimir en el ticket térmico (80mm).
            Esta configuración se guarda por tabla.
          </p>

          <div className="space-y-1">
            {headers.map(renderConfigRow)}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(activeView, localConfig)}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
          >
            Guardar Configuración
          </button>
        </div>

      </div>
    </div>
  );
};
