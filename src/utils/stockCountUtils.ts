import { 
  StockCountSession, 
  StockCountEntry, 
  StockCountReconciliationItem, 
  InventoryItem 
} from '../types';
import { findColumnBySemantic } from './columnAliases';
import { parseLocaleNumber } from './pureCalculations';
import { findMasterProduct, getMasterProductSummary } from './referenceResolver';
import { exportToExcel } from './exportUtils';

/**
 * Generates the composed natural unique key CU_VC: SKU + YYYY + MM
 * e.g. SKU: "2000210218569", YYYY: "2027", MM: "12" -> "2000210218569202712"
 */
export function generateCuVc(
  sku: string | number, 
  yyyy?: string | number, 
  mm?: string | number
): string {
  const cleanSku = String(sku || '').trim().replace(/\s+/g, '');
  if (!cleanSku) return '';
  if (!yyyy || !mm) return cleanSku;

  const cleanYyyy = String(yyyy).trim();
  const cleanMm = String(mm).trim().padStart(2, '0');

  if (/^\d{4}$/.test(cleanYyyy) && /^(0[1-9]|1[0-2])$/.test(cleanMm)) {
    return `${cleanSku}${cleanYyyy}${cleanMm}`;
  }

  return cleanSku;
}

/**
 * Calculates the exact last day of a given month and year in Latin date format DD/MM/YYYY
 * e.g. YYYY: 2027, MM: 12 -> "31/12/2027"
 * e.g. YYYY: 2028, MM: 02 -> "29/02/2028" (bisiesto)
 */
export function calculateLastDayOfMonthDateString(
  yyyy: string | number, 
  mm: string | number
): string {
  const y = parseInt(String(yyyy), 10);
  const m = parseInt(String(mm), 10);

  if (isNaN(y) || isNaN(m) || m < 1 || m > 12 || y < 1900 || y > 2100) {
    return '';
  }

  // Day 0 of next month is the last day of month m
  const lastDayObj = new Date(y, m, 0);
  const lastDay = String(lastDayObj.getDate()).padStart(2, '0');
  const monthStr = String(m).padStart(2, '0');

  return `${lastDay}/${monthStr}/${y}`;
}

/**
 * Generates a short 8-character unique alphanumeric ID for ID_VC
 */
