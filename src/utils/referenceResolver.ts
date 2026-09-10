import { findColumnBySemantic, KnownFieldSemantic } from './columnAliases';

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

    const results: MasterProductSummary[] = [];
    for (let i = 0; i < summaries.length; i++) {
      const s = summaries[i];
      if (
        s.sku.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.provider.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      ) {
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

  const targetSku = String(sku).trim().toLowerCase();
  if (!targetSku) return null;

  const firstProd = products[0];
  const keys = Object.keys(firstProd);
  const skuCol = findColumnBySemantic(keys, 'sku', customAliases) || keys.find(k => /sku|código|codigo/i.test(k));

  for (const prod of products) {
    if (!prod) continue;
    const prodVal = skuCol ? prod[skuCol] : (prod.SKU || prod.sku);
    if (prodVal !== undefined && prodVal !== null) {
      const cleanProdVal = String(prodVal).trim().toLowerCase();
      if (cleanProdVal === targetSku) {
        return prod;
      }
    }
  }

  // Fallback 1: Normalized alphanumeric match (e.g. '1001' matches 'SKU-1001')
  const alphaTarget = targetSku.replace(/[^a-z0-9]/g, '');
  if (alphaTarget) {
    for (const prod of products) {
      if (!prod) continue;
      const prodVal = skuCol ? prod[skuCol] : (prod.SKU || prod.sku);
      if (prodVal !== undefined && prodVal !== null) {
        const cleanAlpha = String(prodVal).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanAlpha === alphaTarget || cleanAlpha.endsWith(alphaTarget)) {
          return prod;
        }
      }
    }
  }

  // Fallback 2: check all fields for exact matching code
  for (const prod of products) {
    for (const k of Object.keys(prod)) {
      if (/sku|código|codigo|id/i.test(k)) {
        if (String(prod[k]).trim().toLowerCase() === targetSku) {
          return prod;
        }
      }
    }
  }

  return null;
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
  const q = (query || '').trim().toLowerCase();

  const results: MasterProductSummary[] = [];

  for (const prod of products) {
    const summary = getMasterProductSummary(prod, customAliases);
    if (!q) {
      results.push(summary);
    } else {
      const matchSku = summary.sku.toLowerCase().includes(q);
      const matchName = summary.name.toLowerCase().includes(q);
      const matchProv = summary.provider.toLowerCase().includes(q);
      const matchCat = summary.category.toLowerCase().includes(q);
      if (matchSku || matchName || matchProv || matchCat) {
        results.push(summary);
      }
    }
    if (results.length >= limit) break;
  }

  return results;
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
    const masterCol = findColumnBySemantic(masterKeys, semantic, customAliases);
    if (masterCol && masterProduct[masterCol] !== undefined && masterProduct[masterCol] !== '') {
      return masterProduct[masterCol];
    }
    const fallbackCol = masterKeys.find(k => fallbackRegex.test(k));
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
      val = getMasterVal('politica', /política|politica|regla/i);
    } else if (/dias(_|\s)?retiro|dias(_|\s)?ant|dias/i.test(cleanHeader)) {
      val = getMasterVal('dias_retiro', /dias(_|\s)?retiro|dias(_|\s)?ant|dias|lead_time/i) ||
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
      result[targetHeader] = val;
    }
  }

  return result;
}
