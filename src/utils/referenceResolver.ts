import { findColumnBySemantic, KnownFieldSemantic } from './columnAliases';
import { parseAnyDate, calculateWithdrawalDate } from './dateCalculations';
import { extractCuVcFromRow } from './cuVcConsolidator';
import { SheetConfig } from '../types';

export interface MasterProductSummary {
  sku: string;
  name: string;
  provider: string;
  price: string;
  category: string;
  raw: any;
}

export interface MasterCatalogIndex {
  exactMap: Map<string, any>;
  alphaMap: Map<string, any>;
  summaryMap: Map<string, MasterProductSummary>;
  summaries: MasterProductSummary[];
  getBySku: (sku: string) => MasterProductSummary | null;
  getRawBySku: (sku: string) => any | null;
  search: (query: string, limit?: number) => MasterProductSummary[];
}

/**
 * Builds a high-performance O(1) indexed catalog for lightning-fast PDA barcode scanning.
 * Pre-computes summaries and hash indexes so scans don't perform O(N) array traversals or regexes.
 */
export function buildMasterCatalogIndex(
  products: any[],
  customAliases?: Record<string, string[]>
): MasterCatalogIndex {
  const exactMap = new Map<string, any>();
  const alphaMap = new Map<string, any>();
  const summaryMap = new Map<string, MasterProductSummary>();
  const summaries: MasterProductSummary[] = [];

  if (!products || products.length === 0) {
    return {
      exactMap,
      alphaMap,
      summaryMap,
      summaries,
      getBySku: () => null,
      getRawBySku: () => null,
      search: () => []
    };
  }

  const firstProd = products[0];
  const keys = Object.keys(firstProd || {});
  const skuCol = findColumnBySemantic(keys, 'sku', customAliases) || keys.find(k => /sku|código|codigo/i.test(k));

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    if (!prod) continue;

    const summary = getMasterProductSummary(prod, customAliases);
    summaries.push(summary);

    const rawSku = skuCol ? prod[skuCol] : (prod.SKU || prod.sku);
    const skuStr = String(rawSku !== undefined && rawSku !== null ? rawSku : summary.sku).trim();

    if (skuStr) {
      const lower = skuStr.toLowerCase();
      exactMap.set(lower, prod);
      exactMap.set(skuStr, prod);
      summaryMap.set(lower, summary);
      summaryMap.set(skuStr, summary);

      const alpha = lower.replace(/[^a-z0-9]/g, '');
      if (alpha && !alphaMap.has(alpha)) {
        alphaMap.set(alpha, prod);
      }
    }

    // Also index by any barcode / EAN columns if present
    for (const k of Object.keys(prod)) {
      if (/barcode|ean|c[oó]d(_|\s)?barra/i.test(k) && prod[k]) {
        const barcodeVal = String(prod[k]).trim().toLowerCase();
        if (barcodeVal) {
          if (!exactMap.has(barcodeVal)) exactMap.set(barcodeVal, prod);
          if (!summaryMap.has(barcodeVal)) summaryMap.set(barcodeVal, summary);
        }
      }
    }
  }

  const getRawBySku = (sku: string): any | null => {
    if (!sku) return null;
    const clean = String(sku).trim().toLowerCase();
    if (!clean) return null;

    // 1. Direct O(1) hash map lookup
    const direct = exactMap.get(clean);
    if (direct) return direct;

    // 2. Alphanumeric match O(1)
    const alpha = clean.replace(/[^a-z0-9]/g, '');
    if (alpha) {
      const alphaMatch = alphaMap.get(alpha);
      if (alphaMatch) return alphaMatch;
    }

    return null;
  };

  const getBySku = (sku: string): MasterProductSummary | null => {
    if (!sku) return null;
    const clean = String(sku).trim().toLowerCase();
    if (!clean) return null;

    const direct = summaryMap.get(clean);
    if (direct) return direct;

    const raw = getRawBySku(sku);
    if (raw) {
      return getMasterProductSummary(raw, customAliases);
    }
    return null;
  };

  const search = (query: string, limit: number = 8): MasterProductSummary[] => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return summaries.slice(0, limit);

    const tokens = q.split(/\s+/).filter(Boolean);

    const results: MasterProductSummary[] = [];
    for (let i = 0; i < summaries.length; i++) {
      const s = summaries[i];
      const skuL = s.sku.toLowerCase();
      const nameL = s.name.toLowerCase();
      const provL = s.provider.toLowerCase();
      const catL = s.category.toLowerCase();

      const matchesAll = tokens.every(t => 
        skuL.includes(t) || nameL.includes(t) || provL.includes(t) || catL.includes(t)
      );

      if (matchesAll) {
        results.push(s);
        if (results.length >= limit) break;
      }
    }
    return results;
  };

  return {
    exactMap,
    alphaMap,
    summaryMap,
    summaries,
    getBySku,
    getRawBySku,
    search
  };
}

