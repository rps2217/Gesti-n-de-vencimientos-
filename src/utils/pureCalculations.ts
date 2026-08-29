import { InventoryItem, EventCategory, EventResolutionStatus } from '../types';
import { findColumnBySemantic } from './columnAliases';

/**
 * Match a raw string from FRC_EVEN (e.g. 'VENC. CERC.', 'DET. PED', 'CAL. INTER', 'CANJES', 'DIF. PED')
 * into its corresponding EventCategory
 */
export function getCategoryFromEventValue(rawVal: any): EventCategory | null {
  if (rawVal === null || rawVal === undefined) return null;
  const raw = String(rawVal).trim().toUpperCase();
  if (!raw || raw === '-') return null;

  if (raw === 'VENC. CERC.' || raw === 'VENC. CERC' || raw.includes('VENC. CERC') || raw.includes('VENC.CERC') || raw.includes('CERCAN')) {
    return 'VENCIMIENTO_CERCANO';
  }
  if (raw === 'DET. PED' || raw === 'DET. PED.' || raw.includes('DET. PED') || raw.includes('DET.PED') || raw.includes('TRANSP') || raw.includes('DETERIORO')) {
    return 'TRANSPORTE';
  }
  if (raw === 'CAL. INTER' || raw === 'CAL. INTER.' || raw.includes('CAL. INTER') || raw.includes('CAL. INT') || raw.includes('CALIDAD INT') || raw.includes('INTERNA')) {
    return 'CAL_INTERNA';
  }
  if (raw === 'CAL. EXT.' || raw === 'CAL. EXT' || raw.includes('CAL. EXT') || raw.includes('CALIDAD EXT') || raw.includes('EXTERNA')) {
    return 'CAL_EXTERNA';
  }
  if (raw === 'CANJES' || raw.includes('CANJE')) {
    return 'CANJES';
  }
  if (raw === 'DIF. PED' || raw === 'DIF. PED.' || raw.includes('DIF. PED') || raw.includes('DIF.PED') || raw.includes('DIFER')) {
    return 'DIFERENCIA';
  }
  if (raw.includes('AVER') || raw.includes('MERMA') || raw.includes('ROTURA')) {
    return 'AVERIA';
  }
  if (raw.includes('DEVOL') || raw.includes('RECLAM')) {
    return 'DEVOLUCION';
  }
  if (raw.includes('VENC') || raw.includes('CADUC')) {
    return 'VENCIMIENTO';
  }
  return null;
}

/**
 * Universal Date Parser supporting:
 * - Google Sheets / Excel serial numbers (e.g. 45321)
 * - ISO format: YYYY-MM-DD, YYYY/MM/DD, YYYY-MM-DDTHH:mm:ss
 * - Latin format: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * - Compact numeric: YYYYMMDD
 * - Month/Year: MM/YYYY, MM-YYYY, YYYY-MM (evaluates to last day of the month)
 * - Native Date objects or timestamps
 */
