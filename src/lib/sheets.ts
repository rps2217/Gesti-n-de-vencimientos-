export const SPREADSHEET_ID = '1a4jGo-7pduH4fue73F_67sQYJS0LJqI7hiXYpyWVA8o';

function getScriptUrl(): string | null {
  try {
    const url = localStorage.getItem('appsheet_clone_scriptUrl');
    return url ? url.trim() : null;
  } catch {
    return null;
  }
}

export interface ScriptResponse<T = any> {
  success?: boolean;
  error?: string;
  values?: any[][];
  sheets?: any[];
  config?: any;
  [key: string]: any;
}

interface FetchOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Robust fetch client for Google Apps Script with exponential backoff retries,
 * network timeout handling, and informative Spanish error messages.
 */
async function fetchFromScript<T = ScriptResponse>(
  payload: Record<string, any>,
  options: FetchOptions = {}
): Promise<T> {
  const { timeoutMs = 28000, maxRetries = 2, retryDelayMs = 1200 } = options;

  const url = getScriptUrl();
  if (!url) {
    throw new Error('La URL del script no está configurada. Ve a Configuración para ingresar tu Web App URL.');
  }

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // By using text/plain, fetch avoids unnecessary CORS preflight (OPTIONS)
      // which Apps Script doesn't handle natively.
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Error en el servicio de Google Apps Script (HTTP ${response.status}: ${response.statusText})`);
      }

      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('La respuesta de Google Apps Script no tiene formato JSON válido. Verifica que el Web App esté desplegado con acceso para "Cualquiera" (Anyone).');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      const isAbort = err.name === 'AbortError';
      const isNetworkError = err.message && (
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('Load failed')
      );

      // Only retry if it was a network drop or transient timeout and we have attempts left
      if ((isAbort || isNetworkError) && attempt < maxRetries) {
        attempt++;
        const backoff = retryDelayMs * Math.pow(1.5, attempt - 1);
        console.warn(`[AppsScript] Reintento ${attempt}/${maxRetries} tras fallo transitorio (${err.message}). Esperando ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }

      if (isAbort) {
        throw new Error(`La solicitud a Google Apps Script excedió el tiempo límite (${Math.round(timeoutMs / 1000)}s). Verifica tu conexión o el volumen de datos.`);
      }
      if (isNetworkError) {
        throw new Error('Error de conexión con Google Apps Script. Asegúrate de que el Web App esté publicado con acceso "Cualquiera" (Anyone) y no requiera inicio de sesión corporativo restringido.');
      }

      throw err;
    }
  }

  throw lastError || new Error('Fallo al comunicarse con Google Apps Script.');
}

// In-memory cache structures with TTL to avoid redundant HTTP requests
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const METADATA_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SHEET_DATA_TTL_MS = 3 * 60 * 1000; // 3 minutes
const CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedMetadata: CacheEntry<any> | null = null;
let cachedPropertiesConfig: CacheEntry<any> | null = null;
const cachedSheetsData = new Map<string, CacheEntry<any[][]>>();

export function clearSheetsCache(sheetName?: string) {
  if (sheetName) {
    cachedSheetsData.delete(sheetName.trim().toLowerCase());
  } else {
    cachedSheetsData.clear();
    cachedMetadata = null;
    cachedPropertiesConfig = null;
  }
}

export async function getSpreadsheetMetadata(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedMetadata && (now - cachedMetadata.timestamp < METADATA_TTL_MS)) {
    return cachedMetadata.data;
  }
  const data = await fetchFromScript({ action: 'getMetadata', spreadsheetId: SPREADSHEET_ID });
  cachedMetadata = { data, timestamp: now };
  return data;
}

export async function getSheetData(sheetName: string, forceRefresh = false) {
  const now = Date.now();
  const key = sheetName.trim().toLowerCase();
  if (!forceRefresh && cachedSheetsData.has(key)) {
    const entry = cachedSheetsData.get(key)!;
    if (now - entry.timestamp < SHEET_DATA_TTL_MS) {
      return entry.data;
    }
  }

  const data = await fetchFromScript({ action: 'getSheetData', sheetName, spreadsheetId: SPREADSHEET_ID });
  const values = data.values || [];
  cachedSheetsData.set(key, { data: values, timestamp: now });
  return values;
}

