import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, RefreshCw, Wifi, WifiOff, Database, History, 
  CheckCircle2, Clock, AlertTriangle, Trash2, Send, 
  Copy, Check, HardDrive, ShieldCheck, ArrowRight, Search, Activity
} from 'lucide-react';
import { OfflineMutation, AuditLogEntry, indexedDbService } from '../../db/indexedDbService';
import { ConnectionHealthStatus } from '../../hooks/useOfflineSync';

interface SyncAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  offlineQueue: OfflineMutation[];
  auditLog: AuditLogEntry[];
  isOffline: boolean;
  isSyncing: boolean;
  latencyMs: number | null;
  connectionStatus: ConnectionHealthStatus;
  lastHealthCheck: Date | null;
  healthErrorMessage: string | null;
  testConnectionHealth: () => Promise<any>;
  syncQueue: () => Promise<any>;
  removeMutation: (id: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  clearAuditLog: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info', title?: string) => void;
}

export const SyncAuditModal: React.FC<SyncAuditModalProps> = ({
  isOpen,
  onClose,
  offlineQueue,
  auditLog,
  isOffline,
  isSyncing,
  latencyMs,
  connectionStatus,
  lastHealthCheck,
  healthErrorMessage,
  testConnectionHealth,
  syncQueue,
  removeMutation,
  clearQueue,
  clearAuditLog,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'audit' | 'storage'>('queue');
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'synced' | 'failed'>('all');
  const [copiedAudit, setCopiedAudit] = useState(false);
  const [storageStats, setStorageStats] = useState<{
    usageMb: number;
    quotaMb: number;
    percentUsed: number;
    isSupported: boolean;
  } | null>(null);

  // Load storage usage stats when opened
  useEffect(() => {
    if (isOpen) {
      indexedDbService.getStorageStats().then(setStorageStats);
    }
  }, [isOpen, offlineQueue.length, auditLog.length]);

  const handleTestPing = async () => {
    setIsTestingPing(true);
    try {
      const res = await testConnectionHealth();
      if (res.success) {
        showToast(`Conexión excelente con Google Apps Script (${res.latencyMs} ms)`, 'success', 'Salud de Red');
      } else {
        showToast(res.error || 'No se pudo conectar a Google Apps Script', 'warning', 'Diagnóstico de Red');
      }
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleSyncAll = async () => {
    if (offlineQueue.length === 0) return;
    const res = await syncQueue();
    if (res.success) {
      showToast(`¡Se sincronizaron exitosamente ${res.count} mutaciones!`, 'success', 'Sincronización Completa');
    } else if (res.errors && res.errors.length > 0) {
      showToast(`Sincronización parcial con errores: ${res.errors.join(', ')}`, 'error', 'Sincronización');
    }
  };

  const filteredAuditLog = useMemo(() => {
    return auditLog.filter(entry => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        entry.description.toLowerCase().includes(q) ||
        entry.sheetTitle.toLowerCase().includes(q) ||
        (entry.entityKey && entry.entityKey.toLowerCase().includes(q))
      );
    });
  }, [auditLog, statusFilter, searchTerm]);

  const handleCopyAudit = () => {
    if (auditLog.length === 0) {
      showToast('No hay registros de auditoría para copiar', 'info');
      return;
    }

    const lines = [
      `=== REPORTE DE AUDITORÍA Y CAMBIOS LOCALES ===`,
      `Fecha de exportación: ${new Date().toLocaleString()}`,
      `Total de registros: ${auditLog.length}`,
      `Estado de conexión: ${connectionStatus} (${latencyMs ? latencyMs + ' ms' : 'N/A'})`,
      `Mutaciones pendientes: ${offlineQueue.length}`,
      `----------------------------------------------------`,
      ...auditLog.map((log, idx) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const date = new Date(log.timestamp).toLocaleDateString();
        return `[${idx + 1}] ${date} ${time} | [${log.action.toUpperCase()}] en [${log.sheetTitle}] | Estado: ${log.status.toUpperCase()} | ${log.description}${log.errorMessage ? ` (Error: ${log.errorMessage})` : ''}`;
      })
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedAudit(true);
    showToast('Registro de auditoría copiado al portapapeles', 'success');
    setTimeout(() => setCopiedAudit(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Salud de Conexión & Auditoría Local</span>
                {offlineQueue.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    {offlineQueue.length} pendiente{offlineQueue.length > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monitoreo en tiempo real de Google Sheets, cola offline e historial de mutaciones
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONNECTION TELEMETRY STRIP */}
        <div className="px-5 py-3.5 bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          
          {/* Status Metric */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Estado de Red
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                  <span className="font-bold text-blue-600 dark:text-blue-400 truncate">Sincronizando</span>
                </>
              ) : connectionStatus === 'connected' ? (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 truncate">En Línea</span>
                </>
              ) : connectionStatus === 'unconfigured' ? (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                  <span className="font-bold text-slate-600 dark:text-slate-300 truncate">Modo Local</span>
                </>
              ) : (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-bold text-amber-600 dark:text-amber-400 truncate">Desconectado</span>
                </>
              )}
            </div>
          </div>

          {/* Latency Metric */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Latencia (Ping)
              </span>
              <button
                onClick={handleTestPing}
                disabled={isTestingPing}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Probar velocidad de conexión"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isTestingPing ? 'animate-spin' : ''}`} />
                <span>Test</span>
              </button>
            </div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm mt-1">
              {latencyMs !== null ? `${latencyMs} ms` : (isTestingPing ? 'Midiendo...' : 'N/A')}
            </div>
          </div>

          {/* Offline Queue Metric */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Cola Offline
            </div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm mt-1">
              {offlineQueue.length} {offlineQueue.length === 1 ? 'mutación' : 'mutaciones'}
            </div>
          </div>

          {/* Storage Metric */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Almacén Local
            </div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm mt-1">
              {storageStats ? `${storageStats.usageMb} MB` : 'IndexedDB'}
            </div>
          </div>

        </div>

        {/* TAB NAVIGATION */}
        <div className="px-5 pt-3 pb-0 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'queue'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Cola Pendiente</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                offlineQueue.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {offlineQueue.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historial de Auditoría</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {auditLog.length}
              </span>
            </button>
          </div>

          {/* Action trigger based on active tab */}
          {activeTab === 'queue' && offlineQueue.length > 0 && (
            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={clearQueue}
                className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                title="Descartar todas las mutaciones pendientes"
              >
                Descartar Todo
              </button>
              <button
                onClick={handleSyncAll}
                disabled={isSyncing}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sincronizar Ahora</span>
              </button>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="flex items-center gap-2 pb-2">
              {auditLog.length > 0 && (
                <button
                  onClick={clearAuditLog}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                  title="Borrar historial local"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={handleCopyAudit}
                className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedAudit ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAudit ? 'Copiado' : 'Copiar Registro'}</span>
              </button>
            </div>
          )}
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-5">
          
          {/* TAB 1: PENDING OFFLINE QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-3">
              {offlineQueue.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Todos los cambios están sincronizados
                  </h3>
                  <p className="text-xs max-w-sm mt-1">
                    No hay mutaciones ni operaciones pendientes en la cola local. Todas las acciones se encuentran respaldadas en Google Sheets.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {offlineQueue.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-2xs hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="font-mono text-xs text-slate-400 dark:text-slate-500 w-5 text-right shrink-0">
                          #{idx + 1}
                        </span>

                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase shrink-0 ${
                          item.type === 'append' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' :
                          item.type === 'update' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800' :
                          'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800'
                        }`}>
                          {item.type}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span>Tabla: <span className="font-mono text-blue-600 dark:text-blue-400">{item.sheetTitle}</span></span>
                            {item.entityKey && (
                              <span className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                Clave: {item.entityKey}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                            {item.attempts > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                ({item.attempts} reintento{item.attempts > 1 ? 's' : ''})
                              </span>
                            )}
                            {item.lastError && (
                              <span className="text-red-500 truncate max-w-xs" title={item.lastError}>
                                • {item.lastError}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => removeMutation(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Descartar esta mutación"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AUDIT LOG (RECENT ACTIONS) */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pb-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar por SKU, descripción o tabla..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-8 pr-3 py-1.5 text-xs rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1 w-full sm:w-auto shrink-0 overflow-x-auto">
                  {(['all', 'synced', 'pending', 'failed'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        statusFilter === st
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {st === 'all' ? 'Todos' : st === 'synced' ? 'Sincronizados' : st === 'pending' ? 'Pendientes' : 'Errores'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredAuditLog.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <p className="text-xs">No hay eventos de auditoría que coincidan con el filtro.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAuditLog.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-start justify-between gap-3 text-xs shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className={`mt-0.5 p-1 rounded-md shrink-0 ${
                          log.status === 'synced' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                          log.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                          'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                        }`}>
                          {log.status === 'synced' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                           log.status === 'pending' ? <Clock className="w-3.5 h-3.5" /> :
                           <AlertTriangle className="w-3.5 h-3.5" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {log.description}
                            </span>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {log.sheetTitle}
                            </span>
                          </div>

                          {log.errorMessage && (
                            <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                              Error: {log.errorMessage}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-2">
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                            <span>•</span>
                            <span className="uppercase font-mono font-bold text-[9px]">{log.action}</span>
                          </div>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        log.status === 'synced' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                        log.status === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                        'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800'
                      }`}>
                        {log.status === 'synced' ? 'Sincronizado' : log.status === 'pending' ? 'En Cola' : 'Error'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>Motor Local-First: IndexedDB + Google Apps Script</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
