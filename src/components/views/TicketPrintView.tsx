import React from 'react';
import { InventoryItem, ViewTicketConfig } from '../../types';

interface TicketPrintViewProps {
  items: InventoryItem[];
  headers: string[];
  config: ViewTicketConfig;
}

export const TicketPrintView: React.FC<TicketPrintViewProps> = ({ items, headers, config }) => {
  if (!items || items.length === 0) return null;

  // Filter headers that are marked as 'show' in the configuration
  const visibleHeaders = headers.filter(h => config[h]?.show);

  return (
    <div className="hidden print:block fixed inset-0 bg-white text-black font-mono z-[99999] p-1 w-[76mm] box-border text-[11px] leading-tight print:bg-white print:text-black">
      
      {/* TICKET HEADER */}
      <div className="text-center border-b border-dashed border-black pb-1.5 mb-2">
        <h2 className="text-[13px] m-0 mb-1 uppercase font-bold">REPORTE INVENTARIO</h2>
        <p className="m-0 mt-0.5 text-[10px]">Fecha: {new Date().toLocaleString()}</p>
        <p className="m-0 text-[10px]">Total ítems: {items.length}</p>
      </div>

      {/* TICKET ITEMS */}
      <div className="flex flex-col">
        {items.map((item, idx) => (
          <div key={idx} className="border-b border-dotted border-gray-500 py-1 break-words">
            <div className="flex flex-col gap-0.5">
              {visibleHeaders.map(header => {
                const colConfig = config[header];
                const value = item[header] !== undefined && item[header] !== null ? String(item[header]) : '-';
                
                return (
                  <div key={header} className="flex justify-between items-start gap-1 overflow-hidden">
                    <span 
                      style={{ fontSize: `${colConfig.size}px` }} 
                      className="shrink-0 truncate opacity-80"
                    >
                      {header}:
                    </span>
                    <span 
                      style={{ 
                        fontSize: `${colConfig.size}px`, 
                        fontWeight: colConfig.bold ? 'bold' : 'normal' 
                      }}
                      className="text-right break-words max-w-[70%]"
                    >
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* TICKET FOOTER */}
      <div className="text-center border-t border-dashed border-black mt-2.5 pt-1.5 text-[10px] font-bold pb-4">
        --- FIN DEL REPORTE ---
      </div>
    </div>
  );
};
