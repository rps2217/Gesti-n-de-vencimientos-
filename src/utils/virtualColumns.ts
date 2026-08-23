import { VirtualColumn } from '../types';
import { findColumnBySemantic } from './columnAliases';
import { parseAnyDate, formatDisplayDate } from './dateCalculations';

export const VIRTUAL_COLUMNS: VirtualColumn[] = [
  {
    id: 'fecha_retiro_calc',
    label: 'Fecha Retiro Calc.',
    calculate: (item, headers, allData) => {
      const { products, policies } = allData || {};
      const vcCol = findColumnBySemantic(headers, 'fecha_vc');
      const skuCol = findColumnBySemantic(headers, 'sku') || findColumnBySemantic(headers, 'código');

      if (!vcCol || !item[vcCol]) return '-';

      const dVc = parseAnyDate(item[vcCol]);
      if (!dVc) return '-';

      // 1. Get SKU (Use semantic search or direct lookup)
      const sku = skuCol ? item[skuCol] : null;

      // 2. RUT_PROVEEDOR_VC = LOOKUP([_THISROW].[SKU_VC], "CATALOGO", "COD PRODUCTO", "RUT PROVEEDOR")
      const productEntry = products?.find((p: any) => p['COD PRODUCTO'] === sku || p['C'] === sku);
      const rutProveedor = productEntry ? (productEntry['RUT PROVEEDOR'] || productEntry['F']) : null;

      // 3. DIAS_RETIRO_VC = [RUT_PROVEEDOR_VC].[RETIRO (DÍAS)]
      // Policies: A is RUT, H is RETIRO (DÍAS)
      let diasRetiro = 30; // Default
      if (rutProveedor) {
        const policyEntry = policies?.find((p: any) => p['RUT'] === rutProveedor || p['A'] === rutProveedor);
        if (policyEntry && (policyEntry['RETIRO (DÍAS)'] || policyEntry['H'])) {
          diasRetiro = parseInt(policyEntry['RETIRO (DÍAS)'] || policyEntry['H']) || 30;
        }
      }
      
      // 4. FECHA_RETIRO_VC = EOMONTH([FECHA_VC], -([DIAS RETIRO_VC]/30))
      // AppSheet logic: EOMONTH(date, months_offset)
      const monthsToSubtract = Math.floor(diasRetiro / 30);
      const dRet = new Date(dVc.getFullYear(), dVc.getMonth() - monthsToSubtract + 1, 0);
      
      return formatDisplayDate(dRet);
    }
  }
];
