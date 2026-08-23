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

async function fetchFromScript<T = ScriptResponse>(payload: Record<string, any>, timeoutMs = 25000): Promise<T> {
  const url = getScriptUrl();
  if (!url) {
    throw new Error('La URL del script no está configurada. Ve a Configuración para ingresar tu Web App URL.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // By omitting the Content-Type header or setting it to text/plain, 
    // fetch sends a simple request that bypasses CORS preflight (OPTIONS).
    // Apps Script receives it natively.
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
      throw new Error(`Error de servidor Apps Script (HTTP ${response.status}: ${response.statusText})`);
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
    if (err.name === 'AbortError') {
      throw new Error('La solicitud a Google Apps Script excedió el tiempo límite (25s). Verifica tu conexión a internet.');
    }
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('Error de conexión con Google Apps Script. Asegúrate de que el Web App esté publicado con acceso "Cualquiera" (Anyone) y no requiera inicio de sesión de Google en el navegador.');
    }
    throw err;
  }
}

export async function getSpreadsheetMetadata() {
  return fetchFromScript({ action: 'getMetadata', spreadsheetId: SPREADSHEET_ID });
}

export async function getSheetData(sheetName: string) {
  const data = await fetchFromScript({ action: 'getSheetData', sheetName, spreadsheetId: SPREADSHEET_ID });
  return data.values || [];
}

export async function appendRow(sheetName: string, values: any[]) {
  return fetchFromScript({ action: 'appendRow', sheetName, values, spreadsheetId: SPREADSHEET_ID });
}

export async function updateRow(sheetName: string, rowIndex: number, values: any[]) {
  return fetchFromScript({ action: 'updateRow', sheetName, rowIndex, values, spreadsheetId: SPREADSHEET_ID });
}

export async function deleteRow(sheetId: number, rowIndex: number) {
  return fetchFromScript({ action: 'deleteRow', sheetId, rowIndex, spreadsheetId: SPREADSHEET_ID });
}

// Opción 2: Almacenamiento directo en PropertiesService (sin hojas adicionales)
export async function getScriptPropertiesConfig() {
  try {
    const res = await fetchFromScript({ action: 'getAppProperties', spreadsheetId: SPREADSHEET_ID });
    if (res && res.success && res.config && (res.config.schema || res.config.main)) {
      return res.config;
    }
  } catch (e) {
    console.warn('Script Properties config not found or not supported yet:', e);
  }
  return null;
}

export async function saveScriptPropertiesConfig(config: any) {
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
      // Look for KEY 'APP_CONFIG' or row 2 column 2
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === 'APP_CONFIG' && data[i][1]) {
          return JSON.parse(data[i][1]);
        }
      }
      // If single raw JSON cell in row 2 col 1 or 2
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
    // Add header and first config row
    await appendRow(configSheetName, ['CLAVE', 'VALOR_JSON', 'ULTIMA_ACTUALIZACION']);
    await appendRow(configSheetName, ['APP_CONFIG', jsonStr, new Date().toISOString()]);
  } else {
    // Check if row exists, update row 2
    await updateRow(configSheetName, 2, ['APP_CONFIG', jsonStr, new Date().toISOString()]);
  }
}

export const APPS_SCRIPT_TEMPLATE = `// Google Apps Script (Code.gs) - Versión con soporte completo para PropertiesService
function doPost(e) {
  try {
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

    // 5. ELIMINAR FILA
    if (action === 'deleteRow') {
      const sheet = ss.getSheets().find(s => s.getSheetId() === payload.sheetId);
      if (!sheet) return responseJson({ error: 'Hoja no encontrada' });
      sheet.deleteRow(payload.rowIndex);
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
  }
}

function doGet(e) {
  return responseJson({ status: 'ok', message: 'API Apps Script lista y conectada.' });
}

function responseJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export const APPS_SCRIPT_ADVANCED_PROPERTIES_CODE = APPS_SCRIPT_TEMPLATE;
export const APPS_SCRIPT_RECOMMENDED_CODE = APPS_SCRIPT_TEMPLATE;
