import React, { useState, useEffect } from 'react';
import { Package, Link as LinkIcon, Settings2, CheckCircle2 } from 'lucide-react';
import InventoryDashboard from './components/InventoryDashboard';

export default function App() {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupUrl, setSetupUrl] = useState('');
  const [setupError, setSetupError] = useState('');
  const [isChangingUrl, setIsChangingUrl] = useState(false);

  useEffect(() => {
    const configuredUrl = localStorage.getItem('appsheet_clone_scriptUrl') || (import.meta as any).env?.VITE_APPS_SCRIPT_URL || '';
    if (configuredUrl) {
      setSetupUrl(configuredUrl);
      setNeedsSetup(false);
    } else {
      setNeedsSetup(true);
    }
  }, []);

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupUrl.includes('script.google.com/macros/s/')) {
      setSetupError('La URL no parece ser un enlace válido de Google Apps Script (debe incluir script.google.com/macros/s/.../exec).');
      return;
    }

    localStorage.setItem('appsheet_clone_scriptUrl', setupUrl.trim());
    setNeedsSetup(false);
    setIsChangingUrl(false);
    setSetupError('');
  };

  if (needsSetup || isChangingUrl) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#F8FAFC] px-4 font-sans">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
          <div className="bg-blue-600 px-6 py-8 text-center text-white">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white bg-opacity-20 mb-4 shadow-sm">
              <LinkIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Conectar Google Sheets</h1>
            <p className="mt-2 text-blue-100 text-sm">
              Ingresa la URL del Web App de tu Google Apps Script
            </p>
          </div>
          
          <form onSubmit={handleSetupSubmit} className="p-8">
            {setupError && (
              <div className="mb-4 text-xs font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                {setupError}
              </div>
            )}
            
            <div className="mb-6">
              <label className="block text-[11px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 text-blue-600" /> URL de Google Apps Script (/exec)
              </label>
              <input
                type="url"
                value={setupUrl}
                onChange={(e) => setSetupUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-xs"
                required
              />
              <p className="text-[11px] text-slate-400 mt-2">
                Modo desarrollo activo: El PIN de acceso está desactivado para acceso directo.
              </p>
            </div>
            
            <div className="flex gap-3">
              {isChangingUrl && (
                <button 
                  type="button"
                  onClick={() => setIsChangingUrl(false)}
                  className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
              )}
              <button 
                type="submit"
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isChangingUrl ? 'Actualizar URL' : 'Conectar y Abrir'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#F8FAFC] font-sans overflow-hidden">
      <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm shadow-blue-200">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
              Gestor de <span className="text-blue-600 font-medium">Inventario</span>
            </h1>
            <span className="text-[10px] text-slate-400 font-medium">Modo Desarrollo (Sin PIN)</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsChangingUrl(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm"
          >
            <Settings2 className="h-3.5 w-3.5 text-slate-500" />
            <span>URL de Apps Script</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        <InventoryDashboard />
      </main>
    </div>
  );
}