export function parseAnyDate(dateVal: any): Date | null {
  if (dateVal === null || dateVal === undefined) return null;
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    const clean = new Date(dateVal.getTime());
    clean.setHours(0, 0, 0, 0);
    return clean;
  }
  
  // 1. Google Sheets / Excel Serial Date number check (e.g. 45321)
  if (typeof dateVal === 'number' && !isNaN(dateVal) && dateVal > 20000 && dateVal < 70000) {
    // 25569 = Days between 1899-12-30 and 1970-01-01 (Unix epoch)
    const ms = Math.round((dateVal - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }

  const str = String(dateVal).trim();
  if (!str || str === '-' || str === 'N/A' || str === 'null' || str === 'undefined') return null;

  // Numeric string check for Excel serial
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 20000 && num < 70000) {
      const ms = Math.round((num - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        return d;
      }
    }
  }

  // 2. ISO format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (with optional time)
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      const d = new Date(y, m - 1, day, 0, 0, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 3. Latin format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      const d = new Date(y, m - 1, day, 0, 0, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 4. Compact numeric date format YYYYMMDD
  const ymdCompact = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymdCompact) {
    const y = Number(ymdCompact[1]);
    const m = Number(ymdCompact[2]);
    const day = Number(ymdCompact[3]);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      const d = new Date(y, m - 1, day, 0, 0, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 5. Month/Year format: MM/YYYY or MM-YYYY (evaluates to last day of that month)
  const my = str.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (my) {
    const m = Number(my[1]);
    const y = Number(my[2]);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12) {
      const lastDay = new Date(y, m, 0, 0, 0, 0, 0);
      if (!isNaN(lastDay.getTime())) return lastDay;
    }
  }

  // 6. Year/Month format: YYYY-MM or YYYY/MM (evaluates to last day of that month)
  const ym = str.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (ym) {
    const y = Number(ym[1]);
    const m = Number(ym[2]);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12) {
      const lastDay = new Date(y, m, 0, 0, 0, 0, 0);
      if (!isNaN(lastDay.getTime())) return lastDay;
    }
  }

  return null;
}

/**
 * Format a Date for standard HTML `<input type="date">` (YYYY-MM-DD)
 */
export function formatInputDate(dateVal: any): string {
  const d = parseAnyDate(dateVal);
  if (!d) return '';
  const yyyy = d.getFullYear();
  if (yyyy < 1900 || yyyy > 2100) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format a Date for elegant table display (DD/MM/YYYY)
 */
export function formatDisplayDate(dateVal: any, fallback = '-'): string {
  const d = parseAnyDate(dateVal);
  if (!d) return String(dateVal || fallback);
  const yyyy = d.getFullYear();
  if (yyyy < 1900 || yyyy > 2100) return String(dateVal || fallback);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Robust number parsing supporting currency symbols, thousand commas/periods, and spaces
 */
export function parseLocaleNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;

  let str = String(val).trim();
  if (!str) return fallback;

  // Remove currency signs and spaces
  str = str.replace(/[$€£S/.]\s*/g, '').trim();

  // Handle European/Latin style: 1.250,50 -> 1250.50
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(,\d+)$/.test(str)) {
    // Single comma decimal: 1250,50 -> 1250.50
    str = str.replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
    // US style: 1,250.50 -> 1250.50
    str = str.replace(/,/g, '');
  }

  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

/**
 * Format number with thousand separators
 */
export function formatLocaleNumber(numVal: any, decimals = 0): string {
  const n = typeof numVal === 'number' ? numVal : parseLocaleNumber(numVal);
  return n.toLocaleString('es-ES', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

// Helper to determine the event category of any item using smart column detection
export function getEventCategory(item: InventoryItem, headers: string[]): EventCategory {
  const eventHeader = findColumnBySemantic(headers, 'tipo_evento') || headers.find(h => /^frc(_|\s)?even/i.test(h.trim()));
  if (eventHeader && item[eventHeader]) {
    const parsed = getCategoryFromEventValue(item[eventHeader]);
    if (parsed) return parsed;
  }
  
  // Check if item has FECHA_VC or MM/YYYY
  const vcCol = findColumnBySemantic(headers, 'fecha_vc');
  if (vcCol && item[vcCol]) return 'VENCIMIENTO';

  return 'VENCIMIENTO';
}

export function getEndOfMonthDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

export function getExpiryDateFromYm(item: InventoryItem, headers: string[]): Date | null {
  const yCol = findColumnBySemantic(headers, 'anio') || 'E';
  const mCol = findColumnBySemantic(headers, 'mes') || 'D';
  
  const year = item[yCol];
  const month = item[mCol];
  
  if (year !== undefined && year !== null && month !== undefined && month !== null) {
    const y = parseInt(String(year));
    const m = parseInt(String(month));
    if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      return new Date(y, m, 0); // Last day of month
    }
  }

  // Check if item has CU_VC (e.g., 2000210218569202712 -> ends with YYYYMM: 2027 + 12)
  const idCol = findColumnBySemantic(headers, 'id');
  const cuVal = idCol && item[idCol] ? String(item[idCol]).trim() : '';
  if (cuVal && cuVal.length >= 6) {
    const match = cuVal.match(/(\d{4})(0[1-9]|1[0-2])$/);
    if (match) {
      const y = parseInt(match[1]);
      const m = parseInt(match[2]);
      if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12) {
        return new Date(y, m, 0);
      }
    }
  }
  
  return null; 
}

export type ItemStatusCode = 'EXPIRED' | 'RETIRE_NOW' | 'UPCOMING' | 'DRAINAGE_PM' | 'NORMAL';

export function computeItemRawStatus(item: InventoryItem, headers: string[]): {
  code: ItemStatusCode;
  daysToRetire: number | null;
  daysToExpiry: number | null;
} {
  const retCol = findColumnBySemantic(headers, 'fecha_retiro');
  const vcCol = findColumnBySemantic(headers, 'fecha_vc');
  
  const today = getEndOfMonthDate();
  today.setHours(0, 0, 0, 0);

  let daysToRetire: number | null = null;
  let daysToExpiry: number | null = null;

  if (retCol && item[retCol]) {
    const dRet = parseAnyDate(item[retCol]);
    if (dRet) {
      daysToRetire = Math.ceil((dRet.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  let dVc = null;
  if (vcCol && item[vcCol]) {
    dVc = parseAnyDate(item[vcCol]);
  } else {
    dVc = getExpiryDateFromYm(item, headers);
  }

  if (dVc) {
    daysToExpiry = Math.ceil((dVc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (!daysToRetire && daysToExpiry !== null) {
      const dRet = new Date(dVc);
      dRet.setDate(dRet.getDate() - 30);
      daysToRetire = Math.ceil((dRet.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  let code: ItemStatusCode = 'NORMAL';

  if (daysToExpiry !== null && daysToExpiry <= 0) {
    code = 'EXPIRED';
  } else if (daysToRetire !== null && daysToRetire <= 0) {
    code = 'RETIRE_NOW';
  } else if (daysToRetire !== null && daysToRetire <= 30) {
    code = 'UPCOMING';
  } else if (daysToRetire !== null && daysToRetire <= 90) {
    code = 'DRAINAGE_PM';
  }

  return { code, daysToRetire, daysToExpiry };
}

export function getItemResolutionStatus(item: InventoryItem, headers: string[]): EventResolutionStatus {
  const traspasoCol = findColumnBySemantic(headers, 'n_traspaso') 
    || headers.find(h => /^n(_|\s)?traspaso/i.test(h.trim()))
    || headers.find(h => /traspaso/i.test(h.trim()));

  const val = traspasoCol 
    ? item[traspasoCol] 
    : (item.N_TRASPASO || item.n_traspaso || item['N_TRASPASO'] || item['N° TRASPASO'] || item['NRO_TRASPASO'] || item['NUM_TRASPASO']);
  
  if (val !== undefined && val !== null) {
    const str = String(val).trim();
    if (
      str !== '' && 
      str !== '-' && 
      str !== '0' && 
      !/^(sin\s+traspaso|sin\s+asignar|pendiente|n\/?a|s\/n|ninguno|null|undefined)$/i.test(str)
    ) {
      return {
        isResolved: true,
        status: 'REALIZADO',
        label: 'Realizado',
        traspasoNumber: str,
        traspasoColumn: traspasoCol
      };
    }
  }

  return {
    isResolved: false,
    status: 'PENDIENTE',
    label: 'Pendiente',
    traspasoNumber: '',
    traspasoColumn: traspasoCol
  };
}

export function getEventReason(item: InventoryItem, headers: string[]): string {
  const obsCol = findColumnBySemantic(headers, 'observacion') || headers.find(h => /observaci|motivo|detalle|causa|razon/i.test(h.trim()));
  if (obsCol && item[obsCol]) {
    return String(item[obsCol]).trim();
  }
  return '-';
}

export function calculateWithdrawalDate(dVc: Date, diasRetiro: number): Date {
  const monthsToSubtract = Math.round(diasRetiro / 30);
  return new Date(dVc.getFullYear(), dVc.getMonth() - monthsToSubtract + 1, 0);
}

/**
 * Clean and format phone numbers, ensuring they have the +56 prefix (Chile)
 */
export function formatPhoneNumber(phone: any): string {
  let rawPhone = String(phone || '').trim().replace(/[^\d+]/g, '');
  if (!rawPhone) return '';
  // If it already has an international prefix with '+'
  if (rawPhone.startsWith('+')) {
    return rawPhone;
  }
  // If starts with 56 and is 11 digits (Chile country code without +)
  if (rawPhone.startsWith('56') && rawPhone.length >= 10) {
    return '+' + rawPhone;
  }
  // Default Chilean prefix
  return '+56' + rawPhone;
}