/**
 * Carga en lote de múltiples hojas en un solo viaje HTTP (Batch Fetching).
 * Reduce la latencia acumulada de conexión de ~6s a ~1.5s.
 */
export async function getAllSheetsData(
  sheetNames: string[],
  forceRefresh = false
): Promise<Record<string, any[][]>> {
  const result: Record<string, any[][]> = {};
  const namesToFetch: string[] = [];
  const now = Date.now();

  for (const name of sheetNames) {
    if (!name) continue;
    const key = name.trim().toLowerCase();
    if (!forceRefresh && cachedSheetsData.has(key)) {
      const entry = cachedSheetsData.get(key)!;
      if (now - entry.timestamp < SHEET_DATA_TTL_MS) {
        result[name] = entry.data;
        continue;
      }
    }
    namesToFetch.push(name);
  }

  if (namesToFetch.length === 0) {
    return result;
  }

  try {
    const res = await fetchFromScript({
      action: 'getAllSheetsData',
      sheetNames: namesToFetch,
      spreadsheetId: SPREADSHEET_ID
    });

    if (res && res.success && res.data) {
      for (const [name, rows] of Object.entries(res.data as Record<string, any[][]>)) {
        const rowsArr = rows || [];
        result[name] = rowsArr;
        cachedSheetsData.set(name.trim().toLowerCase(), { data: rowsArr, timestamp: now });
      }
      return result;
    }
  } catch (err) {
    console.warn('[Sheets] getAllSheetsData falló o el Web App no ha sido actualizado, aplicando fallback en paralelo:', err);
  }

  // Fallback retrocompatible: si el script remoto es una versión anterior sin getAllSheetsData
  const fallbackPromises = namesToFetch.map(async (name) => {
    try {
      const rows = await getSheetData(name, forceRefresh);
      result[name] = rows;
    } catch (e) {
      console.warn(`[Sheets] Error al obtener hoja fallback "${name}":`, e);
      result[name] = [];
    }
  });
  await Promise.all(fallbackPromises);

  return result;
}

export async function appendRow(sheetName: string, values: any[]) {
  clearSheetsCache(sheetName);
  return fetchFromScript({ action: 'appendRow', sheetName, values, spreadsheetId: SPREADSHEET_ID });
}

export async function updateRow(sheetName: string, rowIndex: number, values: any[]) {
  clearSheetsCache(sheetName);
  return fetchFromScript({ action: 'updateRow', sheetName, rowIndex, values, spreadsheetId: SPREADSHEET_ID });
}

export async function deleteRow(sheetId: number, rowIndex: number, sheetName?: string) {
  clearSheetsCache(sheetName);
  return fetchFromScript({ action: 'deleteRow', sheetId, rowIndex, sheetName, spreadsheetId: SPREADSHEET_ID });
}

export async function deleteRows(sheetId: number, rowIndexes: number[], sheetName?: string) {
  clearSheetsCache(sheetName);
  return fetchFromScript({ action: 'deleteRows', sheetId, rowIndexes, sheetName, spreadsheetId: SPREADSHEET_ID });
}

/**
 * Realiza un test de latencia en milisegundos y salud de conexión hacia Google Apps Script
 */
export async function pingGoogleSheets(): Promise<{ 
  success: boolean; 
  latencyMs: number; 
  error?: string; 
  urlConfigured: boolean 
}> {
  const url = getScriptUrl();
  if (!url) {
    return { success: false, latencyMs: 0, urlConfigured: false, error: 'URL no configurada (Modo Local)' };
  }

  const tStart = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAppProperties' }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const tEnd = performance.now();
    const latencyMs = Math.round(tEnd - tStart);

    if (!response.ok) {
      return { success: false, latencyMs, urlConfigured: true, error: `HTTP ${response.status}` };
    }

    return { success: true, latencyMs, urlConfigured: true };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const tEnd = performance.now();
    const latencyMs = Math.round(tEnd - tStart);
    return {
      success: false,
      latencyMs,
      urlConfigured: true,
      error: err.name === 'AbortError' ? 'Tiempo de espera agotado (>6s)' : (err.message || 'Error de conexión')
    };
  }
}

