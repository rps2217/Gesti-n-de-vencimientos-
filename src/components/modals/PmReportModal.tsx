import React, { useState } from 'react';
import { Flame, X, CheckCircle2, CheckCheck, Copy } from 'lucide-react';
import { InventoryItem } from '../../types';
import { getItemStatus, formatDisplayDate } from '../../utils/dateCalculations';
import { findColumnBySemantic } from '../../utils/columnAliases';

interface PmReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  drainageReportItems: InventoryItem[];
}

export const PmReportModal: React.FC<PmReportModalProps> = ({
  isOpen,
  onClose,
  drainageReportItems
}) => {
  const [copiedReport, setCopiedReport] = useState(false);

  if (!isOpen) return null;

  const copyPmReportToClipboard = () => {
    const lines = [
      '🚨 SOLICITUD DE PRECIO ESPECIAL / DRENAJE PARA PRODUCT MANAGER',
      `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
      `Total productos críticos: ${drainageReportItems.length}`,
      '------------------------------------------------------------'
    ];

    drainageReportItems.forEach((it, idx) => {
      const keys = Object.keys(it);
      const skuCol = findColumnBySemantic(keys, 'sku');
      const descCol = findColumnBySemantic(keys, 'descripcion');
      const vcCol = findColumnBySemantic(keys, 'fecha_vc');
      const retCol = findColumnBySemantic(keys, 'fecha_retiro');

      const sku = (skuCol && it[skuCol]) || it['SKU'] || '-';
      const desc = (descCol && it[descCol]) || '-';
      const fVc = vcCol && it[vcCol] ? formatDisplayDate(it[vcCol]) : '-';
      const fRet = retCol && it[retCol] ? formatDisplayDate(it[retCol]) : '-';
      const st = getItemStatus(it, keys);
      lines.push(`${idx + 1}. [SKU: ${sku}] ${desc} | Vence: ${fVc} | Retiro: ${fRet} (${st.label})`);
    });

    lines.push('------------------------------------------------------------');
    lines.push('Acción requerida: Definir descuento o precio especial para drenar unidades antes de fecha de retiro.');

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-orange-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500 text-white rounded-xl shadow-md shadow-orange-200">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Reporte de Drenaje para Product Manager (PM)</h3>
              <p className="text-xs text-orange-800">
                Productos con vencimiento próximo para solicitar precio especial o descuento de liquidación.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 p-2 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {drainageReportItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-bold text-slate-700">¡Todo en orden!</h4>
              <p className="text-xs text-slate-400 mt-1">No hay productos en ventana crítica de retiro actualmente.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Producto / Descripción</th>
                    <th className="p-3">Vencimiento</th>
                    <th className="p-3">Fecha Retiro</th>
                    <th className="p-3">Días Restantes</th>
                    <th className="p-3">Estado Comercial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drainageReportItems.map((it, idx) => {
                    const keys = Object.keys(it);
                    const st = getItemStatus(it, keys);
                    const skuCol = findColumnBySemantic(keys, 'sku');
                    const descCol = findColumnBySemantic(keys, 'descripcion');
                    const vcCol = findColumnBySemantic(keys, 'fecha_vc');
                    const retCol = findColumnBySemantic(keys, 'fecha_retiro');

                    const sku = (skuCol && it[skuCol]) || it['SKU'] || '-';
                    const desc = (descCol && it[descCol]) || '-';
                    const fVc = vcCol && it[vcCol] ? formatDisplayDate(it[vcCol]) : '-';
                    const fRet = retCol && it[retCol] ? formatDisplayDate(it[retCol]) : '-';

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-blue-600">{sku}</td>
                        <td className="p-3 font-medium text-slate-800">{desc}</td>
                        <td className="p-3 font-medium text-slate-600">{fVc}</td>
                        <td className="p-3 font-medium text-slate-600">{fRet}</td>
                        <td className="p-3 font-mono font-bold text-slate-800">{st.daysToRetire ?? '-'} días</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${st.color}`}>
                            {st.icon}
                            <span>{st.label}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 font-medium">
            {drainageReportItems.length} registros listos para enviar al PM
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100"
            >
              Cerrar
            </button>
            <button
              onClick={copyPmReportToClipboard}
              disabled={drainageReportItems.length === 0}
              className="px-4 py-2 bg-orange-600 text-white font-bold text-xs rounded-xl hover:bg-orange-700 flex items-center gap-1.5 shadow-sm shadow-orange-200 disabled:opacity-50"
            >
              {copiedReport ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedReport ? '¡Copiado al Portapapeles!' : 'Copiar Resumen para PM'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

