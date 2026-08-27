import React from 'react';
import { 
  X, Loader2, Sparkles, AlertCircle, Link2, Info 
} from 'lucide-react';
import { SheetProperties, InventoryItem, EventCategory, SheetConfig } from '../../types';
import { EVENT_CATEGORIES, renderEventIcon } from '../../utils/dateCalculations';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: InventoryItem | null;
  activeSheet: SheetProperties | null;
  activeView: string;
  headers: string[];
  formData: Record<string, string>;
  formErrors: Record<string, string>;
  selectedEventCategory: EventCategory;
  onSelectEventCategory: (cat: EventCategory) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  isSaving: boolean;
  sheetConfig: SheetConfig;
  products: any[];
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  activeSheet,
  activeView,
  headers,
  formData,
  formErrors,
  selectedEventCategory,
  onSelectEventCategory,
  onChange,
  onSave,
  isSaving,
  sheetConfig,
  products
}) => {
  if (!isOpen || !activeSheet) return null;

  const isMainOrEvents = activeView === 'main' || activeView === 'events';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
              {editingItem ? 'Editar Registro' : 'Nuevo Registro'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pestaña destino: <span className="font-bold text-slate-700 dark:text-slate-300">{activeSheet.title}</span>
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 p-2 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={onSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            
            {/* Event Category Selector (Main or Events views) */}
            {isMainOrEvents && (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                  Tipo de Registro / Evento:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map(catKey => {
                    const cat = EVENT_CATEGORIES[catKey];
                    const isSelected = selectedEventCategory === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => onSelectEventCategory(catKey)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                          isSelected 
                            ? `${cat.cardBorder} bg-white dark:bg-slate-800 shadow-sm` 
                            : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg ${cat.iconBg} shrink-0`}>
                          {renderEventIcon(catKey, 'w-3.5 h-3.5')}
                        </div>
                        <div className="overflow-hidden">
                          <span className={`text-xs font-bold block truncate ${isSelected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                            {cat.shortLabel}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                  {EVENT_CATEGORIES[selectedEventCategory].description}
                </p>
              </div>
            )}

            {/* Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {headers.map((header) => {
                const colSchema = sheetConfig.schema?.[activeSheet.title]?.[header];
                const isAutoCalc = colSchema?.behavior === 'calc_fecha_vc' || 
                                   colSchema?.behavior === 'calc_retiro' || 
                                   colSchema?.behavior === 'auto_id' || 
                                   colSchema?.type === 'calculated' || 
                                   /^ID_VC$/i.test(header.trim());
                
                const isSku = /sku|código|codigo/i.test(header);
                const hasError = !!formErrors[header];
                const errorMsg = formErrors[header];
                const isTraspasoCol = /traspaso/i.test(header);
                const traspasoVal = (formData[header] || '').trim();
                const isTraspasoFilled = traspasoVal !== '' && traspasoVal !== '-' && traspasoVal !== '0';

                // Auto-fill SKU quick badges if product catalog exists
                const isSkuWithCatalog = isSku && products.length > 0;

                return (
                  <div 
                    key={header} 
                    className={`flex flex-col gap-1.5 ${
                      /observ|nota|motivo|descrip|detalle/i.test(header) ? 'sm:col-span-2' : ''
                    } ${isTraspasoCol ? 'sm:col-span-2 bg-slate-50/80 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>{header}</span>
                        {colSchema?.isKey && (
                          <span className="text-[9px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-1 py-0.2 rounded font-mono font-bold">
                            KEY
                          </span>
                        )}
                        {isAutoCalc && (
                          <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded font-mono font-bold">
                            auto
                          </span>
                        )}
                      </label>
                      {isSkuWithCatalog && (
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5">
                          <Link2 className="w-3 h-3" /> Auto-completa producto
                        </span>
                      )}
                      {isTraspasoCol && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isTraspasoFilled 
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' 
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                        }`}>
                          {isTraspasoFilled ? '✅ Estado: Realizado' : '⏳ Estado: Pendiente'}
                        </span>
                      )}
                    </div>

                    {/* Input Element */}
                    {colSchema?.type === 'ref' ? (
                      <select
                        name={header}
                        value={formData[header] || ''}
                        onChange={onChange}
                        className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition-all ${
                          hasError 
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10' 
                            : 'border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                        }`}
                      >
                        <option value="">-- Seleccionar registro de {colSchema.refTable || 'tabla relacionada'} --</option>
                        {products.map((prod, idx) => {
                          const keys = Object.keys(prod);
                          const targetSchema = colSchema.refTable ? sheetConfig.schema?.[colSchema.refTable] : undefined;
                          
                          // Look for explicit schema marked key/label first
                          let valKey = targetSchema ? Object.keys(targetSchema).find(k => targetSchema[k]?.isKey) : undefined;
                          let labelKey = targetSchema ? Object.keys(targetSchema).find(k => targetSchema[k]?.isLabel) : undefined;
                          
                          // Fallback to semantic matching
                          if (!valKey) {
                            valKey = keys.find(k => /sku|id|codigo|code/i.test(k)) || keys[0];
                          }
                          if (!labelKey) {
                            labelKey = keys.find(k => /desc|nombre|name|title|producto/i.test(k)) || keys[1] || keys[0];
                          }

                          const val = valKey ? prod[valKey] : '';
                          const label = labelKey ? prod[labelKey] : val;
                          if (!val) return null;
                          return (
                            <option key={`ref-${idx}-${val}`} value={val}>
                              {val} {label && label !== val ? `- ${label}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    ) : colSchema?.type === 'enum' && colSchema.options ? (
                      <select
                        name={header}
                        value={formData[header] || ''}
                        onChange={onChange}
                        className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition-all ${
                          hasError 
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10' 
                            : 'border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                        }`}
                      >
                        <option value="">-- Seleccionar --</option>
                        {colSchema.options.split(',').map((opt: string) => (
                          <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                        ))}
                      </select>
                    ) : /observ|nota|motivo|detalle/i.test(header) ? (
                      <textarea
                        name={header}
                        rows={2}
                        value={formData[header] || ''}
                        onChange={onChange}
                        placeholder={`Ingresa ${header.toLowerCase()}...`}
                        className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3.5 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition-all resize-none ${
                          hasError 
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10' 
                            : 'border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                        }`}
                      />
                    ) : (
                      <input
                        type={
                          colSchema?.type === 'datetime' ? 'datetime-local' :
                          colSchema?.type === 'date' || (/fecha/i.test(header) && !/time/i.test(header)) ? 'date' :
                          colSchema?.type === 'number' || /^cant|unidades|stock|dias|precio/i.test(header) ? 'number' : 'text'
                        }
                        name={header}
                        value={formData[header] || ''}
                        onChange={onChange}
                        readOnly={isAutoCalc}
                        placeholder={
                          isAutoCalc 
                            ? 'Calculado automáticamente' 
                            : isTraspasoCol 
                              ? 'Ej. TR-99823 (dejar vacío si aún está pendiente)' 
                              : `Ingresa ${header.toLowerCase()}...`
                        }
                        className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition-all ${
                          isAutoCalc
                            ? 'bg-slate-100/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                            : hasError
                              ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                        }`}
                      />
                    )}

                    {isTraspasoCol && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        💡 Anota el número de traspaso entregado por tu otro sistema informático para marcar este registro como <strong>Realizado</strong>. Si aún no ha sido gestionado, déjalo vacío y figurará como <strong>Pendiente</strong>.
                      </p>
                    )}

                    {/* Error message */}
                    {hasError && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 mt-0.5">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errorMsg}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-200 dark:shadow-none flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{isSaving ? 'Guardando...' : editingItem ? 'Actualizar Fila' : 'Guardar en Sheet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