// PropertiesService storage (zero extra sheets needed)
export async function getScriptPropertiesConfig(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedPropertiesConfig && (now - cachedPropertiesConfig.timestamp < CONFIG_TTL_MS)) {
    return cachedPropertiesConfig.data;
  }
  try {
    const res = await fetchFromScript({ action: 'getAppProperties', spreadsheetId: SPREADSHEET_ID });
    if (res && res.success && res.config && (res.config.schema || res.config.main)) {
      cachedPropertiesConfig = { data: res.config, timestamp: now };
      return res.config;
    }
  } catch (e) {
    console.warn('Script Properties config not found or not supported yet:', e);
  }
  return null;
}

export async function saveScriptPropertiesConfig(config: any) {
  cachedPropertiesConfig = { data: config, timestamp: Date.now() };
  return fetchFromScript({ 
    action: 'saveAppProperties', 
    config, 
    spreadsheetId: SPREADSHEET_ID 
  });
}

export async function loadCloudConfig(configSheetName = '_CONFIG_APP') {
  try {
    const data = await getSheetData(configSheetName);
    if (data && data.length >= 2) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === 'APP_CONFIG' && data[i][1]) {
          return JSON.parse(data[i][1]);
        }
      }
      if (data[1][1] && data[1][1].startsWith('{')) {
        return JSON.parse(data[1][1]);
      }
      if (data[1][0] && data[1][0].startsWith('{')) {
        return JSON.parse(data[1][0]);
      }
    }
  } catch (e) {
    console.warn('Could not load cloud config:', e);
  }
  return null;
}

export async function saveCloudConfig(config: any, configSheetName = '_CONFIG_APP') {
  const jsonStr = JSON.stringify(config, null, 2);
  const rows = await getSheetData(configSheetName);
  
  if (rows.length === 0) {
    await appendRow(configSheetName, ['CLAVE', 'VALOR_JSON', 'ULTIMA_ACTUALIZACION']);
    await appendRow(configSheetName, ['APP_CONFIG', jsonStr, new Date().toISOString()]);
  } else {
    await updateRow(configSheetName, 2, ['APP_CONFIG', jsonStr, new Date().toISOString()]);
  }
}

/**
 * Persistencia en la nube de Campañas de Inventario y Sesiones de Conteo.
 * Permite que cualquier dispositivo conectado a Google Sheets comparta y consulte las campañas.
 */
export async function saveCampaignsToCloud(
  campaignsPayload: {
    campaigns: any[];
    activeCampaignId?: string | null;
    sessions?: any[];
    lastUpdated?: string;
  },
  configSheetName = '_CONFIG_APP'
): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify({
      ...campaignsPayload,
      lastUpdated: new Date().toISOString()
    });

    // 1. Guardar en Script Properties primero (latencia ultrarrápida sin crear pestañas extra)
    try {
      const scriptPropsRes = await fetchFromScript({
        action: 'saveAppProperties',
        config: {
          CAMPAIGNS_DATA: jsonStr
        },
        spreadsheetId: SPREADSHEET_ID
      });
      if (scriptPropsRes && scriptPropsRes.success) {
        // También intentar respaldar en _CONFIG_APP si está disponible
      }
    } catch (propsErr) {
      console.warn('[Sheets] No se pudo guardar campañas en ScriptProperties, guardando en hoja _CONFIG_APP:', propsErr);
    }

    // 2. Guardar en la hoja _CONFIG_APP como respaldo visible
    try {
      const rows = await getSheetData(configSheetName);
      let foundRow = -1;
      if (rows && rows.length >= 1) {
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][0] === 'CAMPAIGNS_DATA') {
            foundRow = i + 1;
            break;
          }
        }
      }

      if (foundRow > 0) {
        await updateRow(configSheetName, foundRow, ['CAMPAIGNS_DATA', jsonStr, new Date().toISOString()]);
      } else {
        if (!rows || rows.length === 0) {
          await appendRow(configSheetName, ['CLAVE', 'VALOR_JSON', 'ULTIMA_ACTUALIZACION']);
        }
        await appendRow(configSheetName, ['CAMPAIGNS_DATA', jsonStr, new Date().toISOString()]);
      }
    } catch (sheetErr) {
      console.warn('[Sheets] Respaldo en _CONFIG_APP falló:', sheetErr);
    }

    return true;
  } catch (err) {
    console.error('[Sheets] Error al guardar campañas en la nube:', err);
    throw err;
  }
}

