import React from 'react';
import { 
  Package, X, AlertCircle, CheckCircle2, Clock, Truck, FileSpreadsheet, PackageX, RotateCcw, Plus, ExternalLink 
} from 'lucide-react';
import { InventoryItem, EventCategory } from '../../types';
import { 
  EVENT_CATEGORIES, 
  renderEventIcon, 
  getItemStatus, 
  getEventCategory, 
  getItemResolutionStatus,
  formatDisplayDate, 
  formatLocaleNumber 
} from '../../utils/dateCalculations';
import { findColumnBySemantic } from '../../utils/columnAliases';

interface ItemDetailDrawerProps {
  product: InventoryItem | null;
  onClose: () => void;
  onNewEventForProduct: (sku: string, category?: EventCategory) => void;
  allMainItems: InventoryItem[];
  policies: any[];
}

export const ItemDetailDrawer: React.FC<ItemDetailDrawerProps> = ({
  product,
  onClose,
  onNewEventForProduct,
  allMainItems,
  policies
}) => {
  if (!product) return null;

  const productKeys = Object.keys(product);
  const skuKey = findColumnBySemantic(productKeys, 'sku') || 'SKU';
  const nameKey = findColumnBySemantic(productKeys, 'descripcion') || '';
  const policyKey = findColumnBySemantic(productKeys, 'politica') || '';

  const sku = product[skuKey] || '-';
  const name = (nameKey && product[nameKey]) || 'Detalle del Producto';
  const policyName = (policyKey && product[policyKey]) || '-';

  // Find related records for this SKU in main and event records
  const relatedRecords = allMainItems.filter(item => {
    const itemKeys = Object.keys(item);
    const itSkuCol = findColumnBySemantic(itemKeys, 'sku') || '';
    const itSku = item[itSkuCol];
    return itSku && String(itSku).trim() === String(sku).trim();
  });

  const expirations = relatedRecords.filter(r => getEventCategory(r, Object.keys(r)) === 'VENCIMIENTO');
  const incidents = relatedRecords.filter(r => getEventCategory(r, Object.keys(r)) !== 'VENCIMIENTO');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/90 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-md shadow-blue-200 dark:shadow-none">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                  SKU: {sku}
                </span>
                {policyName !== '-' && (
                  <span className="text-xs font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                    Política: {policyName}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{name}</h2>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Product Master Fields */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Datos Maestros</h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(product)
                .filter(([k]) => !k.startsWith('_'))
                .map(([key, val]) => (
                  <div key={key} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{key}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">{String(val || '-')}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Expirations Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Lotes y Vencimientos ({expirations.length})</span>
              </h4>
              <button 
                onClick={() => onNewEventForProduct(sku, 'VENCIMIENTO')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Registrar Vencimiento
              </button>
            </div>

            {expirations.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center text-xs text-slate-400 dark:text-slate-500">
                No hay lotes con fecha de vencimiento registrados para este SKU.
              </div>
            ) : (
              <div className="space-y-2">
                {expirations.map((exp, idx) => {
                  const expKeys = Object.keys(exp);
                  const st = getItemStatus(exp, expKeys);
                  const vcCol = findColumnBySemantic(expKeys, 'fecha_vc');
                  const retCol = findColumnBySemantic(expKeys, 'fecha_retiro');
                  const cantCol = findColumnBySemantic(expKeys, 'cantidad');
                  const loteCol = findColumnBySemantic(expKeys, 'lote');

                  const fVc = vcCol && exp[vcCol] ? formatDisplayDate(exp[vcCol]) : '-';
                  const fRet = retCol && exp[retCol] ? formatDisplayDate(exp[retCol]) : '-';
                  const cant = cantCol && exp[cantCol] ? formatLocaleNumber(exp[cantCol]) : '-';
                  const lote = (loteCol && exp[loteCol]) || '-';

                  return (
                    <div key={idx} className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Vence: {fVc}</span>
                          {lote !== '-' && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-mono">Lote: {lote}</span>}
                          {cant !== '-' && <span className="text-[10px] bg-blue-50 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">{cant} un.</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Fecha Retiro: {fRet}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 shrink-0 ${st.color}`}>
                        {st.icon}
                        <span>{st.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incidents Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Historial de Incidencias & FRC ({incidents.length})</span>
              </h4>
              <button 
                onClick={() => onNewEventForProduct(sku, 'TRANSPORTE')}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Registrar Incidencia
              </button>
            </div>

            {incidents.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center text-xs text-slate-400 dark:text-slate-500">
                Sin registros de mermas, deterioros o diferencias de pedido.
              </div>
            ) : (
              <div className="space-y-2">
                {incidents.map((inc, idx) => {
                  const incKeys = Object.keys(inc);
                  const cat = getEventCategory(inc, incKeys);
                  const catDef = EVENT_CATEGORIES[cat];
                  const cantCol = findColumnBySemantic(incKeys, 'cantidad');
                  const obsCol = findColumnBySemantic(incKeys, 'observacion');

                  const cant = cantCol && inc[cantCol] ? formatLocaleNumber(inc[cantCol]) : '-';
                  const obs = (obsCol && inc[obsCol]) || '-';

                  const resStatus = getItemResolutionStatus(inc, incKeys);

                  return (
                    <div key={idx} className={`p-3.5 bg-white dark:bg-slate-800 border rounded-xl flex items-center justify-between gap-4 shadow-sm ${resStatus.isResolved ? 'border-emerald-200 dark:border-emerald-800/60' : 'border-amber-200 dark:border-amber-800/60'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${catDef.iconBg} shrink-0`}>
                          {renderEventIcon(cat, 'w-4 h-4')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{catDef.shortLabel}</span>
                            {cant !== '-' && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold font-mono">{cant} un.</span>}
                            {resStatus.isResolved ? (
                              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md font-bold font-mono">
                                ✅ Realizado (TR: {resStatus.traspasoNumber})
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md font-bold">
                                ⏳ Pendiente (Sin Traspaso)
                              </span>
                            )}
                          </div>
                          {obs !== '-' && <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{obs}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cerrar
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNewEventForProduct(sku, 'VENCIMIENTO')}
              className="px-3.5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-200 dark:shadow-none flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Vencimiento</span>
            </button>
            <button
              onClick={() => onNewEventForProduct(sku, 'TRANSPORTE')}
              className="px-3.5 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 shadow-sm shadow-amber-200 dark:shadow-none flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Incidencia</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

