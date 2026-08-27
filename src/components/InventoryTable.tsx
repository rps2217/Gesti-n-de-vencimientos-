import React from 'react';
import { InventoryItem, EventCategory } from '../types';
import { ColumnFilterMenu } from './views/ColumnFilterMenu';
import { InventoryTableRow } from './views/InventoryTableRow';
import { ColumnMetadata } from '../hooks/usePrecomputedColumns';
import { GripVertical, ChevronDown } from 'lucide-react';
import { findColumnBySemantic } from '../utils/columnAliases';
import { EVENT_CATEGORIES } from '../utils/dateCalculations';

interface InventoryTableProps {
  filteredItems: InventoryItem[];
  selectedRowIds: number[];
  setSelectedRowIds: (ids: number[]) => void;
  headers: string[];
  visibleHeaders: string[];
  visibleColumnMeta: ColumnMetadata[];
  activeView: 'main' | 'events' | 'products' | 'policies';
  tableContainerRef: React.RefObject<HTMLDivElement>;
  getColWidth: (headerId: string, label: string, type?: string) => number;
  handleStartResize: (colId: string, startWidth: number, e: React.MouseEvent) => void;
  handleAutoFitColumn: (colId: string, label: string) => void;
  resizingCol: { colId: string; startWidth: number } | null;
  pmRadarFilter: string[];
  setPmRadarFilter: React.Dispatch<React.SetStateAction<string[]>>;
  handleFilterToggle: (prev: string[], val: string, isMulti: boolean) => string[];
  onSelectRow: (rowIndex: number, selected: boolean) => void;
  onClickItem: (item: InventoryItem) => void;
  onDeleteRow: (item: InventoryItem) => void;
  onPmRadarFilterClick: (targetFilter: string, isMulti: boolean) => void;
  onEventResolutionFilterClick: (status: 'pending' | 'completed', isMulti: boolean) => void;
  onEventFilterClick: (eventCat: any, isMulti: boolean) => void;
  onFrcBodFilterClick: (bodVal: string, isMulti: boolean) => void;
  onOpenQuickTraspaso: (item: InventoryItem) => void;
  frcBodFilter: string[];
  setFrcBodFilter: React.Dispatch<React.SetStateAction<string[]>>;
  sheetConfig: any;
  activeSheet: any;
  draggedCol: string | null;
  setDraggedCol: (col: string | null) => void;
  dragOverCol: string | null;
  setDragOverCol: (col: string | null) => void;
  handleColumnDrop: (target: string, source: string) => void;
  eventFilter: string[];
  setEventFilter: React.Dispatch<React.SetStateAction<string[]>>;
  eventResolutionFilter: string[];
  setEventResolutionFilter: React.Dispatch<React.SetStateAction<string[]>>;
  columnFilters: Record<string, string[]>;
  setColumnFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  columnOptionsMap: Record<string, any[]>;
  frcBodValues: string[];
  frcBodCounts: Record<string, number>;
  frcBodCol: string;
  virtualRows: any[];
  paginatedDisplayRows: any[];
  paddingTop: number;
  paddingBottom?: number;
  groupByColumn?: string;
  toggleGroupCollapse?: (groupKey: string) => void;
  measureElementRef?: (node: HTMLElement | null) => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  filteredItems,
  selectedRowIds,
  setSelectedRowIds,
  headers,
  visibleHeaders,
  visibleColumnMeta,
  activeView,
  tableContainerRef,
  getColWidth,
  handleStartResize,
  handleAutoFitColumn,
  resizingCol,
  pmRadarFilter,
  setPmRadarFilter,
  handleFilterToggle,
  onSelectRow,
  onClickItem,
  onDeleteRow,
  onPmRadarFilterClick,
  onEventResolutionFilterClick,
  onEventFilterClick,
  onFrcBodFilterClick,
  onOpenQuickTraspaso,
  frcBodFilter,
  setFrcBodFilter,
  sheetConfig,
  activeSheet,
  draggedCol,
  setDraggedCol,
  dragOverCol,
  setDragOverCol,
  handleColumnDrop,
  eventFilter,
  setEventFilter,
  eventResolutionFilter,
  setEventResolutionFilter,
  columnFilters,
  setColumnFilters,
  columnOptionsMap,
  frcBodValues,
  frcBodCounts,
  frcBodCol,
  virtualRows,
  paginatedDisplayRows,
  paddingTop,
  paddingBottom = 0,
  groupByColumn,
  toggleGroupCollapse,
  measureElementRef
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-full">
      <div className="flex-1 overflow-auto relative" ref={tableContainerRef}>
        <table className="text-left border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
          <thead className="bg-slate-100 dark:bg-slate-700/90 sticky top-0 border-b border-slate-200 dark:border-slate-600/80 text-xs font-bold text-slate-700 dark:text-slate-100 uppercase tracking-wider select-none z-10 shadow-sm">
            <tr>
              <th className="p-4 text-center bg-slate-100 dark:bg-slate-700/90 border-b border-slate-200 dark:border-slate-600/80" style={{ width: '48px', minWidth: '48px' }}>
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 focus:ring-blue-500 cursor-pointer"
                    checked={filteredItems.length > 0 && selectedRowIds.length === filteredItems.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRowIds(filteredItems.map(i => i._rowIndex as number));
                      } else {
                        setSelectedRowIds([]);
                      }
                    }}
                    title="Seleccionar todos"
                  />
                </div>
              </th>
              <th 
                style={{ width: `${getColWidth('_row', '#')}px`, minWidth: '50px' }} 
                className="p-4 text-center text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/90 border-b border-slate-200 dark:border-slate-600/80 relative group font-bold"
              >
                <span>#</span>
                <div
                  onMouseDown={(e) => handleStartResize('_row', getColWidth('_row', '#'), e)}
                  onDoubleClick={() => handleAutoFitColumn('_row', '#')}
                  className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/80 transition-colors z-20 flex items-center justify-center ${
                    resizingCol?.colId === '_row' ? 'bg-blue-600 w-2.5' : ''
                  }`}
                >
                  <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-500 group-hover:bg-blue-500"></div>
                </div>
              </th>

              {activeView === 'main' && (
                <th 
                  style={{ width: `${getColWidth('_status', 'Estado / Radar PM')}px`, minWidth: '130px' }} 
                  className="p-3 bg-slate-100 dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600/80 relative group font-bold"
                >
                  <div className="flex items-center justify-between gap-1 w-full min-w-0 pr-1">
                    <span className="truncate pr-1">Estado / Radar PM</span>
                    <ColumnFilterMenu
                      title="Estado Radar PM"
                      options={[
                        { label: 'En Regla', value: 'en_regla', badgeClass: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Drenaje', value: 'drainage', badgeClass: 'text-amber-600 dark:text-amber-400' },
                        { label: 'Próximo a Retiro', value: 'upcoming', badgeClass: 'text-rose-600 dark:text-rose-400' },
                        { label: 'Retirar YA', value: 'retire_now', badgeClass: 'text-red-600 dark:text-red-400' }
                      ]}
                      selectedValues={pmRadarFilter}
                      onToggle={(val, isMulti) => setPmRadarFilter(prev => handleFilterToggle(prev, val, isMulti))}
                      onClear={() => setPmRadarFilter([])}
                    />
                  </div>
                  <div
                    onMouseDown={(e) => handleStartResize('_status', getColWidth('_status', 'Estado / Radar PM'), e)}
                    onDoubleClick={() => handleAutoFitColumn('_status', 'Estado / Radar PM')}
                    className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/80 transition-colors z-20 flex items-center justify-center ${
                      resizingCol?.colId === '_status' ? 'bg-blue-600 w-2.5' : ''
                    }`}
                  >
                     <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-500 group-hover:bg-blue-500"></div>
                  </div>
                </th>
              )}

              {activeView === 'events' && (
                <th 
                  style={{ width: `${getColWidth('_res_status', 'Estado Gestión')}px`, minWidth: '125px' }} 
                  className="p-4 bg-slate-100 dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600/80 relative group font-bold"
                >
                  <div className="truncate pr-2">Estado Gestión</div>
                  <div
                    onMouseDown={(e) => handleStartResize('_res_status', getColWidth('_res_status', 'Estado Gestión'), e)}
                    onDoubleClick={() => handleAutoFitColumn('_res_status', 'Estado Gestión')}
                    className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/80 transition-colors z-20 flex items-center justify-center ${
                      resizingCol?.colId === '_res_status' ? 'bg-blue-600 w-2.5' : ''
                    }`}
                  >
                    <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-500 group-hover:bg-blue-500"></div>
                  </div>
                </th>
              )}

              {visibleHeaders.map((header, idx) => {
                const colSchema = sheetConfig.schema?.[activeSheet?.title || '']?.[header];
                const width = getColWidth(header, header, colSchema?.type);
                const isResizingThis = resizingCol?.colId === header;
                const isDraggingThis = draggedCol === header;
                const isDropTarget = dragOverCol === header && draggedCol !== header;
                
                const isEventCol = /^frc(_|\s)?even/i.test(header.trim()) || findColumnBySemantic(headers, 'tipo_evento') === header;
                const isTraspasoCol = /traspaso/i.test(header) || findColumnBySemantic(headers, 'n_traspaso') === header;
                const isBodCol = header === frcBodCol || /^frc(_|\s)?bod/i.test(header.trim()) || findColumnBySemantic(headers, 'frc_bod') === header || /bodega/i.test(header.trim());

                const alignRight = idx > visibleHeaders.length - 3;

                return (
                  <th 
                    key={header} 
                    style={{ width: `${width}px`, minWidth: '85px' }}
                    className={`p-3 bg-slate-100 dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600/80 relative group transition-all cursor-grab active:cursor-grabbing hover:bg-slate-200/90 dark:hover:bg-slate-600/90 dark:hover:text-white select-none ${
                      isDraggingThis ? 'opacity-40 scale-[0.98]' : ''
                    } ${
                      isDropTarget ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/50 dark:bg-blue-950/50 shadow-inner' : ''
                    }`}
                    draggable={true}
                    onDragStart={(e) => {
                      setDraggedCol(header);
                      e.dataTransfer.setData('text/plain', header);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverCol !== header) {
                        setDragOverCol(header);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverCol === header) {
                        setDragOverCol(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedHeader = e.dataTransfer.getData('text/plain');
                      setDraggedCol(null);
                      setDragOverCol(null);
                      if (droppedHeader) {
                        handleColumnDrop(header, droppedHeader);
                      }
                    }}
                    onDragEnd={() => {
                      setDraggedCol(null);
                      setDragOverCol(null);
                    }}
                    title="Mantén presionado y arrastra para reordenar columna"
                  >
                    <div className="flex items-center justify-between gap-1 w-full min-w-0 pr-1">
                      <div className="flex items-center gap-1 min-w-0 truncate">
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 group-hover:text-blue-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="truncate font-bold tracking-tight">{header}</span>
                        {colSchema?.isKey && (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-1 py-0.2 rounded font-mono font-bold shrink-0">
                            ID
                          </span>
                        )}
                        {colSchema?.type === 'ref' && (
                          <span className="text-[9px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-1 py-0.2 rounded font-mono shrink-0">
                            REF
                          </span>
                        )}
                      </div>

                      {isEventCol ? (
                        <ColumnFilterMenu
                          title="Incidencias"
                          options={(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map(cat => ({
                            label: EVENT_CATEGORIES[cat].name,
                            value: cat,
                            badgeClass: EVENT_CATEGORIES[cat].badgeText
                          }))}
                          selectedValues={eventFilter}
                          onToggle={(val, isMulti) => setEventFilter(prev => handleFilterToggle(prev, val, isMulti))}
                          onClear={() => setEventFilter([])}
                          alignRight={alignRight}
                        />
                      ) : isBodCol && frcBodValues.length > 0 ? (
                        <ColumnFilterMenu
                          title="Bodegas (FRC_BOD)"
                          options={frcBodValues.map(bod => ({
                            label: `${bod} (${frcBodCounts[bod] || 0})`,
                            value: bod,
                            badgeClass: 'text-sky-600 dark:text-sky-400 font-bold'
                          }))}
                          selectedValues={frcBodFilter}
                          onToggle={(val, isMulti) => setFrcBodFilter(prev => handleFilterToggle(prev, val, isMulti))}
                          onClear={() => setFrcBodFilter([])}
                          alignRight={alignRight}
                        />
                      ) : isTraspasoCol ? (
                        <ColumnFilterMenu
                          title="Traspaso / Estado"
                          options={[
                            { label: '--- Estado ---', value: 'header_status', disabled: true },
                            { label: 'Pendientes', value: 'pending', badgeClass: 'text-amber-600 dark:text-amber-400' },
                            { label: 'Realizados', value: 'completed', badgeClass: 'text-emerald-600 dark:text-emerald-400' },
                            { label: '--- Documentos ---', value: 'header_docs', disabled: true },
                            ...(columnOptionsMap[header] || [])
                          ]}
                          selectedValues={eventResolutionFilter}
                          onToggle={(val, isMulti) => setEventResolutionFilter(prev => handleFilterToggle(prev, val, isMulti))}
                          onClear={() => setEventResolutionFilter([])}
                          alignRight={alignRight}
                        />
                      ) : (
                        <ColumnFilterMenu
                          title={header}
                          options={columnOptionsMap[header] || []}
                          selectedValues={columnFilters[header] || []}
                          onToggle={(val, isMulti) => setColumnFilters(prev => ({
                            ...prev,
                            [header]: handleFilterToggle(prev[header] || [], val, isMulti)
                          }))}
                          onClear={() => setColumnFilters(prev => ({ ...prev, [header]: [] }))}
                          alignRight={alignRight}
                        />
                      )}
                    </div>
                  </th>
                );
              })}

              {/* Fixed Actions Column Header */}
              <th className="p-4 text-right bg-slate-100 dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600/80 sticky right-0 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.03)] w-24 min-w-[96px] font-bold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-200">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={visibleHeaders.length + (activeView === 'main' || activeView === 'events' ? 4 : 3)} className="p-8 text-center text-slate-400 dark:text-slate-500">
                  No hay datos en esta hoja.
                </td>
              </tr>
            ) : (<>
              {paddingTop > 0 && (
                <tr><td style={{ height: `${paddingTop}px` }} colSpan={visibleHeaders.length + (activeView === 'main' || activeView === 'events' ? 4 : 3)} /></tr>
              )}
              {virtualRows.map((virtualRow) => {
                const rowData = paginatedDisplayRows[virtualRow.index];
                const idx = virtualRow.index;
                if (!rowData) return null;

                // Render group header
                if (rowData.type === 'header') {
                  const isCollapsed = rowData.isCollapsed;
                  return (
                    <tr
                      key={`group-hdr-${rowData.groupKey}-${idx}`}
                      data-index={virtualRow.index}
                      ref={measureElementRef}
                      onClick={() => toggleGroupCollapse?.(rowData.groupKey)}
                      className="bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 cursor-pointer select-none border-y-2 border-slate-200 dark:border-slate-700 transition-colors"
                      title={isCollapsed ? 'Clic para expandir grupo' : 'Clic para contraer grupo'}
                    >
                      <td
                        colSpan={visibleHeaders.length + (activeView === 'main' || activeView === 'events' ? 4 : 3)}
                        className="px-4 py-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              {groupByColumn}:
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                              {rowData.groupKey}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono font-bold">
                              {rowData.count} {rowData.count === 1 ? 'registro' : 'registros'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                            {isCollapsed ? 'Contraído (clic para ver)' : 'Expandido'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }
                
                const item = rowData.item;
                return (
                  <InventoryTableRow
                    key={`item-${item._rowIndex || idx}`}
                    item={item}
                    virtualIndex={idx}
                    headers={headers}
                    visibleColumnMeta={visibleColumnMeta}
                    activeView={activeView}
                    isSelected={selectedRowIds.includes(item._rowIndex as number)}
                    frcBodFilter={frcBodFilter}
                    getColWidth={getColWidth}
                    measureElementRef={measureElementRef}
                    onSelectRow={onSelectRow}
                    onClickItem={onClickItem}
                    onDeleteRow={onDeleteRow}
                    onPmRadarFilterClick={onPmRadarFilterClick}
                    onEventResolutionFilterClick={onEventResolutionFilterClick}
                    onEventFilterClick={onEventFilterClick}
                    onFrcBodFilterClick={onFrcBodFilterClick}
                    onOpenQuickTraspaso={onOpenQuickTraspaso}
                  />
                );
              })}
              {paddingBottom > 0 && (
                <tr><td style={{ height: `${paddingBottom}px` }} colSpan={visibleHeaders.length + (activeView === 'main' || activeView === 'events' ? 4 : 3)} /></tr>
              )}
            </>)}
          </tbody>
        </table>
      </div>
    </div>
  );
};