/**
 * Carga las campañas de inventario y sesiones desde Google Sheets (Nube)
 */
export async function loadCampaignsFromCloud(configSheetName = '_CONFIG_APP'): Promise<{
  campaigns?: any[];
  activeCampaignId?: string | null;
  sessions?: any[];
  lastUpdated?: string;
} | null> {
  // 1. Intentar cargar desde Script Properties
  try {
    const res = await fetchFromScript({ action: 'getAppProperties', spreadsheetId: SPREADSHEET_ID });
    if (res && res.success && res.config && res.config.CAMPAIGNS_DATA) {
      const parsed = typeof res.config.CAMPAIGNS_DATA === 'string' 
        ? JSON.parse(res.config.CAMPAIGNS_DATA) 
        : res.config.CAMPAIGNS_DATA;
      if (parsed && Array.isArray(parsed.campaigns)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Sheets] Script Properties no devolvió CAMPAIGNS_DATA:', e);
  }

  // 2. Intentar cargar desde la hoja _CONFIG_APP
  try {
    const rows = await getSheetData(configSheetName);
    if (rows && rows.length >= 2) {
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === 'CAMPAIGNS_DATA' && rows[i][1]) {
          const parsed = JSON.parse(rows[i][1]);
          if (parsed && Array.isArray(parsed.campaigns)) {
            return parsed;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Sheets] No se pudo leer CAMPAIGNS_DATA de _CONFIG_APP:', e);
  }

  return null;
}

export const AUDIT_SHEET_DEFAULT_HEADERS = [
  'ID_CAMPANA',
  'FECHA_AUDITORIA',
  'LOCAL',
  'SKU',
  'DESCRIPCION',
  'PROVEEDOR',
  'STOCK_ERP',
  'STOCK_FISICO',
  'DIFERENCIA',
  'VENTA_AJUSTE',
  'ESTADO_AUDITORIA',
  'UBICACIONES_MUEBLES',
  'USUARIO_TERMINAL',
  'ULTIMA_ACTUALIZACION'
];

/**
 * Guarda las filas consolidadas de auditoría física en una pestaña DEDICADA de Google Sheets
 * (por defecto "_AUDITORIA_INVENTARIO" o "AUDITORIA_CAMPANAS").
 * PRESERVA la pestaña VENCIMIENTOS intacta y sin mezclar.
 */
export async function saveAuditRowsToDedicatedSheet(
  sheetName: string = '_AUDITORIA_INVENTARIO',
  rows: Record<string, any>[]
): Promise<{ success: boolean; count: number; sheetName: string }> {
  if (!rows || rows.length === 0) {
    return { success: true, count: 0, sheetName };
  }

  clearSheetsCache(sheetName);
  let existingData: any[][] = [];
  try {
    existingData = await getSheetData(sheetName, true);
  } catch (err) {
    console.warn(`[Sheets] La hoja ${sheetName} no existe aún o está vacía, se creará al insertar encabezados.`, err);
    existingData = [];
  }

  // Si la hoja está vacía, insertar encabezados oficiales
  if (!existingData || existingData.length === 0) {
    await appendRow(sheetName, AUDIT_SHEET_DEFAULT_HEADERS);
    existingData = [AUDIT_SHEET_DEFAULT_HEADERS];
  }

  const headerList: string[] = existingData[0] && existingData[0].length > 0 
    ? existingData[0].map(h => String(h).trim().toUpperCase()) 
    : AUDIT_SHEET_DEFAULT_HEADERS;

  // Mapa de SKU existente en la hoja de auditoría para actualizar si ya existe la fila en la misma campaña
  const skuRowMap = new Map<string, number>();
  const campaignColIdx = headerList.findIndex(h => /ID_CAMPANA|CAMPANA/i.test(h));
  const skuColIdx = headerList.findIndex(h => /^SKU$|CODIGO/i.test(h));

  for (let r = 1; r < existingData.length; r++) {
    const campVal = campaignColIdx >= 0 ? String(existingData[r][campaignColIdx] || '').trim() : '';
    const skuVal = skuColIdx >= 0 ? String(existingData[r][skuColIdx] || '').trim() : '';
    if (skuVal) {
      skuRowMap.set(`${campVal}_${skuVal}`, r + 1); // 1-indexed row number in Google Sheets
    }
  }

  const nowIso = new Date().toISOString();
  let updatedCount = 0;
  let appendedCount = 0;

  for (const row of rows) {
    const campId = String(row.ID_CAMPANA || row.id_campana || '').trim();
    const sku = String(row.SKU || row.sku || '').trim();
    const compositeKey = `${campId}_${sku}`;

    const values = headerList.map(header => {
      if (header === 'ULTIMA_ACTUALIZACION') return nowIso;
      if (row[header] !== undefined) return String(row[header]);
      // Search lowercase or normalized key
      const lowerKey = header.toLowerCase();
      if (row[lowerKey] !== undefined) return String(row[lowerKey]);
      return '';
    });

    const existingRowNumber = skuRowMap.get(compositeKey);
    if (existingRowNumber) {
      await updateRow(sheetName, existingRowNumber, values);
      updatedCount++;
    } else {
      await appendRow(sheetName, values);
      appendedCount++;
    }
  }

  return { 
    success: true, 
    count: updatedCount + appendedCount, 
    sheetName 
  };
}

export const APPS_SCRIPT_TEMPLATE = `// Google Apps Script (Code.gs) - Versión de Alto Rendimiento (Lectura Concurrente + Carga en Lote)
function doPost(e) {
  let isWriteAction = false;
  let lock = null;
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const spreadsheetId = payload.spreadsheetId;
    const ss = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();

    // OPTIMIZACIÓN 1: El candado de exclusión SOLO se activa en escrituras/mutaciones
    // Las operaciones de lectura (getMetadata, getSheetData, getAllSheetsData, getAppProperties)
    // corren concurrentemente a máxima velocidad sin colas ni tiempos de espera.
    const writeActions = ['appendRow', 'updateRow', 'deleteRow', 'deleteRows', 'saveAppProperties'];
    isWriteAction = writeActions.indexOf(action) !== -1;
    if (isWriteAction) {
      lock = LockService.getScriptLock();
      lock.waitLock(15000);
    }

    // Helper: Extrae datos en memoria limpia usando getValues() nativo (3x más veloz que getDisplayValues)
    function getCleanSheetValues(sheet) {
      if (!sheet) return [];
      var raw = sheet.getDataRange().getValues();
      if (!raw || raw.length === 0) return [];
      var lastRowIdx = raw.length - 1;
      while (lastRowIdx > 0) {
        var row = raw[lastRowIdx];
        var hasVal = false;
        for (var c = 0; c < row.length; c++) {
          if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
            hasVal = true;
            break;
          }
        }
        if (hasVal) break;
        lastRowIdx--;
      }
      var clean = raw.slice(0, lastRowIdx + 1);
      // Formatear fechas nativas de Google Sheets a formato legible DD/MM/YYYY
      for (var r = 1; r < clean.length; r++) {
        for (var c = 0; c < clean[r].length; c++) {
          var cell = clean[r][c];
          if (cell instanceof Date && !isNaN(cell.getTime())) {
            var dd = ('0' + cell.getDate()).slice(-2);
            var mm = ('0' + (cell.getMonth() + 1)).slice(-2);
            var yyyy = cell.getFullYear();
            clean[r][c] = dd + '/' + mm + '/' + yyyy;
          }
        }
      }
      return clean;
    }

    // 1. METADATOS DE HOJAS
    if (action === 'getMetadata') {
      const sheets = ss.getSheets().map(sheet => ({
        properties: {
          sheetId: sheet.getSheetId(),
          title: sheet.getName(),
          hidden: sheet.isSheetHidden(),
          gridProperties: {
            rowCount: sheet.getMaxRows(),
            columnCount: sheet.getMaxColumns()
          }
        }
      }));
      return responseJson({ sheets: sheets });
    }

    // 2. CARGA EN LOTE DE MÚLTIPLES HOJAS EN UN SOLO VIAJE (BATCH FETCH - ALTA VELOCIDAD)
    if (action === 'getAllSheetsData') {
      const sheetNames = payload.sheetNames || [];
      const results = {};
      for (var sIdx = 0; sIdx < sheetNames.length; sIdx++) {
        var sName = sheetNames[sIdx];
        var targetSheet = ss.getSheetByName(sName);
        if (targetSheet) {
          results[sName] = getCleanSheetValues(targetSheet);
        }
      }
      return responseJson({ success: true, data: results });
    }

    // 3. OBTENER DATOS DE UNA SOLA HOJA
    if (action === 'getSheetData') {
      const sheet = ss.getSheetByName(payload.sheetName);
      if (!sheet) return responseJson({ error: 'Hoja no encontrada: ' + payload.sheetName, values: [] });
      return responseJson({ values: getCleanSheetValues(sheet) });
    }

    // 4. AGREGAR FILA
    if (action === 'appendRow') {
      const sheet = ss.getSheetByName(payload.sheetName);
      if (!sheet) return responseJson({ error: 'Hoja no encontrada' });
      sheet.appendRow(payload.values);
      return responseJson({ success: true });
    }

    // 5. ACTUALIZAR FILA
    if (action === 'updateRow') {
      const sheet = ss.getSheetByName(payload.sheetName);
      if (!sheet) return responseJson({ error: 'Hoja no encontrada' });
      sheet.getRange(payload.rowIndex, 1, 1, payload.values.length).setValues([payload.values]);
      return responseJson({ success: true });
    }

    // 6. ELIMINAR FILA O FILAS
    if (action === 'deleteRow' || action === 'deleteRows') {
      let sheet = payload.sheetId !== undefined ? ss.getSheets().find(s => s.getSheetId() === payload.sheetId) : null;
      if (!sheet && payload.sheetName) {
        sheet = ss.getSheetByName(payload.sheetName);
      }
      if (!sheet) return responseJson({ error: 'Hoja no encontrada' });

      var indexes = action === 'deleteRows' ? (payload.rowIndexes || []) : [payload.rowIndex];
      if (!indexes || !indexes.length) return responseJson({ error: 'No se especificaron filas para eliminar' });

      var sortedIndexes = indexes.slice().sort(function(a, b) { return b - a; });
      for (var i = 0; i < sortedIndexes.length; i++) {
        sheet.deleteRow(sortedIndexes[i]);
      }
      return responseJson({ success: true });
    }

    // 7. LEER SCRIPT PROPERTIES (Sin crear hojas)
    if (action === 'getAppProperties') {
      const scriptProps = PropertiesService.getScriptProperties();
      const raw = scriptProps.getProperty('APP_CONFIG');
      let parsed = null;
      if (raw) {
        try { parsed = JSON.parse(raw); } catch (err) {}
      }
      return responseJson({ success: true, config: parsed });
    }

    // 8. GUARDAR EN SCRIPT PROPERTIES (Sin crear hojas)
    if (action === 'saveAppProperties') {
      const scriptProps = PropertiesService.getScriptProperties();
      const str = typeof payload.config === 'string' ? payload.config : JSON.stringify(payload.config);
      scriptProps.setProperty('APP_CONFIG', str);
      return responseJson({ success: true });
    }

    return responseJson({ error: 'Acción no soportada: ' + action });
  } catch (err) {
    return responseJson({ error: err.toString() });
  } finally {
    if (isWriteAction && lock) {
      try { lock.releaseLock(); } catch(e) {}
    }
  }
}

function doGet(e) {
  return responseJson({ status: 'ok', message: 'API Apps Script lista y conectada.' });
}

function responseJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const APPS_SCRIPT_ADVANCED_PROPERTIES_CODE = APPS_SCRIPT_TEMPLATE;
export const APPS_SCRIPT_RECOMMENDED_CODE = APPS_SCRIPT_TEMPLATE;