let cachedIndexProducts: any[] | null = null;
let cachedIndexAliases: Record<string, string[]> | undefined = undefined;
let cachedIndexResult: MasterCatalogIndex | null = null;

export function getMasterCatalogIndex(
  products: any[],
  customAliases?: Record<string, string[]>
): MasterCatalogIndex {
  if (!products || products.length === 0) {
    return buildMasterCatalogIndex([], customAliases);
  }

  if (
    cachedIndexResult &&
    cachedIndexProducts === products &&
    cachedIndexAliases === customAliases
  ) {
    return cachedIndexResult;
  }

  cachedIndexProducts = products;
  cachedIndexAliases = customAliases;
  cachedIndexResult = buildMasterCatalogIndex(products, customAliases);
  return cachedIndexResult;
}

/**
 * Extracts a normalized, semantic summary of a master product row
 */
export function getMasterProductSummary(
  product: any, 
  customAliases?: Record<string, string[]>
): MasterProductSummary {
  if (!product) {
    return { sku: '', name: '', provider: '', price: '', category: '', raw: null };
  }

  const keys = Object.keys(product);
  const skuCol = findColumnBySemantic(keys, 'sku', customAliases) || keys.find(k => /sku|código|codigo/i.test(k));
  const descCol = findColumnBySemantic(keys, 'descripcion', customAliases) || keys.find(k => /desc|nombre|name|producto/i.test(k));
  const provCol = findColumnBySemantic(keys, 'proveedor', customAliases) || keys.find(k => /prov|laboratorio|marca/i.test(k));
  const priceCol = findColumnBySemantic(keys, 'precio', customAliases) || keys.find(k => /precio|costo|price|valor/i.test(k));
  const catCol = findColumnBySemantic(keys, 'categoria', customAliases) || keys.find(k => /categor|familia|rubro/i.test(k));

  return {
    sku: skuCol && product[skuCol] !== undefined ? String(product[skuCol]).trim() : (product.SKU || ''),
    name: descCol && product[descCol] !== undefined ? String(product[descCol]).trim() : (product.DESCRIPCION || ''),
    provider: provCol && product[provCol] !== undefined ? String(product[provCol]).trim() : (product.PROVEEDOR || ''),
    price: priceCol && product[priceCol] !== undefined ? String(product[priceCol]).trim() : (product.PRECIO_COSTO || ''),
    category: catCol && product[catCol] !== undefined ? String(product[catCol]).trim() : (product.CATEGORIA || product.FAMILIA || ''),
    raw: product
  };
}

/**
 * Tolerant lookup of a master product row by SKU
 */
export function findMasterProduct(
  sku: string, 
  products: any[], 
  customAliases?: Record<string, string[]>
): any | null {
  if (!sku || !products || products.length === 0) return null;
  const index = getMasterCatalogIndex(products, customAliases);
  return index.getRawBySku(sku);
}

/**
 * Searches the master catalog by SKU, product description, or provider
 */
export function searchMasterProducts(
  query: string, 
  products: any[], 
  limit: number = 8,
  customAliases?: Record<string, string[]>
): MasterProductSummary[] {
  if (!products || products.length === 0) return [];
  const index = getMasterCatalogIndex(products, customAliases);
  return index.search(query, limit);
}

