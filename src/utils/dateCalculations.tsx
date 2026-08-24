import React from 'react';
import { 
  Truck, FileSpreadsheet, PackageX, RotateCcw, Clock, AlertCircle, AlertTriangle, Clock3, Flame, CheckCircle2, Tag 
} from 'lucide-react';
import { InventoryItem, EventCategory, EventTypeDefinition, EventResolutionStatus } from '../types';
import { findColumnBySemantic } from './columnAliases';

export const EVENT_CATEGORIES: Record<EventCategory, EventTypeDefinition> = {
  VENCIMIENTO_CERCANO: {
    id: 'VENCIMIENTO_CERCANO',
    rawCode: 'VENC. CERC.',
    name: 'Vencimiento Cercano',
    shortLabel: 'Venc. Cercano',
    description: 'Control de lotes con vencimiento próximo para rotación',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800',
    cardBorder: 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/30',
    cardBg: 'bg-indigo-600 text-white',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
  },
  TRANSPORTE: {
    id: 'TRANSPORTE',
    rawCode: 'DET. PED',
    name: 'Deterioro de Pedido',
    shortLabel: 'Det. Pedido',
    description: 'Embalaje dañado, golpe o deterioro físico durante transporte o recepción',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    cardBorder: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50 dark:bg-amber-950/30',
    cardBg: 'bg-amber-600 text-white',
    iconBg: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
  },
  CAL_INTERNA: {
    id: 'CAL_INTERNA',
    rawCode: 'CAL. INTER',
    name: 'Calidad Interna',
    shortLabel: 'Cal. Interna',
    description: 'Incidencia o no conformidad detectada en control de calidad interno',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    cardBorder: 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/30',
    cardBg: 'bg-emerald-600 text-white',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
  },
  CAL_EXTERNA: {
    id: 'CAL_EXTERNA',
    rawCode: 'CAL. EXT.',
    name: 'Calidad Externa',
    shortLabel: 'Cal. Externa',
    description: 'Incidencia o no conformidad reportada por cliente o proveedor',
    badgeBg: 'bg-teal-50 dark:bg-teal-950/60',
    badgeText: 'text-teal-800 dark:text-teal-300',
    badgeBorder: 'border-teal-200 dark:border-teal-800',
    cardBorder: 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/50 dark:bg-teal-950/30',
    cardBg: 'bg-teal-600 text-white',
    iconBg: 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300'
  },
  CANJES: {
    id: 'CANJES',
    rawCode: 'CANJES',
    name: 'Canjes',
    shortLabel: 'Canjes',
    description: 'Gestión y control de canjes comerciales de productos',
    badgeBg: 'bg-pink-50 dark:bg-pink-950/60',
    badgeText: 'text-pink-700 dark:text-pink-300',
    badgeBorder: 'border-pink-200 dark:border-pink-800',
    cardBorder: 'border-pink-500 ring-2 ring-pink-500/20 bg-pink-50/50 dark:bg-pink-950/30',
    cardBg: 'bg-pink-600 text-white',
    iconBg: 'bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300'
  },
  DIFERENCIA: {
    id: 'DIFERENCIA',
    rawCode: 'DIF. PED',
    name: 'Diferencia de Pedido',
    shortLabel: 'Dif. Pedido',
    description: 'Inconsistencia de unidades recibidas vs factura o guía (faltante / sobrante / trocado)',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-800 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-800',
    cardBorder: 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/50 dark:bg-purple-950/30',
    cardBg: 'bg-purple-600 text-white',
    iconBg: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300'
  },
  VENCIMIENTO: {
    id: 'VENCIMIENTO',
    rawCode: 'VENCIMIENTO',
    name: 'Vencimiento Regular',
    shortLabel: 'Vencimiento',
    description: 'Control de caducidad, fecha de retiro preventivo y radar comercial para PM',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800',
    cardBorder: 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30',
    cardBg: 'bg-blue-600 text-white',
    iconBg: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
  },
  AVERIA: {
    id: 'AVERIA',
    rawCode: 'AVERIA',
    name: 'Avería / Merma Almacén',
    shortLabel: 'Avería Almacén',
    description: 'Derrame, caída accidental o rotura interna de producto en bodega',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-800 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-800',
    cardBorder: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/50 dark:bg-rose-950/30',
    cardBg: 'bg-rose-600 text-white',
    iconBg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
  },
  DEVOLUCION: {
    id: 'DEVOLUCION',
    rawCode: 'DEVOLUCION',
    name: 'Reclamo / Devolución',
    shortLabel: 'Devolución Proveedor',
    description: 'Producto no conforme retenido para gestión de canje o nota de crédito',
    badgeBg: 'bg-teal-50 dark:bg-teal-950/60',
    badgeText: 'text-teal-800 dark:text-teal-300',
    badgeBorder: 'border-teal-200 dark:border-teal-800',
    cardBorder: 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/50 dark:bg-teal-950/30',
    cardBg: 'bg-teal-600 text-white',
    iconBg: 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300'
  }
};

