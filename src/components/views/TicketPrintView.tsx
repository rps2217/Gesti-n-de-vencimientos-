import React from 'react';
import { InventoryItem, ViewTicketConfig } from '../../types';
import { findColumnBySemantic } from '../../utils/columnAliases';

interface TicketPrintViewProps {
  items: InventoryItem[];
  headers: string[];
  config: ViewTicketConfig;
}

export const TicketPrintView: React.FC<TicketPrintViewProps> = ({ items, headers, config }) => {
  if (!items || items.length === 0) return null;

  const visibleHeaders = headers.filter(h => config[h]?.show);

  // Detect semantic columns from visible headers or all headers
  const skuHeader = visibleHeaders.find(h => findColumnBySemantic([h], 'sku') !== undefined) || findColumnBySemantic(headers, 'sku');
  const descHeader = visibleHeaders.find(h => findColumnBySemantic([h], 'descripcion') !== undefined) || findColumnBySemantic(headers, 'descripcion');
  const dateHeader = visibleHeaders.find(h => findColumnBySemantic([h], 'fecha_vc') !== undefined) || findColumnBySemantic(headers, 'fecha_vc');
  const loteHeader = visibleHeaders.find(h => findColumnBySemantic([h], 'lote') !== undefined) || findColumnBySemantic(headers, 'lote');
  const cantHeader = visibleHeaders.find(h => findColumnBySemantic([h], 'cantidad') !== undefined) || findColumnBySemantic(headers, 'cantidad');

  // Other visible headers not already captured as primary
  const usedHeaders = new Set([skuHeader, descHeader, dateHeader, loteHeader, cantHeader].filter(Boolean));
  const otherHeaders = visibleHeaders.filter(h => !usedHeaders.has(h));

  return (
    <div className="hidden print:block w-[76mm] p-2 text-black font-mono text-[11px] leading-tight print:bg-white print:text-black">
      
      {/* TICKET HEADER */}
      <div className="text-center border-b border-dashed border-black pb-1.5 mb-2">
        <h2 className="text-[13px] m-0 mb-1 uppercase font-bold tracking-wider">REPORTE VENCIMIENTOS</h2>
        <p className="m-0 mt-0.5 text-[10px]">Fecha: {new Date().toLocaleString()}</p>
        <p className="m-0 text-[10px]">Total ítems: {items.length}</p>
      </div>

      {/* TICKET ITEMS */}
      <div className="flex flex-col">
        {items.map((item, idx) => {
          const skuVal = skuHeader ? String(item[skuHeader] || '').trim() : '';
          const descVal = descHeader ? String(item[descHeader] || '').trim() : '';
          const dateVal = dateHeader ? String(item[dateHeader] || '').trim() : '';
          const loteVal = loteHeader ? String(item[loteHeader] || '').trim() : '';
          const cantVal = cantHeader ? String(item[cantHeader] || '').trim() : '';

          return (
            <div key={idx} className="border-b border-dotted border-black py-1.5 break-words break-inside-avoid">
              <div className="flex flex-col gap-0.5">
                
                {/* SKU + Description (Line 1) */}
                {(skuVal || descVal) ? (
                  <div className="font-bold text-[12px] leading-snug">
                    {skuVal && <span className="font-mono">[{skuVal}] </span>}
                    {descVal && descVal !== skuVal && <span>{descVal}</span>}
                  </div>
                ) : visibleHeaders.length > 0 ? (
                  <div className="font-bold text-[12px] leading-snug">
                    {String(item[visibleHeaders[0]] || '')}
                  </div>
                ) : null}

                {/* Batch & Quantity */}
                {(loteVal || cantVal) && (
                  <div className="text-[10px] flex gap-3 text-slate-800 dark:text-black mt-0.5 font-medium">
                    {loteVal && <span>Lote: {loteVal}</span>}
                    {cantVal && <span>Cant: {cantVal}</span>}
                  </div>
                )}

                {/* Other selected columns without bulky prefix headers */}
                {otherHeaders.map(header => {
                  const val = item[header];
                  if (val === undefined || val === null || String(val).trim() === '') return null;
                  return (
                    <div key={header} className="text-[10px] text-slate-800 dark:text-black mt-0.5">
                      <span className="opacity-80">{header}: </span>
                      <span className="font-medium">{String(val)}</span>
                    </div>
                  );
                })}

                {/* Expiration Date Line (At the very end) */}
                {dateVal && (
                  <div className="text-[11px] mt-0.5 font-medium">
                    <span>F.Venc: </span>
                    <span className="font-bold">{dateVal}</span>
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

      {/* TICKET FOOTER */}
      <div className="text-center border-t border-dashed border-black mt-2.5 pt-1.5 text-[10px] font-bold pb-4">
        --- FIN DEL REPORTE ---
      </div>
    </div>
  );
};