/**
 * De-references fields from a master product to the target sheet's column names
 * Maps:
 * - Master Description -> Target Description column
 * - Master Provider -> Target Provider column
 * - Master Price -> Target Price column
 * - Master Category -> Target Category column
 * - Master Policy -> Target Policy column
 */
export function dereferenceMasterProduct(
  masterProduct: any, 
  targetHeaders: string[], 
  customAliases?: Record<string, string[]>
): Record<string, any> {
  const result: Record<string, any> = {};
  if (!masterProduct || !targetHeaders || targetHeaders.length === 0) return result;

  const masterKeys = Object.keys(masterProduct);

  const getMasterVal = (semantic: KnownFieldSemantic, fallbackRegex: RegExp) => {
    let masterCol = findColumnBySemantic(masterKeys, semantic, customAliases);
    
    // Safety checks: do not match provider columns for policy, or date columns for days
    if (semantic === 'politica' && masterCol && /proveedor|lab|fabricante|rut/i.test(masterCol)) {
      masterCol = undefined;
    }
    if ((semantic === 'dias_retiro' || semantic === 'dias_anticipacion') && masterCol && /fecha|vencimiento|vto/i.test(masterCol)) {
      masterCol = undefined;
    }

    if (masterCol && masterProduct[masterCol] !== undefined && masterProduct[masterCol] !== '') {
      return masterProduct[masterCol];
    }
    
    let fallbackCol = masterKeys.find(k => fallbackRegex.test(k));
    if (semantic === 'politica' && fallbackCol && /proveedor|lab|fabricante|rut/i.test(fallbackCol)) {
      fallbackCol = undefined;
    }
    if ((semantic === 'dias_retiro' || semantic === 'dias_anticipacion') && fallbackCol && /fecha|vencimiento|vto/i.test(fallbackCol)) {
      fallbackCol = undefined;
    }

    if (fallbackCol && masterProduct[fallbackCol] !== undefined && masterProduct[fallbackCol] !== '') {
      return masterProduct[fallbackCol];
    }
    return undefined;
  };

  for (const targetHeader of targetHeaders) {
    const cleanHeader = String(targetHeader || '').trim();
    let val: any = undefined;

    if (/sku|código|codigo/i.test(cleanHeader)) {
      val = getMasterVal('sku', /sku|código|codigo/i);
    } else if (/desc|nombre|name|producto/i.test(cleanHeader)) {
      val = getMasterVal('descripcion', /desc|nombre|name|producto/i);
    } else if (/proveedor|lab|fabricante|rut_prov/i.test(cleanHeader)) {
      val = getMasterVal('proveedor', /proveedor|lab|fabricante|rut_prov/i);
    } else if (/política|politica|regla/i.test(cleanHeader)) {
      val = getMasterVal('politica', /canje(_|\s)?solo(_|\s)?por(_|\s)?vencimiento(s)?(_|\s)?dia(s)?/i) ||
            getMasterVal('politica', /canje(_|\s)?solo/i) ||
            getMasterVal('politica', /pol[ií]tica|politica|regla/i);
    } else if (/dias(_|\s)?retiro|dias(_|\s)?ant|dias/i.test(cleanHeader)) {
      val = getMasterVal('dias_retiro', /retiro(_|\s)?\((_|\s)?d[ií]as(_|\s)?\)/i) ||
            getMasterVal('dias_retiro', /retiro(_|\s)?d[ií]as/i) ||
            getMasterVal('dias_retiro', /dias(_|\s)?(retiro|anticipacion|canje|limite)|dias_retiro_vc/i) ||
            getMasterVal('dias_anticipacion', /dias(_|\s)?anticipacion|anticipacion/i);
    } else if (/mundo|zona|division|segmento/i.test(cleanHeader)) {
      val = getMasterVal('mundo', /mundo|zona|division|segmento|area/i);
    } else if (/pm|product_manager|responsable|comprador|gestor/i.test(cleanHeader)) {
      val = getMasterVal('pm', /pm|product_manager|responsable|comprador|gestor/i);
    } else if (/precio|costo|price|valor/i.test(cleanHeader)) {
      val = getMasterVal('precio', /precio|costo|price|valor/i);
    } else if (/categor|familia|rubro/i.test(cleanHeader)) {
      val = getMasterVal('categoria', /categor|familia|rubro|linea/i);
    } else {
      for (const sem of ['sku', 'descripcion', 'proveedor', 'politica', 'dias_retiro', 'dias_anticipacion', 'mundo', 'pm', 'precio', 'categoria'] as KnownFieldSemantic[]) {
        const matchedTargetCol = findColumnBySemantic([targetHeader], sem, customAliases);
        if (matchedTargetCol) {
          val = getMasterVal(sem, new RegExp(sem, 'i'));
          if (val !== undefined) break;
        }
      }

      if (val === undefined) {
        const exactMatchKey = masterKeys.find(k => k.trim().toLowerCase() === cleanHeader.toLowerCase());
        if (exactMatchKey && masterProduct[exactMatchKey] !== undefined && masterProduct[exactMatchKey] !== '') {
          val = masterProduct[exactMatchKey];
        }
      }
    }

    if (val !== undefined && val !== null && String(val).trim() !== '') {
      result[targetHeader] = String(val);
    }
  }

  return result;
}