export function renderEventIcon(category: EventCategory, className = 'w-4 h-4') {
  switch (category) {
    case 'TRANSPORTE':
      return <Truck className={className} />;
    case 'DIFERENCIA':
      return <FileSpreadsheet className={className} />;
    case 'CAL_INTERNA':
    case 'CAL_EXTERNA':
      return <CheckCircle2 className={className} />;
    case 'AVERIA':
      return <PackageX className={className} />;
    case 'DEVOLUCION':
      return <RotateCcw className={className} />;
    case 'VENCIMIENTO_CERCANO':
      return <Clock3 className={className} />;
    case 'CANJES':
      return <Tag className={className} />;
    case 'VENCIMIENTO':
    default:
      return <Clock className={className} />;
  }
}

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
 * - Month/Year: MM/YYYY (evaluates to last day of the month)
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
  if (!str || str === '-' || str === 'N/A') return null;

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

  // 2. ISO format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (with optional time T... or space...)
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 0, 0, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Latin format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 0, 0, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }

  // 4. Compact numeric date format YYYYMMDD
  const ymdCompact = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymdCompact) {
    const d = new Date(Number(ymdCompact[1]), Number(ymdCompact[2]) - 1, Number(ymdCompact[3]), 0, 0, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }

  // 5. Month/Year format: MM/YYYY (evaluates to last day of that month)
  const my = str.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (my) {
    const m = Number(my[1]);
    const y = Number(my[2]);
    if (m >= 1 && m <= 12) {
      const lastDay = new Date(y, m, 0, 0, 0, 0, 0);
      if (!isNaN(lastDay.getTime())) return lastDay;
    }
  }

  // 6. Standard Date fallback
  const standard = new Date(str);
  if (!isNaN(standard.getTime())) {
    standard.setHours(0, 0, 0, 0);
    return standard;
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

export interface ItemStatusResult {
  code: 'EXPIRED' | 'RETIRE_NOW' | 'UPCOMING' | 'DRAINAGE_PM' | 'NORMAL';
  label: string;
  color: string;
  icon: React.ReactNode;
  daysToRetire: number | null;
  daysToExpiry: number | null;
}

export function getEndOfMonthDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

// ...

export function getExpiryDateFromYm(item: InventoryItem, headers: string[]): Date | null {
  // Try finding semantic columns for year/month, fallback to user provided defaults
  const yCol = findColumnBySemantic(headers, 'anio') || 'E';
  const mCol = findColumnBySemantic(headers, 'mes') || 'D';
  
  const year = item[yCol];
  const month = item[mCol];
  
  if (year === undefined || year === null || month === undefined || month === null) return null;
  
  const y = parseInt(String(year));
  const m = parseInt(String(month));
  
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return null;
  
  // AppSheet formula: EOMONTH(DATE([YYYY] & "-01-01") + ((NUMBER([MM]) - 1) * 31), 0)
  // Replicated logic: Returns last day of month m of year y
  return new Date(y, m, 0); 
}

// Helper to compute expiration, retirement and drainage status for an item
export function getItemStatus(item: InventoryItem, headers: string[]): ItemStatusResult {
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
    
    // If no retirement date provided, default to 30 days before expiration
    if (!daysToRetire && daysToExpiry !== null) {
      // Calculate based on expiry - 30 days
      const dRet = new Date(dVc);
      dRet.setDate(dRet.getDate() - 30);
      daysToRetire = Math.ceil((dRet.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  let code: 'EXPIRED' | 'RETIRE_NOW' | 'UPCOMING' | 'DRAINAGE_PM' | 'NORMAL' = 'NORMAL';
  let label = 'En Tiempo';
  let color = 'bg-slate-100 text-slate-700 border-slate-200';
  let icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;

  if (daysToExpiry !== null && daysToExpiry <= 0) {
    code = 'EXPIRED';
    label = 'Vencido';
    color = 'bg-rose-100 text-rose-800 border-rose-200';
    icon = <AlertCircle className="w-3.5 h-3.5 text-rose-600" />;
  } else if (daysToRetire !== null && daysToRetire <= 0) {
    code = 'RETIRE_NOW';
    label = 'Retirar Inmediatamente';
    color = 'bg-red-100 text-red-800 border-red-200 font-bold';
    icon = <AlertTriangle className="w-3.5 h-3.5 text-red-600" />;
  } else if (daysToRetire !== null && daysToRetire <= 30) {
    code = 'UPCOMING';
    label = `Próximo Retiro (${daysToRetire}d)`;
    color = 'bg-amber-100 text-amber-800 border-amber-200 font-semibold';
    icon = <Clock3 className="w-3.5 h-3.5 text-amber-600" />;
  } else if (daysToRetire !== null && daysToRetire <= 90) {
    code = 'DRAINAGE_PM';
    label = `Alerta Drenaje PM (${daysToRetire}d)`;
    color = 'bg-orange-100 text-orange-900 border-orange-200 font-semibold';
    icon = <Flame className="w-3.5 h-3.5 text-orange-600" />;
  }

  return { code, label, color, icon, daysToRetire, daysToExpiry };
}

/**
 * Determines whether an incident/FRC event is 'REALIZADO' (managed/resolved with a transfer number)
 * or 'PENDIENTE' (pending management, no valid transfer number registered).
 */
export function getItemResolutionStatus(item: InventoryItem, headers: string[]): EventResolutionStatus {
  const traspasoCol = findColumnBySemantic(headers, 'n_traspaso') 
    || headers.find(h => /^n(_|\s)?traspaso/i.test(h.trim()))
    || headers.find(h => /traspaso/i.test(h.trim()));

  const val = traspasoCol 
    ? item[traspasoCol] 
    : (item.N_TRASPASO || item.n_traspaso || item['N_TRASPASO'] || item['N° TRASPASO'] || item['NRO_TRASPASO'] || item['NUM_TRASPASO']);
  
  if (val !== undefined && val !== null) {
    const str = String(val).trim();
    // Exclude empty strings and placeholders like '-', '0', 's/n', 'sin asignar', 'pendiente', 'n/a'
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

/**
 * Calculates the withdrawal date based on expiration date and withdrawal days policy.
 * Converts withdrawal days to months (days / 30) and projects to the end of the target month (EOMONTH logic).
 */
export function calculateWithdrawalDate(dVc: Date, diasRetiro: number): Date {
  const monthsToSubtract = Math.round(diasRetiro / 30);
  return new Date(dVc.getFullYear(), dVc.getMonth() - monthsToSubtract + 1, 0);
}