export function generateShortVcId(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const STOCK_COUNT_STORAGE_KEY = 'app_stock_count_sessions_v1';

/**
 * Loads saved count sessions from localStorage (IndexedDB fallback safe)
 */
export function loadStockCountSessionsFromStorage(): StockCountSession[] {
  try {
    const raw = localStorage.getItem(STOCK_COUNT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Error loading stock count sessions from storage:', e);
    return [];
  }
}

/**
 * Persists count sessions to storage
 */
export function saveStockCountSessionsToStorage(sessions: StockCountSession[]): void {
  try {
    localStorage.setItem(STOCK_COUNT_STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('Error saving stock count sessions to storage:', e);
  }
}

/**
 * Reconciles physical count entries with the active theoretical inventory sheet
 */
export function reconcileStockCountSession(
  session: StockCountSession,
  sheetItems: InventoryItem[],
  headers: string[],
  masterProducts: any[] = []
): StockCountReconciliationItem[] {
  const qtyCol = findColumnBySemantic(headers, 'cantidad') || 'CANTIDAD';
  const skuCol = findColumnBySemantic(headers, 'sku') || 'SKU';
  const descCol = findColumnBySemantic(headers, 'descripcion') || 'PRODUCTO';
  const cuCol = findColumnBySemantic(headers, 'id') || headers.find(h => /^cu(_|\s)?vc$/i.test(h.trim())) || 'CU_VC';
  const mCol = findColumnBySemantic(headers, 'mes') || 'MM';
  const yCol = findColumnBySemantic(headers, 'anio') || 'YYYY';
  const fechaCol = findColumnBySemantic(headers, 'fecha_vc') || 'FECHA_VC';
  const rutCol = findColumnBySemantic(headers, 'proveedor') || 'RUT_PROVEEDOR_VC';
  const polCol = findColumnBySemantic(headers, 'politica') || 'POLITICA';
  const diasCol = findColumnBySemantic(headers, 'dias_retiro') || findColumnBySemantic(headers, 'dias_anticipacion') || 'DIAS RETIRO_VC';
  const mundoCol = findColumnBySemantic(headers, 'mundo') || findColumnBySemantic(headers, 'categoria') || 'MUNDO';
  const pmCol = findColumnBySemantic(headers, 'pm') || 'PM';

  // 1. Group physical counts by unique item key
  const physicalTotals = new Map<string, {
    sku: string;
    descripcion: string;
    cu_vc?: string;
    mm?: string;
    yyyy?: string;
    fecha_vc?: string;
    totalContado: number;
    rutProveedor?: string;
    politica?: string;
    diasRetiro?: number | string;
    mundo?: string;
    pm?: string;
  }>();

  for (const entry of session.conteos) {
    const key = session.requiereVencimiento && entry.cu_vc 
      ? entry.cu_vc 
      : String(entry.sku).trim();

    if (!key) continue;

    const existing = physicalTotals.get(key);
    if (existing) {
      existing.totalContado += entry.cantidad;
      if (!existing.descripcion && entry.descripcion) existing.descripcion = entry.descripcion;
      if (!existing.mm && entry.mm) existing.mm = entry.mm;
      if (!existing.yyyy && entry.yyyy) existing.yyyy = entry.yyyy;
      if (!existing.fecha_vc && entry.fecha_vc) existing.fecha_vc = entry.fecha_vc;
    } else {
      physicalTotals.set(key, {
        sku: entry.sku,
        descripcion: entry.descripcion,
        cu_vc: entry.cu_vc,
        mm: entry.mm,
        yyyy: entry.yyyy,
        fecha_vc: entry.fecha_vc,
        totalContado: entry.cantidad,
        rutProveedor: entry.rutProveedor,
        politica: entry.politica,
        diasRetiro: entry.diasRetiro,
        mundo: entry.mundo,
        pm: entry.pm
      });
    }
  }

  // 2. Map theoretical quantities from the active sheet
  const theoreticalMap = new Map<string, {
    item: InventoryItem;
    teorico: number;
    sku: string;
    descripcion: string;
    cu_vc?: string;
    mm?: string;
    yyyy?: string;
    fecha_vc?: string;
    rutProveedor?: string;
    politica?: string;
    diasRetiro?: number | string;
    mundo?: string;
    pm?: string;
  }>();

  for (const item of sheetItems) {
    const rawSku = skuCol ? item[skuCol] : item.SKU_VC || item.SKU;
    const cleanSku = String(rawSku || '').trim();
    if (!cleanSku) continue;

    const rawCu = cuCol ? item[cuCol] : item.CU_VC;
    const cleanCu = rawCu ? String(rawCu).trim() : '';

    const rawQty = qtyCol ? item[qtyCol] : item.CANTIDAD || item.CANT;
    const qtyNum = parseLocaleNumber(rawQty, 0);

    const rawDesc = descCol ? item[descCol] : item.PRODUCTO_VC || item.DESCRIPCION || '';
    const rawM = mCol ? item[mCol] : item.MM;
    const rawY = yCol ? item[yCol] : item.YYYY;
    const rawFecha = fechaCol ? item[fechaCol] : item.FECHA_VC;

    const key = session.requiereVencimiento && cleanCu 
      ? cleanCu 
      : (session.requiereVencimiento && rawY && rawM 
          ? generateCuVc(cleanSku, rawY, rawM) 
          : cleanSku);

    const existingTheor = theoreticalMap.get(key);
    if (existingTheor) {
      existingTheor.teorico += qtyNum;
    } else {
      theoreticalMap.set(key, {
        item,
        teorico: qtyNum,
        sku: cleanSku,
        descripcion: String(rawDesc || ''),
        cu_vc: cleanCu || (rawY && rawM ? generateCuVc(cleanSku, rawY, rawM) : undefined),
        mm: rawM ? String(rawM).padStart(2, '0') : undefined,
        yyyy: rawY ? String(rawY) : undefined,
        fecha_vc: rawFecha ? String(rawFecha) : undefined,
        rutProveedor: rutCol ? item[rutCol] : item.RUT_PROVEEDOR_VC,
        politica: polCol ? item[polCol] : item.POLITICA,
        diasRetiro: diasCol ? item[diasCol] : item['DIAS RETIRO_VC'],
        mundo: mundoCol ? item[mundoCol] : item.MUNDO,
        pm: pmCol ? item[pmCol] : item.PM
      });
    }
  }

  const reconciliationResults: StockCountReconciliationItem[] = [];
  const processedKeys = new Set<string>();

  // A. Process all items that have theoretical presence in sheet
  for (const [key, theor] of theoreticalMap.entries()) {
    processedKeys.add(key);
    const physical = physicalTotals.get(key);
    const contado = physical ? physical.totalContado : 0;
    const diferencia = contado - theor.teorico;

    let estado: StockCountReconciliationItem['estado'] = 'CUADRADO';
    if (contado === 0 && theor.teorico > 0) {
      estado = 'FALTANTE';
    } else if (diferencia < 0) {
      estado = 'FALTANTE';
    } else if (diferencia > 0) {
      estado = 'SOBRANTE';
    }

    // Dereference master product details if missing
    let finalDesc = theor.descripcion || (physical ? physical.descripcion : '');
    let finalRut = theor.rutProveedor || (physical ? physical.rutProveedor : '');
    let finalPol = theor.politica || (physical ? physical.politica : '');
    let finalDias = theor.diasRetiro || (physical ? physical.diasRetiro : '');
    let finalMundo = theor.mundo || (physical ? physical.mundo : '');
    let finalPm = theor.pm || (physical ? physical.pm : '');

    if (!finalDesc && masterProducts.length > 0) {
      const masterProd = findMasterProduct(theor.sku, masterProducts);
      if (masterProd) {
        const summary = getMasterProductSummary(masterProd);
        finalDesc = summary.name;
        finalRut = summary.provider;
        finalMundo = summary.category;
      }
    }

    reconciliationResults.push({
      itemKey: key,
      sku: theor.sku,
      descripcion: finalDesc,
      cu_vc: theor.cu_vc || (physical ? physical.cu_vc : undefined),
      mm: theor.mm || (physical ? physical.mm : undefined),
      yyyy: theor.yyyy || (physical ? physical.yyyy : undefined),
      fecha_vc: theor.fecha_vc || (physical ? physical.fecha_vc : undefined),
      teorico: theor.teorico,
      contado,
      diferencia,
      estado,
      rutProveedor: finalRut,
      politica: finalPol,
      diasRetiro: finalDias,
      mundo: finalMundo,
      pm: finalPm,
      rowIndexOriginal: theor.item._rowIndex
    });
  }

  // B. Process items counted physically that were NOT in the theoretical sheet
  for (const [key, physical] of physicalTotals.entries()) {
    if (processedKeys.has(key)) continue;

    let finalDesc = physical.descripcion;
    let finalRut = physical.rutProveedor;
    let finalMundo = physical.mundo;
    let finalPol = physical.politica;
    let finalDias = physical.diasRetiro;
    let finalPm = physical.pm;

    if (!finalDesc && masterProducts.length > 0) {
      const masterProd = findMasterProduct(physical.sku, masterProducts);
      if (masterProd) {
        const summary = getMasterProductSummary(masterProd);
        finalDesc = summary.name;
        finalRut = summary.provider;
        finalMundo = summary.category;
      }
    }

    reconciliationResults.push({
      itemKey: key,
      sku: physical.sku,
      descripcion: finalDesc || 'Producto no catalogado en hoja',
      cu_vc: physical.cu_vc,
      mm: physical.mm,
      yyyy: physical.yyyy,
      fecha_vc: physical.fecha_vc,
      teorico: 0,
      contado: physical.totalContado,
      diferencia: physical.totalContado,
      estado: 'NO_CATALOGADO',
      rutProveedor: finalRut,
      politica: finalPol,
      diasRetiro: finalDias,
      mundo: finalMundo,
      pm: finalPm
    });
  }

  return reconciliationResults;
}

/**
 * Formats a clean, structured 14-column record ready for the VENCIMIENTOS sheet
 * Matching the exact columns: ID_VC, SKU_VC, PRODUCTO_VC, MM, YYYY, FECHA_VC,
 * RUT_PROVEEDOR_VC, POLITICA, DIAS RETIRO_VC, MUNDO, PM, timestamp, CU_VC, TIPO_EVENTO
 */
export function buildVencimientosRowFromCount(
  item: StockCountEntry | StockCountReconciliationItem,
  existingRowIndex?: number,
  existingIdVc?: string
): Record<string, any> {
  const sku = String(item.sku || '').trim();
  const mm = item.mm ? String(item.mm).padStart(2, '0') : '';
  const yyyy = item.yyyy ? String(item.yyyy).trim() : '';
  const cu_vc = item.cu_vc || generateCuVc(sku, yyyy, mm);
  const fecha_vc = item.fecha_vc || (yyyy && mm ? calculateLastDayOfMonthDateString(yyyy, mm) : '');
  const id_vc = existingIdVc || generateShortVcId();

  return {
    ID_VC: id_vc,
    SKU_VC: sku,
    PRODUCTO_VC: item.descripcion || '',
    MM: mm,
    YYYY: yyyy,
    FECHA_VC: fecha_vc,
    RUT_PROVEEDOR_VC: item.rutProveedor || '',
    POLITICA: item.politica || '30',
    'DIAS RETIRO_VC': item.diasRetiro || '30',
    MUNDO: item.mundo || '',
    PM: item.pm || '',
    timestamp: new Date().toISOString(),
    CU_VC: cu_vc,
    TIPO_EVENTO: '',
    CANTIDAD: 'contado' in item ? item.contado : item.cantidad,
    _rowIndex: existingRowIndex !== undefined ? existingRowIndex : 0,
    _entityKey: cu_vc,
    _entityKeyCol: 'CU_VC'
  };
}

/**
 * Exports count reconciliation to Excel (.xlsx)
 */
export async function exportStockCountToExcel(
  session: StockCountSession,
  reconciliation: StockCountReconciliationItem[]
): Promise<void> {
  const headers = [
    'SKU',
    'DESCRIPCION',
    'CU_VC',
    'MM',
    'YYYY',
    'FECHA_VC',
    'STOCK_TEORICO',
    'STOCK_FISICO',
    'DIFERENCIA',
    'ESTADO_CUADRATURA',
    'PROVEEDOR',
    'POLITICA',
    'MUNDO',
    'PM'
  ];

  const rows = reconciliation.map(item => ({
    SKU: item.sku,
    DESCRIPCION: item.descripcion,
    CU_VC: item.cu_vc || '',
    MM: item.mm || '',
    YYYY: item.yyyy || '',
    FECHA_VC: item.fecha_vc || '',
    STOCK_TEORICO: item.teorico,
    STOCK_FISICO: item.contado,
    DIFERENCIA: item.diferencia,
    ESTADO_CUADRATURA: item.estado,
    PROVEEDOR: item.rutProveedor || '',
    POLITICA: item.politica || '',
    MUNDO: item.mundo || '',
    PM: item.pm || ''
  }));

  const safeName = session.nombre.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `Conteo_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  await exportToExcel(filename, headers, rows, 'Cuadratura_Conteo');
}

/**
 * Synthesizes dynamic, clean beep tones using the browser's Web Audio API (Zero dependencies)
 */
export function playBeep(type: 'success' | 'error' | 'skip'): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime); // Crisp, positive high beep
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'skip') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, ctx.currentTime); // Soft neutral beep
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth'; // Buzzer sound
      osc.frequency.setValueAtTime(140, ctx.currentTime); // Low pitch error buzz
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.warn('AudioContext failed to execute (expected browser gesture restriction if not interacted yet):', e);
  }
}
