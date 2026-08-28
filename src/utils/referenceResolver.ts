import { findColumnBySemantic, KnownFieldSemantic } from './columnAliases';

export interface MasterProductSummary {
  sku: string;
  name: string;
  provider: string;
  price: string;
  category: string;
  raw: any;
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

  // Fallback: check all fields for exact matching code
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

  const masterSummary = getMasterProductSummary(masterProduct, customAliases);
  const masterKeys = Object.keys(masterProduct);

  const targetSkuCol = findColumnBySemantic(targetHeaders, 'sku', customAliases);
  const targetDescCol = findColumnBySemantic(targetHeaders, 'descripcion', customAliases);
  const targetProvCol = findColumnBySemantic(targetHeaders, 'proveedor', customAliases);
  const targetPriceCol = findColumnBySemantic(targetHeaders, 'precio', customAliases);
  const targetCatCol = findColumnBySemantic(targetHeaders, 'categoria', customAliases);
  const targetPolicyCol = findColumnBySemantic(targetHeaders, 'politica', customAliases);

  if (targetSkuCol && masterSummary.sku) {
    result[targetSkuCol] = masterSummary.sku;
  }
  if (targetDescCol && masterSummary.name) {
    result[targetDescCol] = masterSummary.name;
  }
  if (targetProvCol && masterSummary.provider) {
    result[targetProvCol] = masterSummary.provider;
  }
  if (targetPriceCol && masterSummary.price) {
    result[targetPriceCol] = masterSummary.price;
  }
  if (targetCatCol && masterSummary.category) {
    result[targetCatCol] = masterSummary.category;
  }

  // Also check if master has a direct policy column
  const masterPolicyCol = findColumnBySemantic(masterKeys, 'politica', customAliases);
  if (targetPolicyCol && masterPolicyCol && masterProduct[masterPolicyCol]) {
    result[targetPolicyCol] = masterProduct[masterPolicyCol];
  } else if (targetPolicyCol && masterSummary.category) {
    // If master has family/category, it might match the policy name
    result[targetPolicyCol] = masterSummary.category;
  }

  // In addition, if target header has exact matching name in masterProduct
  for (const h of targetHeaders) {
    if (result[h] === undefined && masterProduct[h] !== undefined && masterProduct[h] !== '') {
      result[h] = masterProduct[h];
    }
  }

  return result;
}