/**
 * Automatically calculates and auto-completes dependent fields for manual product entries:
 * - POLITICA (from master catalog or policy defaults)
 * - PM (Product Manager / Responsable from master catalog)
 * - DIAS_RETIRO_VC (Lead time days from master catalog or policies table)
 * - FECHA_RETIRO (Calculated as FECHA_VC - DIAS_RETIRO_VC days)
 * - FECHA_VC (Calculated from MM & YYYY last day of month)
 * - CU_VC (Unique Expiry Code = SKU + YYYY + MM)
 */
export function autoCalculateItemFormData(
  currentForm: Record<string, string>,
  headers: string[],
  products: any[] = [],
  policies: any[] = [],
  sheetConfig?: SheetConfig
): Record<string, string> {
  const newForm = { ...currentForm };
  if (!headers || headers.length === 0) return newForm;

  const customAliases = sheetConfig?.customAliases;

  // Identify semantic headers
  const skuCol = findColumnBySemantic(headers, 'sku', customAliases) || 
                 headers.find(h => /sku|código|codigo/i.test(h));
  const policyCol = findColumnBySemantic(headers, 'politica', customAliases) || 
                    headers.find(h => /política|politica|regla/i.test(h));
  const pmCol = findColumnBySemantic(headers, 'pm', customAliases) || 
                headers.find(h => /pm|product_manager|responsable|comprador|gestor|jefe_producto/i.test(h));
  const diasRetiroCol = findColumnBySemantic(headers, 'dias_retiro', customAliases) || 
                        findColumnBySemantic(headers, 'dias_anticipacion', customAliases) || 
                        headers.find(h => /dias(_|\s)?(retiro|anticipacion|canje|limite)|dias_retiro_vc/i.test(h));
  const cuVcCol = findColumnBySemantic(headers, 'id', customAliases) || 
                  headers.find(h => /^cu(_|\s)?(vc|calculado)?$/i.test(h.trim()) || /^id_vc$/i.test(h.trim()) || /^codigo_unico$/i.test(h.trim()));

  const mmCol = findColumnBySemantic(headers, 'mes', customAliases) || 
                headers.find(h => /^(mes|mm)$/i.test(h.trim()));
  const yyyyCol = findColumnBySemantic(headers, 'anio', customAliases) || 
                  headers.find(h => /^(a[nñ]o|yyyy|year)$/i.test(h.trim()));
  const fechaVcCol = findColumnBySemantic(headers, 'fecha_vc', customAliases) || 
                     headers.find(h => /vencimiento|caducidad|expiración|fecha_vc/i.test(h));
  const fechaRetiroCol = findColumnBySemantic(headers, 'fecha_retiro', customAliases) || 
                         headers.find(h => /retiro|canje_retiro|fecha_canje/i.test(h));

  // 1. Lookup SKU in master catalog (products) if SKU is typed
  const skuVal = skuCol && newForm[skuCol] ? String(newForm[skuCol]).trim() : '';
  let masterProduct: any = null;
  if (skuVal && products && products.length > 0) {
    masterProduct = findMasterProduct(skuVal, products, customAliases);
    if (masterProduct) {
      // Auto dereference fields (Description, Provider, Price, Category, etc.) if empty or needed
      const dereferenced = dereferenceMasterProduct(masterProduct, headers, customAliases);
      for (const [k, v] of Object.entries(dereferenced)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          const isPolicyOrDays = /pol[ií]tica|politica|canje|dias(_|\s)?(retiro|anticipacion|canje|limite)|dias_retiro_vc/i.test(k);
          if (isPolicyOrDays || !newForm[k] || newForm[k].trim() === '') {
            newForm[k] = String(v);
          }
        }
      }
    }
  }

  // 2. Auto-fill POLITICA if empty
  if (policyCol && (!newForm[policyCol] || newForm[policyCol].trim() === '')) {
    if (masterProduct) {
      const masterPolCol = Object.keys(masterProduct).find(k => /canje(_|\s)?solo(_|\s)?por(_|\s)?vencimiento/i.test(k)) ||
                           Object.keys(masterProduct).find(k => /canje(_|\s)?solo/i.test(k)) ||
                           Object.keys(masterProduct).find(k => /pol[ií]tica|politica/i.test(k) && !/proveedor|lab|fabricante|rut/i.test(k)) ||
                           Object.keys(masterProduct).find(k => /regla|canje/i.test(k));
      if (masterPolCol && masterProduct[masterPolCol]) {
        newForm[policyCol] = String(masterProduct[masterPolCol]).trim();
      } else if (policies && policies.length > 0) {
        // Find provider RUT or provider name from masterProduct
        const provRutCol = Object.keys(masterProduct).find(k => /rut.*prov|prov.*rut|rut/i.test(k));
        const provRutVal = provRutCol ? String(masterProduct[provRutCol]).trim() : '';
        
        const provNameCol = Object.keys(masterProduct).find(k => /proveedor|lab|fabricante/i.test(k));
        const provNameVal = provNameCol ? String(masterProduct[provNameCol]).trim() : '';

        const matchedPol = policies.find(p => {
          const pRutCol = Object.keys(p).find(k => /rut/i.test(k));
          const pRutVal = pRutCol ? String(p[pRutCol]).trim() : '';
          if (provRutVal && pRutVal && provRutVal.toLowerCase() === pRutVal.toLowerCase()) {
            return true;
          }
          const pNameCol = Object.keys(p).find(k => /proveedor|lab|nombre/i.test(k));
          const pNameVal = pNameCol ? String(p[pNameCol]).trim() : '';
          if (provNameVal && pNameVal && provNameVal.toLowerCase() === pNameVal.toLowerCase()) {
            return true;
          }
          return false;
        });

        if (matchedPol) {
          const polKeyCol = Object.keys(matchedPol).find(k => /canje(_|\s)?solo(_|\s)?por/i.test(k)) ||
                            Object.keys(matchedPol).find(k => /canje(_|\s)?solo/i.test(k)) ||
                            Object.keys(matchedPol).find(k => /pol[ií]tica|politica/i.test(k)) ||
                            Object.keys(matchedPol).find(k => /regla|canje/i.test(k)) ||
                            Object.keys(matchedPol).find(k => /tipo|familia/i.test(k) && !/proveedor|lab|fabricante|rut/i.test(k)) ||
                            Object.keys(matchedPol).find(k => !/proveedor|lab|fabricante|rut|nombre/i.test(k)) ||
                            Object.keys(matchedPol)[0];
          if (polKeyCol && matchedPol[polKeyCol]) {
            newForm[policyCol] = String(matchedPol[polKeyCol]).trim();
          }
        }
      }
    }
  }

  // 3. Auto-fill PM if empty
  if (pmCol && (!newForm[pmCol] || newForm[pmCol].trim() === '')) {
    if (masterProduct) {
      const masterPmCol = Object.keys(masterProduct).find(k => /pm|product_manager|responsable|comprador|gestor|jefe/i.test(k));
      if (masterPmCol && masterProduct[masterPmCol]) {
        newForm[pmCol] = String(masterProduct[masterPmCol]).trim();
      }
    }
  }

  // 4. Auto-fill DIAS_RETIRO_VC (dias_anticipacion / dias_retiro)
  let activeDays: number | null = null;

  if (diasRetiroCol && newForm[diasRetiroCol] && !isNaN(parseInt(newForm[diasRetiroCol], 10))) {
    activeDays = parseInt(newForm[diasRetiroCol], 10);
  }

  if (activeDays === null && masterProduct) {
    const masterDaysCol = Object.keys(masterProduct).find(k => /retiro(_|\s)?\((_|\s)?d[ií]as(_|\s)?\)/i.test(k)) ||
                          Object.keys(masterProduct).find(k => /retiro(_|\s)?d[ií]as/i.test(k)) ||
                          Object.keys(masterProduct).find(k => /d[ií]as(_|\s)?(retiro|anticipacion|canje|limite)|dias_retiro_vc/i.test(k));
    if (masterDaysCol && masterProduct[masterDaysCol] && !isNaN(parseInt(masterProduct[masterDaysCol], 10))) {
      activeDays = parseInt(masterProduct[masterDaysCol], 10);
    }
  }

  if (activeDays === null && masterProduct && policies && policies.length > 0) {
    // Look up by provider RUT or provider name in policies
    const provRutCol = Object.keys(masterProduct).find(k => /rut.*prov|prov.*rut|rut/i.test(k));
    const provRutVal = provRutCol ? String(masterProduct[provRutCol]).trim() : '';
    
    const provNameCol = Object.keys(masterProduct).find(k => /proveedor|lab|fabricante/i.test(k));
    const provNameVal = provNameCol ? String(masterProduct[provNameCol]).trim() : '';

    const matchedPol = policies.find(p => {
      const pRutCol = Object.keys(p).find(k => /rut/i.test(k));
      const pRutVal = pRutCol ? String(p[pRutCol]).trim() : '';
      if (provRutVal && pRutVal && provRutVal.toLowerCase() === pRutVal.toLowerCase()) {
        return true;
      }
      const pNameCol = Object.keys(p).find(k => /proveedor|lab|nombre/i.test(k));
      const pNameVal = pNameCol ? String(p[pNameCol]).trim() : '';
      if (provNameVal && pNameVal && provNameVal.toLowerCase() === pNameVal.toLowerCase()) {
        return true;
      }
      return false;
    });

    if (matchedPol) {
      const polDaysCol = Object.keys(matchedPol).find(k => /retiro(_|\s)?\((_|\s)?d[ií]as(_|\s)?\)/i.test(k)) ||
                         Object.keys(matchedPol).find(k => /dias|días|anticipacion|tiempo|lead|retiro/i.test(k));
      if (polDaysCol && matchedPol[polDaysCol]) {
        const days = parseInt(matchedPol[polDaysCol], 10);
        if (!isNaN(days)) {
          activeDays = days;
        }
      }
    }
  }

  const activePolicy = policyCol && newForm[policyCol] ? newForm[policyCol].trim() : '';
  if (activePolicy && policies && policies.length > 0) {
    const polKeyCol = Object.keys(policies[0]).find(k => /política|politica|tipo|canje|familia|nombre/i.test(k));
    const polDaysCol = Object.keys(policies[0]).find(k => /dias|días|anticipacion|tiempo|lead/i.test(k));
    if (polKeyCol && polDaysCol) {
      const matchedPolicy = policies.find(p => String(p[polKeyCol]).trim().toLowerCase() === activePolicy.toLowerCase());
      if (matchedPolicy && matchedPolicy[polDaysCol]) {
        const days = parseInt(matchedPolicy[polDaysCol], 10);
        if (!isNaN(days)) {
          activeDays = days;
        }
      }
    }
  }

  if (activeDays === null && activePolicy) {
    const matchNum = activePolicy.match(/\b(\d{1,3})\b/);
    if (matchNum) {
      const parsedFromPol = parseInt(matchNum[1], 10);
      if (!isNaN(parsedFromPol) && parsedFromPol > 0 && parsedFromPol <= 365) {
        activeDays = parsedFromPol;
      }
    }
  }

  if (diasRetiroCol && activeDays !== null && !isNaN(activeDays)) {
    // If empty or if it was invalid (due to previous date string classification bug), override it
    const currentVal = String(newForm[diasRetiroCol] || '').trim();
    if (currentVal === '' || isNaN(parseInt(currentVal, 10)) || currentVal.includes('-')) {
      newForm[diasRetiroCol] = String(activeDays);
    }
  }

  // 5. MM & YYYY <-> FECHA_VC Sync
  let mVal = mmCol && newForm[mmCol] ? newForm[mmCol].trim() : '';
  let yVal = yyyyCol && newForm[yyyyCol] ? newForm[yyyyCol].trim() : '';
  let fechaVcVal = fechaVcCol && newForm[fechaVcCol] ? newForm[fechaVcCol].trim() : '';

  if (mVal && yVal && !isNaN(Number(mVal)) && !isNaN(Number(yVal))) {
    const mNum = parseInt(mVal, 10);
    const yNum = parseInt(yVal, 10);
    if (mNum >= 1 && mNum <= 12 && yNum >= 2000 && yNum <= 2100) {
      const lastDay = new Date(yNum, mNum, 0);
      const calcY = lastDay.getFullYear();
      const calcM = String(lastDay.getMonth() + 1).padStart(2, '0');
      const calcD = String(lastDay.getDate()).padStart(2, '0');
      const computedDateStr = `${calcY}-${calcM}-${calcD}`;
      if (fechaVcCol && (!newForm[fechaVcCol] || newForm[fechaVcCol] !== computedDateStr)) {
        newForm[fechaVcCol] = computedDateStr;
        fechaVcVal = computedDateStr;
      }
    }
  } else if (fechaVcVal) {
    const parsedDate = parseAnyDate(fechaVcVal);
    if (parsedDate) {
      const extractedY = String(parsedDate.getFullYear());
      const extractedM = String(parsedDate.getMonth() + 1).padStart(2, '0');
      if (yyyyCol && !newForm[yyyyCol]) { newForm[yyyyCol] = extractedY; yVal = extractedY; }
      if (mmCol && !newForm[mmCol]) { newForm[mmCol] = extractedM; mVal = extractedM; }
    }
  }

  // 6. FECHA_RETIRO Calculation = FECHA_VC - activeDays (Supports updating FECHA_RETIRO and FECHA_RETIRO_CALC using calculateWithdrawalDate for full consistency)
  if (fechaVcVal && activeDays !== null && !isNaN(activeDays)) {
    const expDate = parseAnyDate(fechaVcVal);
    if (expDate) {
      const d = calculateWithdrawalDate(expDate, activeDays);
      const rY = d.getFullYear();
      const rM = String(d.getMonth() + 1).padStart(2, '0');
      const rD = String(d.getDate()).padStart(2, '0');
      const formattedRetiroDate = `${rY}-${rM}-${rD}`;
      
      // Update ALL columns in headers representing retirement dates
      headers.forEach(h => {
        if (/fecha(_|\s)?retiro/i.test(h) || /retiro(_|\s)?calc/i.test(h) || /^fecha(_|\s)?canje/i.test(h)) {
          newForm[h] = formattedRetiroDate;
        }
      });
      if (fechaRetiroCol) {
        newForm[fechaRetiroCol] = formattedRetiroDate;
      }
      newForm['FECHA_RETIRO_CALC'] = formattedRetiroDate;
    }
  }

  // 7. Auto-calculate CU_VC = SKU + YYYY + MM using extractCuVcFromRow
  const derivedCuInfo = extractCuVcFromRow(newForm, headers, customAliases);
  if (derivedCuInfo.cuVc) {
    headers.forEach(h => {
      const isCuHeader = /^cu(_|\s)?(vc|calculado)?$/i.test(h.trim()) || 
                         /^id_vc$/i.test(h.trim()) || 
                         /^codigo(_|\s)?unico$/i.test(h.trim()) || 
                         /^cu$/i.test(h.trim());
      if (isCuHeader) {
        newForm[h] = derivedCuInfo.cuVc;
      }
    });
    if (cuVcCol) {
      newForm[cuVcCol] = derivedCuInfo.cuVc;
    }
  }

  return newForm;
}
