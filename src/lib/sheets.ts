export const SPREADSHEET_ID = '1a4jGo-7pduH4fue73F_67sQYJS0LJqI7hiXYpyWVA8o';

function getScriptUrl(): string | null {
  const url = localStorage.getItem('appsheet_clone_scriptUrl');
  return url ? url.trim() : null;
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

export const APPS_SCRIPT_TEMPLATE = `// Google Apps Script (Code.gs) - Versión con control de concurrencia
function doPost(e) {
  // Inicializar candado para evitar colisiones (Race Conditions) en operaciones concurrentes
  const lock = LockService.getScriptLock();
  try {
    // Esperar hasta 30 segundos para obtener acceso exclusivo
    lock.waitLock(30000);

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const spreadsheetId = payload.spreadsheetId;
    const ss = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();

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

    // 2. OBTENER DATOS DE UNA HOJA
    if (action === 'getSheetData') {
      const sheet = ss.getSheetByName(payload.sheetName);
      if (!sheet) return responseJson({ error: 'Hoja no encontrada: ' + payload.sheetName, values: [] });
      const data = sheet.getDataRange().getDisplayValues();
      return responseJson({ values: data });
    }

    // 3. AGREGAR FILA
    if (action === 'appendRow') {
      const sheet = ss.getSheetByName(payload.sheetName);
      if (!sheet) return responseJson({ error: 'Hoja no encontrada' });
      sheet.appendRow(payload.values);
      return responseJson({ success: true });
    }

    // 4. ACTUALIZAR FILA
    if (action === 'updateRow') {
      const sheet = ss.getSheetByName(payload.sheetName);
      if (!sheet) return responseJson({ error: 'Hoja no encontrada' });
      sheet.getRange(payload.rowIndex, 1, 1, payload.values.length).setValues([payload.values]);
      return responseJson({ success: true });
    }

    // 5. ELIMINAR FILA O FILAS
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

    // 6. OPCIÓN 2: LEER SCRIPT PROPERTIES (Sin crear hojas)
    if (action === 'getAppProperties') {
      const scriptProps = PropertiesService.getScriptProperties();
      const raw = scriptProps.getProperty('APP_CONFIG');
      let parsed = null;
      if (raw) {
        try { parsed = JSON.parse(raw); } catch (err) {}
      }
      return responseJson({ success: true, config: parsed });
    }

    // 7. OPCIÓN 2: GUARDAR EN SCRIPT PROPERTIES (Sin crear hojas)
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
    // Siempre liberar el candado para no bloquear futuros requests
    lock.releaseLock();
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
