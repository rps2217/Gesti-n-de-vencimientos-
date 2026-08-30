import React from 'react';
import { InventoryItem, ViewTicketConfig, TicketColumnConfig } from '../../types';
import { findColumnBySemantic } from '../../utils/columnAliases';
import { normalizeTicketConfig } from '../../utils/ticketUtils';

interface TicketPrintViewProps {
  items: InventoryItem[];
  headers: string[];
  config: ViewTicketConfig;
  activeView?: string;
}

export const TicketPrintView: React.FC<TicketPrintViewProps> = ({ 
  items, 
  headers, 
  config,
  activeView = 'main'
}) => {
  if (!items || items.length === 0) return null;

  // Normalize configuration with backward and forward compatibility
  const normalized = normalizeTicketConfig(config, headers, activeView);
  const colConfig = normalized.columns;
  const general = normalized.general || {
    title: activeView === 'events' ? 'REGISTRO DE INCIDENCIAS' : 'REPORTE VENCIMIENTOS',
    paperWidth: '80mm',
    showDateTime: true,
    showTotalCount: true,
    footerText: '--- FIN DEL REPORTE ---'
  };

  // Detect semantic columns
  const skuHeader = headers.find(h => findColumnBySemantic([h], 'sku') !== undefined);
  const descHeader = headers.find(h => findColumnBySemantic([h], 'descripcion') !== undefined);
  const dateHeader = headers.find(h => findColumnBySemantic([h], 'fecha_vc') !== undefined);
  const loteHeader = headers.find(h => findColumnBySemantic([h], 'lote') !== undefined);
  const cantHeader = headers.find(h => findColumnBySemantic([h], 'cantidad') !== undefined);

  // Check if each semantic column is allowed to show
  const showSku = skuHeader ? colConfig[skuHeader]?.show : false;
  const showDesc = descHeader ? colConfig[descHeader]?.show : false;
  const showDate = dateHeader ? colConfig[dateHeader]?.show : false;
  const showLote = loteHeader ? colConfig[loteHeader]?.show : false;
  const showCant = cantHeader ? colConfig[cantHeader]?.show : false;

  // Other visible headers not captured as primary semantic ones
  const primaryHeaders = new Set([skuHeader, descHeader, dateHeader, loteHeader, cantHeader].filter(Boolean));
  const otherVisibleHeaders = headers.filter(h => !primaryHeaders.has(h) && colConfig[h]?.show);

  const is58mm = general.paperWidth === '58mm';

  return (
    <div 
      className={`hidden print:block text-black font-mono leading-tight print:bg-white print:text-black ${
        is58mm ? 'w-[56mm] p-1' : 'w-[76mm] p-2'
      }`}
      style={{ margin: 0 }}
    >
      
      {/* TICKET HEADER */}
      <div className="text-center border-b border-dashed border-black pb-1.5 mb-2">
        <h2 className="text-[13px] m-0 mb-1 uppercase font-bold tracking-wider leading-snug">
          {general.title || 'REPORTE VENCIMIENTOS'}
        </h2>
        {general.showDateTime !== false && (
          <p className="m-0 mt-0.5 text-[10px]">Fecha: {new Date().toLocaleString()}</p>
        )}
        {general.showTotalCount !== false && (
          <p className="m-0 text-[10px]">Total ítems: {items.length}</p>
        )}
      </div>

      {/* TICKET ITEMS */}
      <div className="flex flex-col">
        {items.map((item, idx) => {
          const skuVal = skuHeader ? String(item[skuHeader] || '').trim() : '';
          const descVal = descHeader ? String(item[descHeader] || '').trim() : '';
          const dateVal = dateHeader ? String(item[dateHeader] || '').trim() : '';
          const loteVal = loteHeader ? String(item[loteHeader] || '').trim() : '';
          const cantVal = cantHeader ? String(item[cantHeader] || '').trim() : '';

          const skuConf = skuHeader ? colConfig[skuHeader] : undefined;
          const descConf = descHeader ? colConfig[descHeader] : undefined;
          const dateConf = dateHeader ? colConfig[dateHeader] : undefined;
          const loteConf = loteHeader ? colConfig[loteHeader] : undefined;
          const cantConf = cantHeader ? colConfig[cantHeader] : undefined;

          return (
            <div key={idx} className="border-b border-dotted border-black py-1.5 break-words break-inside-avoid">
              <div className="flex flex-col gap-0.5">
                
                {/* SKU + Description Line with Independent Typography */}
                {((showSku && skuVal) || (showDesc && descVal)) && (
                  <div className="leading-snug">
                    {showSku && skuVal && (
                      <span 
                        style={{ fontSize: `${skuConf?.size || 12}px` }}
                        className={`font-mono ${skuConf?.bold ? 'font-bold' : 'font-normal'}`}
                      >
                        [{skuVal}]{descVal && descVal !== skuVal ? ' ' : ''}
                      </span>
                    )}
                    {showDesc && descVal && descVal !== skuVal && (
                      <span 
                        style={{ fontSize: `${descConf?.size || 11}px` }}
                        className={descConf?.bold ? 'font-bold' : 'font-normal'}
                      >
                        {descVal}
                      </span>
                    )}
                  </div>
                )}

                {/* Batch & Quantity Line */}
                {((showLote && loteVal) || (showCant && cantVal)) && (
                  <div className="text-[10px] flex gap-3 text-black mt-0.5">
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
                  const hConf = colConfig[header] as TicketColumnConfig;
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

                {/* Expiration Date Line (At the very end of item block) */}
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
        {general.footerText || '--- FIN DEL REPORTE ---'}
      </div>
    </div>
  );
};
