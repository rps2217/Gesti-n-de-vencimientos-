import React, { useMemo } from 'react';
import { 
  CheckCircle2, Clock3, Edit2, Plus, Trash2, Building2, MessageSquare, Mail 
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { 
  getItemStatus, 
  getEventCategory, 
  getItemResolutionStatus, 
  getCategoryFromEventValue, 
  EVENT_CATEGORIES, 
  renderEventIcon 
} from '../../utils/dateCalculations';
import { ColumnMetadata } from '../../hooks/usePrecomputedColumns';
import { findPhoneColumn, findEmailColumn, findColumnBySemantic } from '../../utils/columnAliases';

export interface InventoryTableRowProps {
  item: InventoryItem;
  virtualIndex: number;
  headers: string[];
  visibleColumnMeta: ColumnMetadata[];
  activeView: 'main' | 'events' | 'products' | 'policies' | string;
  isSelected: boolean;
  frcBodFilter: string[];
  getColWidth: (headerId: string, label: string) => number;
  measureElementRef?: (node: HTMLElement | null) => void;
  onSelectRow: (rowIndex: number, selected: boolean) => void;
  onClickItem: (item: InventoryItem) => void;
  onDeleteRow: (item: InventoryItem) => void;
  onPmRadarFilterClick: (targetFilter: string, isMulti: boolean) => void;
  onEventResolutionFilterClick: (status: 'pending' | 'completed', isMulti: boolean) => void;
  onEventFilterClick: (eventCat: any, isMulti: boolean) => void;
  onFrcBodFilterClick: (bodVal: string, isMulti: boolean) => void;
  onOpenQuickTraspaso: (item: InventoryItem) => void;
  onOpenWhatsApp?: (item: InventoryItem) => void;
  onOpenEmail?: (item: InventoryItem) => void;
  isWhatsAppEnabled?: boolean;
  isEmailEnabled?: boolean;
}

export const InventoryTableRow: React.FC<InventoryTableRowProps> = React.memo(({
  item,
  virtualIndex,
  headers,
  visibleColumnMeta,
  activeView,
  isSelected,
  frcBodFilter,
  getColWidth,
  measureElementRef,
  onSelectRow,
  onClickItem,
  onDeleteRow,
  onPmRadarFilterClick,
  onEventResolutionFilterClick,
  onEventFilterClick,
  onFrcBodFilterClick,
  onOpenQuickTraspaso,
  onOpenWhatsApp,
  onOpenEmail,
  isWhatsAppEnabled = true,
  isEmailEnabled = true,
}) => {
  const eventCategory = getEventCategory(item, headers);
  const status = getItemStatus(item, headers);
  const isEventView = activeView === 'events';
  const eventResStatus = isEventView ? getItemResolutionStatus(item, headers) : null;
  const isProductsView = activeView === 'products';
  
  const hasPhone = useMemo(() => {
    const pCol = findPhoneColumn(headers);
    return !!pCol && !!item[pCol];
  }, [headers, item]);

  const hasEmail = useMemo(() => {
    const eCol = findEmailColumn(headers);
    return !!eCol && !!item[eCol];
  }, [headers, item]);

  // Extract core semantic columns for the mobile card view
  const skuCol = useMemo(() => findColumnBySemantic(headers, 'sku'), [headers]);
  const descCol = useMemo(() => findColumnBySemantic(headers, 'descripcion'), [headers]);
  const qtyCol = useMemo(() => findColumnBySemantic(headers, 'cantidad'), [headers]);
  const dateCol = useMemo(() => findColumnBySemantic(headers, 'fecha_vc') || findColumnBySemantic(headers, 'fecha_retiro'), [headers]);

  let rowBgClass = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60';
  if (isSelected) {
    rowBgClass = 'bg-blue-50/50 dark:bg-blue-950/40 hover:bg-blue-50 dark:hover:bg-blue-950/60';
  } else if (isEventView) {
    rowBgClass = eventResStatus?.isResolved
      ? 'bg-emerald-50/25 dark:bg-emerald-950/20 border-l-4 border-l-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/35'
      : 'bg-amber-50/30 dark:bg-amber-950/25 border-l-4 border-l-amber-500 hover:bg-amber-50/60 dark:hover:bg-amber-950/40';
  }

  return (
    <tr 
      key={`item-${item._rowIndex || virtualIndex}`} 
      data-index={virtualIndex} 
      ref={measureElementRef} 
      onClick={() => onClickItem(item)}
      className={`transition-colors group cursor-pointer ${rowBgClass} md:border-b border-transparent md:border-slate-100 dark:md:border-slate-800 block md:table-row w-full bg-transparent md:bg-white dark:md:bg-slate-900`}
      title="Haz clic para ver detalles del registro"
    >
      {/* 📱 TRUE MOBILE CARD VIEW (Only visible on small screens) */}
      <td className="md:hidden p-4 relative block w-full bg-white dark:bg-slate-900 rounded-2xl mb-3 shadow-sm border border-slate-200 dark:border-slate-800" colSpan={visibleColumnMeta.length + 4} onClick={(e) => { e.stopPropagation(); onClickItem(item); }}>
        <div className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-start pr-8">
            <div className="flex flex-col gap-1.5">
              {/* Badge Area */}
              {activeView === 'main' ? (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${status.color} border w-fit`}>
                  {status.icon} {status.label}
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border w-fit ${eventCategory ? EVENT_CATEGORIES[eventCategory]?.badgeBg + ' ' + EVENT_CATEGORIES[eventCategory]?.badgeText + ' ' + EVENT_CATEGORIES[eventCategory]?.badgeBorder : 'bg-slate-100 text-slate-700'}`}>
                  {eventCategory && renderEventIcon(eventCategory, 'w-3 h-3')} {eventCategory || 'Evento'}
                </span>
              )}
              {/* SKU Title */}
              <span className="font-mono text-base font-black text-slate-900 dark:text-slate-100">
                {skuCol && item[skuCol] ? String(item[skuCol]) : 'Sin SKU'}
              </span>
            </div>
            
            {/* Checkbox (Absolute positioning so it doesn't shift the flex layout) */}
            <div className="absolute top-0 right-0 p-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                className="w-5 h-5 text-blue-600 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 focus:ring-blue-500 cursor-pointer shadow-sm"
                checked={isSelected}
                onChange={(e) => onSelectRow(item._rowIndex as number, e.target.checked)}
              />
            </div>
          </div>

          {/* Description / Item Name */}
          <div className="text-sm text-slate-700 dark:text-slate-300 leading-snug line-clamp-2 pr-4 font-medium">
            {descCol && item[descCol] ? String(item[descCol]) : 'Sin descripción'}
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 mt-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/80">
            {qtyCol && item[qtyCol] && (
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">CANTIDAD</span>
                <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">{String(item[qtyCol])}</span>
              </div>
            )}
            {dateCol && item[dateCol] && (
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">FECHA</span>
                <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">{String(item[dateCol])}</span>
              </div>
            )}
            {activeView === 'events' && eventResStatus && (
              <div className="flex flex-col col-span-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ESTADO GESTIÓN</span>
                <span className={`font-semibold text-sm flex items-center gap-1 ${eventResStatus.isResolved ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {eventResStatus.isResolved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock3 className="w-3.5 h-3.5 animate-pulse" />}
                  {eventResStatus.isResolved ? 'Resuelto' : 'Pendiente'}
                </span>
              </div>
            )}
          </div>

          {/* Mobile Action Bar */}
          <div className="mt-1 flex justify-between items-center px-1">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1 group-hover:underline">
              <Plus className="w-3 h-3" /> VER DETALLE
            </span>
            <div className="flex items-center gap-1">
              {hasEmail && isEmailEnabled && (
                <button onClick={(e) => { e.stopPropagation(); onOpenEmail?.(item); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <Mail className="w-4 h-4"/>
                </button>
              )}
              {hasPhone && isWhatsAppEnabled && (
                <button onClick={(e) => { e.stopPropagation(); onOpenWhatsApp?.(item); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <MessageSquare className="w-4 h-4"/>
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onDeleteRow(item); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-full transition-colors">
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          </div>
        </div>
      </td>

      {/* 💻 DESKTOP TABLE VIEW */}
      {/* Selection Checkbox */}
      <td className="hidden md:table-cell p-4 text-center" style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="w-5 h-5 md:w-4 md:h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 focus:ring-blue-500 cursor-pointer shadow-sm md:shadow-none"
            checked={isSelected}
            onChange={(e) => onSelectRow(item._rowIndex as number, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </td>

      {/* Row Index */}
      <td 
        style={{ width: `${getColWidth('_row', '#')}px`, minWidth: `${getColWidth('_row', '#')}px`, maxWidth: `${getColWidth('_row', '#')}px` }}
        className="hidden md:table-cell p-4 text-center font-mono text-xs text-slate-400 dark:text-slate-500 truncate"
      >
        {item._rowIndex}
      </td>

      {/* Expiration Status Badge (Main view) - Unified Single Badge */}
      {activeView === 'main' && (
        <td 
          style={{ width: `${getColWidth('_status', 'Estado / Radar PM')}px`, minWidth: `${getColWidth('_status', 'Estado / Radar PM')}px`, maxWidth: `${getColWidth('_status', 'Estado / Radar PM')}px` }}
          className="hidden md:table-cell p-3 truncate"
        >
          {eventCategory === 'VENCIMIENTO' || eventCategory === 'VENCIMIENTO_CERCANO' ? (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const code = status.code;
                const targetFilter = 
                  (code === 'EXPIRED' || code === 'RETIRE_NOW') ? 'retire_now' :
                  (code === 'UPCOMING') ? 'upcoming' :
                  (code === 'DRAINAGE_PM') ? 'drainage' : 'en_regla';
                onPmRadarFilterClick(targetFilter, e.ctrlKey || e.metaKey);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border truncate cursor-pointer hover:opacity-90 transition-all ${status.color}`}
              title="Clic para filtrar por este estado comercial. Ctrl+Clic: Sumar filtro."
            >
              <span className="shrink-0">{status.icon}</span>
              <span className="truncate font-bold">{status.label}</span>
              {status.actionType === 'CANJE_PROVEEDOR' && (status.code === 'EXPIRED' || status.code === 'RETIRE_NOW' || status.code === 'UPCOMING') && (
                <span className="ml-1 text-[10px] uppercase font-black tracking-wider px-1.5 py-0.2 rounded bg-indigo-200/60 dark:bg-indigo-900/80 text-indigo-900 dark:text-indigo-200 border border-indigo-300/80 dark:border-indigo-700 shrink-0">
                  Canje
                </span>
              )}
              {status.actionType === 'MERMA_DIRECTA' && (status.code === 'EXPIRED' || status.code === 'RETIRE_NOW') && (
                <span className="ml-1 text-[10px] uppercase font-black tracking-wider px-1.5 py-0.2 rounded bg-rose-200/60 dark:bg-rose-900/80 text-rose-900 dark:text-rose-200 border border-rose-300/80 dark:border-rose-700 shrink-0">
                  Merma
                </span>
              )}
            </button>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500 italic">Incidencia FRC</span>
          )}
        </td>
      )}

      {/* Incident Resolution Status Badge (Events view) */}
      {activeView === 'events' && (
        <td 
          style={{ width: `${getColWidth('_res_status', 'Estado Gestión')}px`, minWidth: `${getColWidth('_res_status', 'Estado Gestión')}px`, maxWidth: `${getColWidth('_res_status', 'Estado Gestión')}px` }}
          className="hidden md:table-cell p-4 truncate"
        >
          {eventResStatus?.isResolved ? (
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                onEventResolutionFilterClick('completed', e.ctrlKey || e.metaKey); 
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/80 shadow-2xs cursor-pointer hover:opacity-80 transition-opacity"
              title="Clic normal: Solo realizados. Ctrl+Clic: Sumar."
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Realizado</span>
            </button>
          ) : (
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                onEventResolutionFilterClick('pending', e.ctrlKey || e.metaKey); 
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 shadow-2xs cursor-pointer hover:opacity-80 transition-opacity"
              title="Clic normal: Solo pendientes. Ctrl+Clic: Sumar."
            >
              <Clock3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
              <span>Pendiente</span>
            </button>
          )}
        </td>
      )}

      {/* Cell Values using Precomputed Column Metadata */}
      {visibleColumnMeta.map(({ header, isSku, isEventCol, isTraspasoCol, isBodCol }) => {
        const val = item[header];
        const eventCat = isEventCol && val ? getCategoryFromEventValue(val) : null;
        const colWidth = getColWidth(header, header);

        return (
          <td 
            key={header} 
            style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px` }}
            className="hidden md:table-cell p-4 truncate text-slate-800 dark:text-slate-200"
          >
            <div className="w-full flex justify-start overflow-hidden">
              {isProductsView && isSku ? (
                <button 
                  onClick={() => onClickItem(item)}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-center gap-1 truncate text-left"
                  title="Ver detalle del producto y registros relacionados"
                >
                  <span className="truncate max-w-[200px]">{String(val || '')}</span>
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-1 py-0.2 rounded font-mono shrink-0">
                    DETALLE
                  </span>
                </button>
              ) : isSku && val ? (
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100 truncate block text-left">
                  {String(val)}
                </span>
              ) : eventCat ? (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onEventFilterClick(eventCat, e.ctrlKey || e.metaKey); 
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${EVENT_CATEGORIES[eventCat].badgeBg} ${EVENT_CATEGORIES[eventCat].badgeText} ${EVENT_CATEGORIES[eventCat].badgeBorder} truncate cursor-pointer hover:opacity-80 transition-opacity`}
                  title="Clic normal: Solo este tipo. Ctrl+Clic: Sumar."
                >
                  {renderEventIcon(eventCat, 'w-3.5 h-3.5 shrink-0')}
                  <span className="truncate">{String(val)}</span>
                </button>
              ) : isBodCol && val !== undefined && val !== null && String(val).trim() !== '' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const bodVal = String(val).trim();
                    onFrcBodFilterClick(bodVal, e.ctrlKey || e.metaKey);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border truncate cursor-pointer transition-all shadow-2xs ${
                    frcBodFilter.includes(String(val).trim())
                      ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-300 dark:ring-blue-800'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                  }`}
                  title={`Bodega: ${String(val)}. Clic normal: Filtrar solo esta bodega. Ctrl+Clic: Sumar al filtro.`}
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">{String(val)}</span>
                </button>
              ) : isEventView && isTraspasoCol ? (
                val !== undefined && val !== null && String(val).trim() !== '' ? (
                  <div className="flex items-center justify-start gap-1.5 group/traspaso w-full">
                    <span className="font-mono font-bold text-xs bg-emerald-100/90 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/80 px-2 py-0.5 rounded-md truncate">
                      {String(val)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenQuickTraspaso(item);
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 opacity-0 group-hover/traspaso:opacity-100 transition-opacity rounded cursor-pointer shrink-0"
                      title="Modificar N° Traspaso"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenQuickTraspaso(item);
                    }}
                    className="inline-flex items-center justify-start gap-1 px-2 py-1 rounded-lg text-xs font-bold border border-dashed border-amber-400 dark:border-amber-600/90 bg-amber-50/90 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all cursor-pointer group shrink-0"
                    title="Anotar número de traspaso de su sistema informático"
                  >
                    <Plus className="w-3 h-3 group-hover:scale-125 transition-transform text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="truncate">Anotar Traspaso</span>
                  </button>
                )
              ) : (
                <span className="truncate block text-left w-full">
                  {val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '-'}
                </span>
              )}
            </div>
          </td>
        );
      })}

      {/* Row Actions */}
      <td 
        className="hidden md:table-cell p-4 text-right sticky right-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.03)]" 
        style={{ width: '110px', minWidth: '110px', maxWidth: '110px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-1">
          {hasEmail && isEmailEnabled && (
            <button 
              onClick={() => onOpenEmail?.(item)} 
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Enviar Correo Electrónico"
            >
              <Mail className="w-4 h-4"/>
            </button>
          )}
          {hasPhone && isWhatsAppEnabled && (
            <button 
              onClick={() => onOpenWhatsApp?.(item)} 
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Enviar mensaje de WhatsApp"
            >
              <MessageSquare className="w-4 h-4"/>
            </button>
          )}
          <button 
            onClick={() => onDeleteRow(item)} 
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Eliminar fila"
          >
            <Trash2 className="w-4 h-4"/>
          </button>
        </div>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // Ultra-fast memo comparison for 60fps virtualization scrolling
  if (prevProps.item !== nextProps.item) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.virtualIndex !== nextProps.virtualIndex) return false;
  if (prevProps.activeView !== nextProps.activeView) return false;
  if (prevProps.visibleColumnMeta !== nextProps.visibleColumnMeta) return false;
  if (prevProps.frcBodFilter !== nextProps.frcBodFilter) return false;
  if (prevProps.getColWidth !== nextProps.getColWidth) return false;
  return true;
});
