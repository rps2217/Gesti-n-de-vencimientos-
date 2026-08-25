import React from 'react';
import { InventoryItem, ViewTicketConfig, TicketColumnConfig } from '../../types';
import { findColumnBySemantic } from '../../utils/columnAliases';

interface TicketPrintViewProps {
  items: InventoryItem[];
  headers: string[];
  config: ViewTicketConfig;
}

export const TicketPrintView: React.FC<TicketPrintViewProps> = ({ items, headers, config }) => {
  if (!items || items.length === 0) return null;

  // Check if user has explicitly configured at least one column to show
  const hasCustomConfig = Object.values(config).some((c: any) => c && c.show);

  // Determine which headers are visible
  const visibleHeaders = hasCustomConfig 
    ? headers.filter(h => (config[h] as TicketColumnConfig)?.show)
    : headers;

  // Detect semantic columns
  const skuHeader = headers.find(h => findColumnBySemantic([h], 'sku') !== undefined);
  const descHeader = headers.find(h => findColumnBySemantic([h], 'descripcion') !== undefined);
  const dateHeader = headers.find(h => findColumnBySemantic([h], 'fecha_vc') !== undefined);
  const loteHeader = headers.find(h => findColumnBySemantic([h], 'lote') !== undefined);
  const cantHeader = headers.find(h => findColumnBySemantic([h], 'cantidad') !== undefined);

  // Check if each semantic column is allowed to show
  const showSku = !hasCustomConfig || (skuHeader ? (config[skuHeader] as TicketColumnConfig)?.show : false);
  const showDesc = !hasCustomConfig || (descHeader ? (config[descHeader] as TicketColumnConfig)?.show : false);
  const showDate = !hasCustomConfig || (dateHeader ? (config[dateHeader] as TicketColumnConfig)?.show : false);
  const showLote = !hasCustomConfig || (loteHeader ? (config[loteHeader] as TicketColumnConfig)?.show : false);
  const showCant = !hasCustomConfig || (cantHeader ? (config[cantHeader] as TicketColumnConfig)?.show : false);

  // Other visible headers not captured as primary semantic ones
  const primaryHeaders = new Set([skuHeader, descHeader, dateHeader, loteHeader, cantHeader].filter(Boolean));
  const otherVisibleHeaders = visibleHeaders.filter(h => !primaryHeaders.has(h));

  return (
    <div className="hidden print:block w-[76mm] p-2 text-black font-mono leading-tight print:bg-white print:text-black">
      
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

          // Config for styling SKU, Desc, Date, Lote, Cant
          const skuConf = skuHeader ? (config[skuHeader] as TicketColumnConfig) : undefined;
          const descConf = descHeader ? (config[descHeader] as TicketColumnConfig) : undefined;
          const dateConf = dateHeader ? (config[dateHeader] as TicketColumnConfig) : undefined;
          const loteConf = loteHeader ? (config[loteHeader] as TicketColumnConfig) : undefined;
          const cantConf = cantHeader ? (config[cantHeader] as TicketColumnConfig) : undefined;

          return (
            <div key={idx} className="border-b border-dotted border-black py-1.5 break-words break-inside-avoid">
              <div className="flex flex-col gap-0.5">
                
                {/* SKU + Description Line */}
                {((showSku && skuVal) || (showDesc && descVal)) && (
                  <div 
                    style={{ fontSize: `${Math.max(skuConf?.size || descConf?.size || 12, 10)}px` }}
                    className={`leading-snug ${(skuConf?.bold || descConf?.bold) ? 'font-bold' : 'font-normal'}`}
                  >
                    {showSku && skuVal && <span className="font-mono">[{skuVal}] </span>}
                    {showDesc && descVal && descVal !== skuVal && <span>{descVal}</span>}
                  </div>
                )}

                {/* Batch & Quantity Line */}
                {((showLote && loteVal) || (showCant && cantVal)) && (
                  <div className="text-[10px] flex gap-3 text-slate-800 dark:text-black mt-0.5">
                    {showLote && loteVal && (
                      <span 
                        style={{ fontSize: `${loteConf?.size || 10}px` }}
                        className={loteConf?.bold ? 'font-bold' : 'font-medium'}
                      >
                        Lote: {loteVal}
                      </span>
                    )}
                    {showCant && cantVal && (
                      <span 
                        style={{ fontSize: `${cantConf?.size || 10}px` }}
                        className={cantConf?.bold ? 'font-bold' : 'font-medium'}
                      >
                        Cant: {cantVal}
                      </span>
                    )}
                  </div>
                )}

                {/* Other custom visible headers */}
                {otherVisibleHeaders.map(header => {
                  const val = item[header];
                  if (val === undefined || val === null || String(val).trim() === '') return null;
                  const hConf = config[header] as TicketColumnConfig;
                  return (
                    <div 
                      key={header} 
                      style={{ fontSize: `${hConf?.size || 10}px` }}
                      className={`mt-0.5 text-black ${hConf?.bold ? 'font-bold' : 'font-normal'}`}
                    >
                      <span className="opacity-80">{header}: </span>
                      <span>{String(val)}</span>
                    </div>
                  );
                })}

                {/* Expiration Date Line (At the very end) */}
                {showDate && dateVal && (
                  <div 
                    style={{ fontSize: `${dateConf?.size || 11}px` }}
                    className={`mt-0.5 ${dateConf?.bold ? 'font-bold' : 'font-medium'}`}
                  >
                    <span>F.Venc: </span>
                    <span>{dateVal}</span>
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
