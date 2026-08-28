import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Loader2, Sparkles, AlertCircle, Link2, Info, Search, 
  Check, RotateCcw, Eye, EyeOff, Sliders, Plus, CheckCircle2, ChevronDown
} from 'lucide-react';
import { SheetProperties, InventoryItem, EventCategory, SheetConfig } from '../../types';
import { EVENT_CATEGORIES, renderEventIcon } from '../../utils/dateCalculations';
import { evaluateShowIf, getOperationalSuggestions, QUICK_QUANTITY_PRESETS } from '../../utils/dynamicFormRules';
import { 
  findMasterProduct, 
  searchMasterProducts, 
  dereferenceMasterProduct, 
  getMasterProductSummary,
  MasterProductSummary
} from '../../utils/referenceResolver';
import { findColumnBySemantic } from '../../utils/columnAliases';

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
  onBatchUpdateFormData?: (updates: Record<string, string>) => void;
  policies?: any[];
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
  products,
  onBatchUpdateFormData,
  policies = []
}) => {
  // Show_If state: whether to force show all fields or keep conditional filter
  const [showAllFields, setShowAllFields] = useState(false);

  // Ref / Master Catalog Search Typeahead state
  const [catalogSearchOpen, setCatalogSearchOpen] = useState(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const catalogSearchRef = useRef<HTMLDivElement>(null);

  // Close catalog search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (catalogSearchRef.current && !catalogSearchRef.current.contains(e.target as Node)) {
        setCatalogSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || !activeSheet) return null;

  const isMainOrEvents = activeView === 'main' || activeView === 'events';
  const categoryDef = EVENT_CATEGORIES[selectedEventCategory] || EVENT_CATEGORIES.VENCIMIENTO;

  // Identify key semantic columns in current headers
  const skuHeader = findColumnBySemantic(headers, 'sku', sheetConfig.customAliases) || headers.find(h => /sku|código|codigo/i.test(h));
  const currentSkuVal = skuHeader ? (formData[skuHeader] || '').trim() : '';

  // Look up linked master product
  const linkedMasterProduct = currentSkuVal && products.length > 0 
    ? findMasterProduct(currentSkuVal, products, sheetConfig.customAliases) 
    : null;
  const linkedMasterSummary = linkedMasterProduct 
    ? getMasterProductSummary(linkedMasterProduct, sheetConfig.customAliases) 
    : null;

  // Evaluate Show_If for all headers
  const evaluatedFields = headers.map(header => {
    const colSchema = sheetConfig.schema?.[activeSheet.title]?.[header];
    const isKey = colSchema?.isKey;
    const evaluation = evaluateShowIf(header, selectedEventCategory, formData, isKey, showAllFields);
    return {
      header,
      colSchema,
      isKey,
      ...evaluation
    };
  });

  const visibleFields = evaluatedFields.filter(f => f.isVisible);
  const hiddenFieldsCount = evaluatedFields.length - visibleFields.length;

  // Handler for selecting a product from the Ref Catalog
  const handleSelectMasterProduct = (selectedProd: MasterProductSummary) => {
    const updates: Record<string, string> = {};

    if (skuHeader) {
      updates[skuHeader] = selectedProd.sku;
    }

    // De-reference fields from master product to current sheet
    const dereferenced = dereferenceMasterProduct(selectedProd.raw, headers, sheetConfig.customAliases);
    Object.assign(updates, dereferenced);

    if (onBatchUpdateFormData) {
      onBatchUpdateFormData(updates);
    } else {
      // Fallback to updating each field sequentially
      Object.entries(updates).forEach(([k, v]) => {
        onChange({
          target: { name: k, value: String(v) }
        } as React.ChangeEvent<HTMLInputElement>);
      });
    }

    setCatalogSearchOpen(false);
    setCatalogSearchQuery('');
  };

  // Handler for inserting operational comment suggestion (Valid_If)
  const handleApplySuggestion = (header: string, suggestion: string) => {
    const currentVal = (formData[header] || '').trim();
    const newVal = currentVal ? `${currentVal}. ${suggestion}` : suggestion;

    if (onBatchUpdateFormData) {
      onBatchUpdateFormData({ [header]: newVal });
    } else {
      onChange({
        target: { name: header, value: newVal }
      } as React.ChangeEvent<HTMLTextAreaElement>);
    }
  };

  // Handler for quantity shortcuts
  const handleAdjustQuantity = (header: string, delta: number) => {
    const currentVal = parseInt(formData[header] || '0', 10);
    const newVal = Math.max(1, (isNaN(currentVal) ? 0 : currentVal) + delta);

    if (onBatchUpdateFormData) {
      onBatchUpdateFormData({ [header]: String(newVal) });
    } else {
      onChange({
        target: { name: header, value: String(newVal) }
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  // Handler for generating TR folio
  const handleGenerateTraspaso = (header: string) => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const folio = `TR-${randomNum}`;
    if (onBatchUpdateFormData) {
      onBatchUpdateFormData({ [header]: folio });
    } else {
      onChange({
        target: { name: header, value: folio }
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleClearTraspaso = (header: string) => {
    if (onBatchUpdateFormData) {
      onBatchUpdateFormData({ [header]: '' });
    } else {
      onChange({
        target: { name: header, value: '' }
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  // Filtered master catalog products for typeahead
  const catalogSearchResults = searchMasterProducts(
    catalogSearchQuery, 
    products, 
    8, 
    sheetConfig.customAliases
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                {editingItem ? 'Editar Registro' : 'Nuevo Registro'}
              </h3>
              <span className="text-[11px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                {activeSheet.title}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Formulario operativo con reglas condicionales y referencias maestras
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
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Tipo de Registro / Evento:
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                    Adapta campos (Show_If)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map(catKey => {
                    const cat = EVENT_CATEGORIES[catKey];
                    const isSelected = selectedEventCategory === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => onSelectEventCategory(catKey)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          isSelected 
                            ? `${cat.cardBorder} bg-white dark:bg-slate-800 shadow-sm` 
                            : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className={`p-1 rounded-lg ${cat.iconBg} shrink-0`}>
                          {renderEventIcon(catKey, 'w-3.5 h-3.5')}
                        </div>
                        <div className="overflow-hidden min-w-0">
                          <span className={`text-[11px] font-bold block truncate ${isSelected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                            {cat.shortLabel}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>{categoryDef.description}</span>
                </p>
              </div>
            )}

            {/* AppSheet Feature 1: Ref Active Banner (Linked Master Product) */}
            {linkedMasterSummary && (
              <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800/80 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.2 rounded font-mono">
                        Ref: Catálogo Maestro
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {linkedMasterSummary.name || linkedMasterSummary.sku}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {linkedMasterSummary.provider && `Proveedor: ${linkedMasterSummary.provider} • `}
                      {linkedMasterSummary.price && `Costo: $${linkedMasterSummary.price} • `}
                      {linkedMasterSummary.category && `Familia: ${linkedMasterSummary.category}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectMasterProduct(linkedMasterSummary)}
                  className="shrink-0 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 hover:shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                  title="Vuelve a rellenar descripción, proveedor y costo desde el catálogo maestro"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Sincronizar Ref</span>
                </button>
              </div>
            )}

            {/* AppSheet Feature 2: Show_If Control Bar */}
            <div className="flex items-center justify-between py-1.5 px-2 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Campos Relevantes (Show_If):
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md shadow-2xs border border-slate-200 dark:border-slate-600">
                  {visibleFields.length} de {headers.length}
                </span>
                {hiddenFieldsCount > 0 && !showAllFields && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    ({hiddenFieldsCount} ocultos por regla de categoría)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowAllFields(!showAllFields)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                {showAllFields ? (
                  <>
                    <EyeOff className="w-3 h-3" />
                    <span>Solo Relevantes</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" />
                    <span>Mostrar Todos ({headers.length})</span>
                  </>
                )}
              </button>
            </div>

            {/* Input Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleFields.map(({ header, colSchema, isKey }) => {
                const isAutoCalc = colSchema?.behavior === 'calc_fecha_vc' || 
                                   colSchema?.behavior === 'calc_retiro' || 
                                   colSchema?.behavior === 'auto_id' || 
                                   colSchema?.type === 'calculated' || 
                                   /^ID_VC$/i.test(header.trim());
                
                const isSku = /sku|código|codigo/i.test(header);
                const isObs = /observ|nota|motivo|detalle|coment|causa/i.test(header);
                const isCant = /^cant|unidades|stock/i.test(header);
                const isTraspasoCol = /traspaso/i.test(header);
                const traspasoVal = (formData[header] || '').trim();
                const isTraspasoFilled = traspasoVal !== '' && traspasoVal !== '-' && traspasoVal !== '0';
                
                const hasError = !!formErrors[header];
                const errorMsg = formErrors[header];

                return (
                  <div 
                    key={header} 
                    className={`flex flex-col gap-1.5 ${
                      isObs ? 'sm:col-span-2' : ''
                    } ${isTraspasoCol ? 'sm:col-span-2 bg-slate-50/80 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>{header}</span>
                        {isKey && (
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
                      
                      {/* SKU with catalog typeahead trigger */}
                      {isSku && products.length > 0 && (
                        <div className="relative" ref={catalogSearchRef}>
                          <button
                            type="button"
                            onClick={() => setCatalogSearchOpen(!catalogSearchOpen)}
                            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer"
                          >
                            <Search className="w-3 h-3" />
                            <span>Buscar en Catálogo ({products.length})</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>

                          {/* Autocomplete Dropdown */}
                          {catalogSearchOpen && (
                            <div className="absolute right-0 top-full mt-1 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                              <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Filtrar por SKU, nombre o proveedor..."
                                    value={catalogSearchQuery}
                                    onChange={(e) => setCatalogSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500"
                                  />
                                </div>
                              </div>
                              <div className="max-h-56 overflow-y-auto space-y-1 p-1">
                                {catalogSearchResults.length === 0 ? (
                                  <p className="text-center py-4 text-xs text-slate-400">
                                    No se encontraron productos en el catálogo.
                                  </p>
                                ) : (
                                  catalogSearchResults.map((prod) => (
                                    <button
                                      key={prod.sku}
                                      type="button"
                                      onClick={() => handleSelectMasterProduct(prod)}
                                      className="w-full text-left p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-transparent hover:border-blue-200 dark:hover:border-blue-800/60 transition-colors flex items-center justify-between gap-2 group cursor-pointer"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded">
                                            {prod.sku}
                                          </span>
                                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate block">
                                            {prod.name}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                          {prod.provider || 'Sin proveedor'} {prod.price ? `• $${prod.price}` : ''}
                                        </p>
                                      </div>
                                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold opacity-0 group-hover:opacity-100 shrink-0">
                                        Vincular
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Traspaso status badge */}
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
                          const summary = getMasterProductSummary(prod, sheetConfig.customAliases);
                          if (!summary.sku) return null;
                          return (
                            <option key={`ref-${idx}-${summary.sku}`} value={summary.sku}>
                              {summary.sku} {summary.name ? `- ${summary.name}` : ''}
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
                    ) : isObs ? (
                      <div className="space-y-2">
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

                        {/* AppSheet Feature 2: Valid_If Operational Suggestions */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Sugerencias operativas rápidas ({categoryDef.shortLabel}):</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {getOperationalSuggestions(selectedEventCategory).map((sugg, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleApplySuggestion(header, sugg)}
                                className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer"
                              >
                                + {sugg}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
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

                        {/* Quick Quantity Presets */}
                        {isCant && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Rápido:</span>
                            {QUICK_QUANTITY_PRESETS.map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => handleAdjustQuantity(header, q)}
                                className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                              >
                                +{q}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Traspaso helper buttons */}
                        {isTraspasoCol && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleGenerateTraspaso(header)}
                                className="text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Generar Folio TR</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearTraspaso(header)}
                                className="text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 px-2.5 py-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                              >
                                <span>Marcar Pendiente</span>
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-1">
                              💡 Registra el folio de traspaso de tu sistema para marcarlo como <strong>Realizado</strong>. Déjalo vacío para mantenerlo como <strong>Pendiente</strong>.
                            </p>
                          </div>
                        )}
                      </div>
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

            {/* Expand additional fields banner when some fields are hidden */}
            {hiddenFieldsCount > 0 && !showAllFields && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllFields(true)}
                  className="w-full py-2.5 px-4 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Mostrar {hiddenFieldsCount} campos secundarios no habituales para {categoryDef.shortLabel}</span>
                </button>
              </div>
            )}

          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-2 shrink-0">
            <div className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
              Presiona Enter para guardar o Esc para cancelar
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-200 dark:shadow-none flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{isSaving ? 'Guardando...' : editingItem ? 'Actualizar Fila' : 'Guardar en Sheet'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
