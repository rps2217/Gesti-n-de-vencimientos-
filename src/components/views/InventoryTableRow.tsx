import React, { useMemo } from 'react';
import { 
  CheckCircle2, Clock3, Edit2, Plus, Trash2, Building2, MessageSquare 
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
import { findPhoneColumn } from '../../utils/columnAliases';

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
}) => {
  const eventCategory = getEventCategory(item, headers);
  const status = getItemStatus(item, headers);
  const isEventView = activeView === 'events';
  const eventResStatus = isEventView ? getItemResolutionStatus(item, headers) : null;
  const isProductsView = activeView === 'products';
  
  const hasPhone = useMemo(() => {
    return headers.some(h => /tel|cel|phone|whatsapp|wsp/i.test(h)) || /contacto|contact/i.test(String(activeView));
  }, [headers, activeView]);

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
      className={`transition-colors group cursor-pointer ${rowBgClass}`}
      title="Haz clic para ver detalles del registro"
    >
      {/* Selection Checkbox */}
      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 focus:ring-blue-500 cursor-pointer"
            checked={isSelected}
            onChange={(e) => onSelectRow(item._rowIndex as number, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </td>

      {/* Row Index */}
      <td 
        style={{ width: `${getColWidth('_row', '#')}px` }}
        className="p-4 text-center font-mono text-xs text-slate-400 dark:text-slate-500 truncate"
      >
        {item._rowIndex}
      </td>

      {/* Expiration Status Badge (Main view) */}
      {activeView === 'main' && (
        <td 
          style={{ width: `${getColWidth('_status', 'Estado / Radar PM')}px` }}
          className="p-4 truncate"
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border truncate cursor-pointer hover:opacity-80 transition-opacity ${status.color}`}
              title="Clic normal: Solo este estado. Ctrl+Clic: Sumar estado."
            >
              <span className="shrink-0">{status.icon}</span>
              <span className="truncate">{status.label}</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500 italic">Incidencia FRC</span>
          )}
        </td>
      )}

      {/* Incident Resolution Status Badge (Events view) */}
      {activeView === 'events' && (
        <td 
          style={{ width: `${getColWidth('_res_status', 'Estado Gestión')}px` }}
          className="p-4 truncate"
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
            style={{ width: `${colWidth}px`, maxWidth: `${colWidth}px` }}
            className="p-4 truncate text-slate-800 dark:text-slate-200"
          >
            {isProductsView && isSku ? (
              <button 
                onClick={() => onClickItem(item)}
                className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-center gap-1 truncate text-left"
                title="Ver detalle del producto y registros relacionados"
              >
                <span className="truncate">{String(val || '')}</span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-1 py-0.2 rounded font-mono shrink-0">
                  DETALLE
                </span>
              </button>
            ) : isSku && val ? (
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-100 truncate block">
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
                <div className="flex items-center gap-1.5 group/traspaso">
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
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border border-dashed border-amber-400 dark:border-amber-600/90 bg-amber-50/90 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all cursor-pointer group shrink-0"
                  title="Anotar número de traspaso de su sistema informático"
                >
                  <Plus className="w-3 h-3 group-hover:scale-125 transition-transform text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Anotar Traspaso</span>
                </button>
              )
            ) : (
              <span className="truncate block">
                {val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '-'}
              </span>
            )}
          </td>
        );
      })}

      {/* Row Actions */}
      <td 
        className="p-4 text-right sticky right-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.03)] w-28 min-w-[110px]" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-1">
          {hasPhone && (
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
