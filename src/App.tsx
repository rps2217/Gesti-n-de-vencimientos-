import React, { useState, useEffect } from 'react';
import { Package, Link as LinkIcon, Settings2, CheckCircle2, Moon, Sun } from 'lucide-react';
import InventoryDashboard from './components/InventoryDashboard';

export default function App() {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupUrl, setSetupUrl] = useState('');
  const [setupError, setSetupError] = useState('');
  const [isChangingUrl, setIsChangingUrl] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('app_dark_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('app_dark_mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 px-4 font-sans transition-colors">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800">
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
              <div className="mb-4 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/50 p-3 rounded-lg border border-red-100 dark:border-red-900">
                {setupError}
              </div>
            )}
            
            <div className="mb-6">
              <label className="block text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 text-blue-600" /> URL de Google Apps Script (/exec)
              </label>
              <input
                type="url"
                value={setupUrl}
                onChange={(e) => setSetupUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-xs"
                required
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                Modo desarrollo activo: El PIN de acceso está desactivado para acceso directo.
              </p>
            </div>
            
            <div className="flex gap-3">
              {isChangingUrl && (
                <button 
                  type="button"
                  onClick={() => setIsChangingUrl(false)}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
              )}
              <button 
                type="submit"
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
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
    <div className="flex flex-col h-screen w-full bg-[#F8FAFC] dark:bg-slate-950 font-sans overflow-hidden transition-colors print:overflow-visible">
      <nav className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm shadow-blue-200 dark:shadow-none">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">
              Gestión de <span className="text-blue-600 dark:text-blue-400 font-medium">Vencimientos</span>
            </h1>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Modo Desarrollo (Sin PIN)</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
            title={darkMode ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>
          <button
            onClick={() => setIsChangingUrl(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm"
          >
            <Settings2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span>URL de Apps Script</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden print:overflow-visible">
        <InventoryDashboard darkMode={darkMode} />
      </main>
    </div>
  );
}

