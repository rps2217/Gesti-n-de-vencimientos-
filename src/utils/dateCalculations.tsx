import React from 'react';
import { 
  Truck, FileSpreadsheet, PackageX, RotateCcw, Clock, AlertCircle, AlertTriangle, Clock3, Flame, CheckCircle2 
} from 'lucide-react';
import { InventoryItem, EventCategory, EventTypeDefinition } from '../types';
import { findColumnBySemantic } from './columnAliases';

export const EVENT_CATEGORIES: Record<EventCategory, {
  id: EventCategory;
  name: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBorder: string;
  cardBg: string;
  iconBg: string;
}> = {
  VENCIMIENTO: {
    id: 'VENCIMIENTO',
    name: 'Vencimiento Regular',
    shortLabel: 'Vencimiento',
    description: 'Control de caducidad, fecha de retiro preventivo y radar comercial para PM',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    cardBorder: 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50',
    cardBg: 'bg-blue-600 text-white',
    iconBg: 'bg-blue-100 text-blue-700'
  },
  TRANSPORTE: {
    id: 'TRANSPORTE',
    name: 'Deterioro de Transporte',
    shortLabel: 'Deterioro Transporte',
    description: 'Embalaje dañado, golpe o rotura física durante el flete o recepción',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    cardBorder: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50',
    cardBg: 'bg-amber-600 text-white',
    iconBg: 'bg-amber-100 text-amber-800'
  },
  DIFERENCIA: {
    id: 'DIFERENCIA',
    name: 'Diferencia de Pedido',
    shortLabel: 'Diferencia Pedido',
    description: 'Inconsistencia de unidades recibidas vs factura o guía (faltante / sobrante / trocado)',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
    cardBorder: 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/50',
    cardBg: 'bg-purple-600 text-white',
    iconBg: 'bg-purple-100 text-purple-800'
  },
  AVERIA: {
    id: 'AVERIA',
    name: 'Avería / Merma Almacén',
    shortLabel: 'Avería Almacén',
    description: 'Derrame, caída accidental o rotura interna de producto en bodega',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200',
    cardBorder: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/50',
    cardBg: 'bg-rose-600 text-white',
    iconBg: 'bg-rose-100 text-rose-800'
  },
  DEVOLUCION: {
    id: 'DEVOLUCION',
    name: 'Reclamo / Devolución',
    shortLabel: 'Devolución Proveedor',
    description: 'Producto no conforme retenido para gestión de canje o nota de crédito',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-200',
    cardBorder: 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/50',
    cardBg: 'bg-teal-600 text-white',
    iconBg: 'bg-teal-100 text-teal-800'
  }
};

export function renderEventIcon(category: EventCategory, className = 'w-4 h-4') {
  switch (category) {
    case 'TRANSPORTE':
      return <Truck className={className} />;
    case 'DIFERENCIA':
      return <FileSpreadsheet className={className} />;
    case 'AVERIA':
      return <PackageX className={className} />;
    case 'DEVOLUCION':
      return <RotateCcw className={className} />;
    case 'VENCIMIENTO':
    default:
      return <Clock className={className} />;
  }
}

/**
 * Universal Date Parser supporting:
 * - Google Sheets / Excel serial numbers (e.g. 45321)
 * - ISO format: YYYY-MM-DD, YYYY/MM/DD
 * - Latin format: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * - Month/Year: MM/YYYY (evaluates to last day of the month)
 * - Native Date objects or timestamps
 */
export function parseAnyDate(dateVal: any): Date | null {
  if (dateVal === null || dateVal === undefined) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  
  // 1. Google Sheets / Excel Serial Date number check (e.g. 45321)
  if (typeof dateVal === 'number' && !isNaN(dateVal) && dateVal > 20000 && dateVal < 70000) {
    // 25569 = Days between 1899-12-30 and 1970-01-01 (Unix epoch)
    const ms = Math.round((dateVal - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }

  const str = String(dateVal).trim();
  if (!str) return null;

  // Numeric string check for Excel serial
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 20000 && num < 70000) {
      const ms = Math.round((num - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 2. ISO format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Latin format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // 4. Compact numeric date format YYYYMMDD
  const ymdCompact = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymdCompact) {
    const d = new Date(Number(ymdCompact[1]), Number(ymdCompact[2]) - 1, Number(ymdCompact[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // 5. Month/Year format: MM/YYYY (evaluates to last day of that month)
  const my = str.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (my) {
    const m = Number(my[1]);
    const y = Number(my[2]);
    if (m >= 1 && m <= 12) {
      const lastDay = new Date(y, m, 0);
      if (!isNaN(lastDay.getTime())) return lastDay;
    }
  }

  // 6. Standard Date fallback
  const standard = new Date(str);
  if (!isNaN(standard.getTime())) return standard;

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
  const eventHeader = findColumnBySemantic(headers, 'tipo_evento');
  if (eventHeader && item[eventHeader]) {
    const raw = String(item[eventHeader]).toUpperCase();
    if (raw.includes('TRANSP') || raw.includes('FLETE') || raw.includes('DAÑO') || raw.includes('DETERIORO')) return 'TRANSPORTE';
    if (raw.includes('DIFER') || raw.includes('PEDIDO') || raw.includes('FALT') || raw.includes('SOBR') || raw.includes('TROC')) return 'DIFERENCIA';
    if (raw.includes('AVER') || raw.includes('MERMA') || raw.includes('ROTURA')) return 'AVERIA';
    if (raw.includes('DEVOL') || raw.includes('RECLAM') || raw.includes('CANJE_PROV')) return 'DEVOLUCION';
    if (raw.includes('VENC') || raw.includes('CADUC')) return 'VENCIMIENTO';
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

// Helper to compute expiration, retirement and drainage status for an item
export function getItemStatus(item: InventoryItem, headers: string[]): ItemStatusResult {
  const retCol = findColumnBySemantic(headers, 'fecha_retiro');
  const vcCol = findColumnBySemantic(headers, 'fecha_vc');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let daysToRetire: number | null = null;
  let daysToExpiry: number | null = null;

  if (retCol && item[retCol]) {
    const dRet = parseAnyDate(item[retCol]);
    if (dRet) {
      daysToRetire = Math.ceil((dRet.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  if (vcCol && item[vcCol]) {
    const dVc = parseAnyDate(item[vcCol]);
    if (dVc) {
      daysToExpiry = Math.ceil((dVc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

