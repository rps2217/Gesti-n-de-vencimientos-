import React from 'react';
import { Settings, X, Database, FileSpreadsheet, Package, FileText, CheckCircle2, Sliders } from 'lucide-react';
import { SheetConfig, SpreadsheetMetadata } from '../../types';

interface GlobalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetConfig: SheetConfig;
  setSheetConfig: React.Dispatch<React.SetStateAction<SheetConfig>>;
  saveConfig: (newConfig: SheetConfig) => void;
  metadata: SpreadsheetMetadata | null;
  fetchData: (config?: SheetConfig, view?: string) => Promise<void>;
  activeView: string;
}

export const GlobalConfigModal: React.FC<GlobalConfigModalProps> = ({
  isOpen,
  onClose,
  sheetConfig,
  setSheetConfig,
  saveConfig,
  metadata,
  fetchData,
  activeView
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Mapeo de Módulos y Pestañas</h3>
              <p className="text-xs text-slate-500">Asocia las pestañas de tu Google Sheets con las vistas de la App</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:bg-slate-100 hover:text-slate-700 p-2 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Main / Vencimientos */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-blue-600" />
              <span>1. Vencimientos & Radar Principal</span>
            </label>
            <p className="text-xs text-slate-500 mb-3">Pestaña con las fechas de caducidad, MM/YYYY, lotes y retiro preventivo.</p>
            <select
              value={sheetConfig.main || ''}
              onChange={(e) => {
                const next = { ...sheetConfig, main: e.target.value };
                setSheetConfig(next);
                saveConfig(next);
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">-- Seleccionar Pestaña --</option>
              {metadata?.sheets
                .filter((s: any) => !/^_/i.test(s.properties.title))
                .map((s: any) => (
                  <option key={s.properties.sheetId} value={s.properties.title}>{s.properties.title}</option>
                ))}
            </select>
          </div>

          {/* Events / Incidencias */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
              <FileSpreadsheet className="w-4 h-4 text-purple-600" />
              <span>2. Incidencias & FRC (Opcional)</span>
            </label>
            <p className="text-xs text-slate-500 mb-3">Pestaña para registrar deterioros de transporte, averías, mermas o diferencias.</p>
            <select
              value={sheetConfig.events || ''}
              onChange={(e) => {
                const next = { ...sheetConfig, events: e.target.value };
                setSheetConfig(next);
                saveConfig(next);
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">-- (Opcional) Misma hoja principal o pestaña dedicada --</option>
              {metadata?.sheets
                .filter((s: any) => !/^_/i.test(s.properties.title))
                .map((s: any) => (
                  <option key={s.properties.sheetId} value={s.properties.title}>{s.properties.title}</option>
                ))}
            </select>
          </div>

          {/* Products / Maestro */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>3. Catálogo Maestro de Productos</span>
            </label>
            <p className="text-xs text-slate-500 mb-3">Pestaña maestra con SKU, descripción, marca y política de canje asociada.</p>
            <select
              value={sheetConfig.products || ''}
              onChange={(e) => {
                const next = { ...sheetConfig, products: e.target.value };
                setSheetConfig(next);
                saveConfig(next);
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">-- Seleccionar Pestaña --</option>
              {metadata?.sheets
                .filter((s: any) => !/^_/i.test(s.properties.title))
                .map((s: any) => (
                  <option key={s.properties.sheetId} value={s.properties.title}>{s.properties.title}</option>
                ))}
            </select>
          </div>

          {/* Policies / Canjes */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>4. Políticas de Canje / Retiro</span>
            </label>
            <p className="text-xs text-slate-500 mb-3">Pestaña con los días de anticipación de retiro (ej. 30, 60, 90 días).</p>
            <select
              value={sheetConfig.policies || ''}
              onChange={(e) => {
                const next = { ...sheetConfig, policies: e.target.value };
                setSheetConfig(next);
                saveConfig(next);
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">-- Seleccionar Pestaña --</option>
              {metadata?.sheets
                .filter((s: any) => !/^_/i.test(s.properties.title))
                .map((s: any) => (
                  <option key={s.properties.sheetId} value={s.properties.title}>{s.properties.title}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            onClick={() => {
              onClose();
              fetchData(sheetConfig, activeView);
            }}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Aplicar y Recargar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
