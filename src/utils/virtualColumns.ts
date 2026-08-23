import { VirtualColumn } from '../types';
import { findColumnBySemantic } from './columnAliases';
import { parseAnyDate, formatDisplayDate } from './dateCalculations';

export const VIRTUAL_COLUMNS: VirtualColumn[] = [
  {
    id: 'fecha_retiro_calc',
    label: 'Fecha Retiro Calc.',
    calculate: (item, headers) => {
      const vcCol = findColumnBySemantic(headers, 'fecha_vc');
      // Look for a semantic column related to policy/days of retirement
      const politCol = findColumnBySemantic(headers, 'politica') || findColumnBySemantic(headers, 'dias_retiro');

      if (!vcCol || !item[vcCol]) return '-';

      const dVc = parseAnyDate(item[vcCol]);
      if (!dVc) return '-';

      // Example calculation: 30 days before expiry if policy isn't specific
      const daysToSubtract = 30; 
      
      const dRet = new Date(dVc);
      dRet.setDate(dRet.getDate() - daysToSubtract);

      return formatDisplayDate(dRet);
    }
  }
];
