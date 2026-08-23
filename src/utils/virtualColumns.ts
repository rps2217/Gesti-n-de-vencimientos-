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

      // 1. Get SKU
      const sku = skuCol ? item[skuCol] : null;

      // 2. Cross-reference to get RUTE (Vendor) from 'products' (Catálogo)
      // Assuming 'products' is an array of items and has a structure we can query.
      // User said: Catálogo Col F is RUTE, Col C is SKU.
      const productEntry = products?.find((p: any) => p['Código'] === sku || p['C'] === sku); // Need to handle semantic headers
      const rute = productEntry ? (productEntry['RUTE'] || productEntry['F']) : null;

      // 3. Search for withdrawal days in 'policies' using RUTE
      // User said: Políticas Col A is RUT, Col H is days.
      let daysToSubtract = 30; // Default
      if (rute) {
        const policyEntry = policies?.find((p: any) => p['RUT'] === rute || p['A'] === rute);
        if (policyEntry && policyEntry['Días de retiro'] || policyEntry['H']) {
          daysToSubtract = parseInt(policyEntry['Días de retiro'] || policyEntry['H']) || 30;
        }
      }
      
      const dRet = new Date(dVc);
      dRet.setDate(dRet.getDate() - daysToSubtract);

      return formatDisplayDate(dRet);
    }
  }
];
