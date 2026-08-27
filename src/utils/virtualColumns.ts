import { VirtualColumn } from '../types';
import { findColumnBySemantic } from './columnAliases';
import { parseAnyDate, formatDisplayDate, calculateWithdrawalDate } from './dateCalculations';

export const VIRTUAL_COLUMNS: VirtualColumn[] = [
  {
    id: 'fecha_retiro_calc',
    label: 'Fecha Retiro Calc.',
    supportedViews: ['main'],
    calculate: (item, headers, allData) => {
      const { products, policies } = allData || {};
      const vcCol = findColumnBySemantic(headers, 'fecha_vc');
      const skuCol = findColumnBySemantic(headers, 'sku');

      if (!vcCol || !item[vcCol]) return '-';

      const dVc = parseAnyDate(item[vcCol]);
      if (!dVc) return '-';

      // 1. Get SKU (Use semantic search or direct lookup)
      const sku = skuCol ? item[skuCol] : null;

      // 2. RUT_PROVEEDOR_VC = LOOKUP([_THISROW].[SKU_VC], "CATALOGO", "COD PRODUCTO", "RUT PROVEEDOR")
      const productEntry = products?.find((p: any) => {
        const pSku = p['COD PRODUCTO'] || p['C'] || p['Código'] || p['Código Producto'];
        return String(pSku).trim() === String(sku).trim();
      });
      const rutProveedor = productEntry ? (productEntry['RUT PROVEEDOR'] || productEntry['F'] || productEntry['RUT']) : null;

      // 3. DIAS_RETIRO_VC = [RUT_PROVEEDOR_VC].[RETIRO (DÍAS)]
      // Policies: A is RUT, H is RETIRO (DÍAS)
      let diasRetiro = 30; // Default
      
      // Try to get dias_retiro directly from the item first (it's already loaded in the data)
      const diasRetiroCol = findColumnBySemantic(headers, 'dias_retiro');
      if (diasRetiroCol && item[diasRetiroCol]) {
        diasRetiro = parseInt(String(item[diasRetiroCol])) || 30;
      } else if (rutProveedor) {
        const policyEntry = policies?.find((p: any) => {
          const pRut = p['RUT'] || p['A'];
          return String(pRut).trim() === String(rutProveedor).trim();
        });
        
        const retiroKey = Object.keys(policyEntry || {}).find(k => k.includes('RETIRO') || k === 'H');
        if (policyEntry && retiroKey) {
          diasRetiro = parseInt(policyEntry[retiroKey]) || 30;
        }
      }
      
      // 4. FECHA_RETIRO_VC = EOMONTH(FECHA_VC, -(DIAS_RETIRO_VC / 30))
      // Logic: Subtract months based on policy (days/30), project to end of month.
      const dRet = calculateWithdrawalDate(dVc, diasRetiro);
      
      return formatDisplayDate(dRet);
    }
  },
  {
    id: 'proveedor_relacionado',
    label: 'Proveedor (Catálogo)',
    supportedViews: ['main'],
    calculate: (item, headers, allData) => {
      const { products } = allData || {};
      if (!products || products.length === 0) return '-';

      const skuCol = findColumnBySemantic(headers, 'sku');
      const rutCol = headers.find(h => /rut.*prov|prov.*rut|rut/i.test(h));
      
      const itemSku = skuCol ? item[skuCol] : null;
      const itemRut = rutCol ? item[rutCol] : null;

      if (!itemSku && !itemRut) return '-';

      const productEntry = products.find((p: any) => {
        const keys = Object.keys(p);
        const pSkuCol = keys.find(k => /sku|código|codigo|cod_producto|cod.*producto/i.test(k));
        const pRutCol = keys.find(k => /rut/i.test(k));

        if (itemSku && pSkuCol && String(p[pSkuCol]).trim() === String(itemSku).trim()) return true;
        if (itemRut && pRutCol && String(p[pRutCol]).trim() === String(itemRut).trim()) return true;
        return false;
      });

      if (!productEntry) return '-';

      const provKey = Object.keys(productEntry).find(k => /proveedor|nombre_prov|razon_social|marca|vendor/i.test(k));
      return provKey && productEntry[provKey] ? String(productEntry[provKey]) : '-';
    }
  }
];
