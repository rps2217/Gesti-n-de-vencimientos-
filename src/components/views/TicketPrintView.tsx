import React from 'react';
import { InventoryItem, TicketPrintConfig } from '../../types';
import { findColumnBySemantic } from '../../utils/columnAliases';

interface TicketPrintViewProps {
  items: InventoryItem[];
  headers: string[];
  config: TicketPrintConfig;
}

export const TicketPrintView: React.FC<TicketPrintViewProps> = ({ items, headers, config }) => {
  if (!items || items.length === 0) return null;

  const skuCol = findColumnBySemantic(headers, 'sku') || '';
  const descCol = findColumnBySemantic(headers, 'descripcion') || '';
  const fvcCol = findColumnBySemantic(headers, 'fecha_vc') || '';
  const fretiroCol = findColumnBySemantic(headers, 'fecha_retiro') || '';
  const polCol = findColumnBySemantic(headers, 'politica') || '';

  return (
    <div className="hidden print:block fixed inset-0 bg-white text-black font-mono z-[99999] p-1 w-[76mm] box-border text-[11px] leading-tight print:bg-white print:text-black">
      
      {/* TICKET HEADER */}
      <div className="text-center border-b border-dashed border-black pb-1.5 mb-2">
        <h2 className="text-[13px] m-0 mb-1 uppercase font-bold">REPORTE VENCIMIENTOS</h2>
        <p className="m-0 mt-0.5 text-[10px]">Fecha: {new Date().toLocaleString()}</p>
        <p className="m-0 text-[10px]">Total ítems: {items.length}</p>
      </div>

      {/* TICKET ITEMS */}
      <div className="flex flex-col">
        {items.map((item, idx) => {
          const sku = skuCol && item[skuCol] ? String(item[skuCol]) : '-';
          const desc = descCol && item[descCol] ? String(item[descCol]) : 'DESCRIPCIÓN NO DISPONIBLE';
          const fVc = fvcCol && item[fvcCol] ? String(item[fvcCol]) : '-';
          const fRetiro = fretiroCol && item[fretiroCol] ? String(item[fretiroCol]) : '-';
          const pol = polCol && item[polCol] ? String(item[polCol]) : '-';

          return (
            <div key={idx} className="border-b border-dotted border-gray-500 py-1 break-words">
              {/* Header (SKU + Desc) */}
              <div className="mb-0.5">
                {config.showSku && (
                  <span 
                    style={{ fontSize: `${config.sizeSku}px`, fontWeight: config.boldSku ? 'bold' : 'normal' }}
                    className="mr-1"
                  >
                    [{sku}]
                  </span>
                )}
                {config.showDesc && (
                  <span 
                    style={{ fontSize: `${config.sizeDesc}px`, fontWeight: config.boldDesc ? 'bold' : 'normal' }}
                    className="uppercase"
                  >
                    {desc}
                  </span>
                )}
              </div>
              
              {/* Details (Fechas + Pol) */}
              <div className="flex justify-between whitespace-nowrap gap-1 mt-0.5 overflow-hidden">
                {config.showFvc && (
                  <span style={{ fontSize: `${config.sizeFvc}px` }}>
                    F.Venc: <b style={{ fontWeight: config.boldFvc ? 'bold' : 'normal' }}>{fVc}</b>
                  </span>
                )}
                {config.showFretiro && (
                  <span style={{ fontSize: `${config.sizeFretiro}px` }}>
                    Retiro: <b style={{ fontWeight: config.boldFretiro ? 'bold' : 'normal' }}>{fRetiro}</b>
                  </span>
                )}
                {config.showPol && (
                  <span style={{ fontSize: `${config.sizePol}px` }}>
                    Pol: <b style={{ fontWeight: config.boldPol ? 'bold' : 'normal' }}>{pol}</b>
                  </span>
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
