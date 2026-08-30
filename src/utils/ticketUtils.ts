import { 
  TicketColumnConfig, 
  TicketGeneralSettings, 
  ViewTicketConfig, 
  ViewTicketSettings, 
  GlobalTicketConfig 
} from '../types';
import { findColumnBySemantic } from './columnAliases';

export const LOCAL_STORAGE_TICKET_KEY = 'global_ticket_print_config';

/**
 * Returns default general ticket settings based on the view
 */
export function getDefaultTicketGeneralSettings(activeView: string = 'main'): TicketGeneralSettings {
  let title = 'REPORTE VENCIMIENTOS';
  if (activeView === 'events') {
    title = 'REGISTRO DE INCIDENCIAS';
  } else if (activeView === 'products') {
    title = 'CATÁLOGO DE PRODUCTOS';
  } else if (activeView === 'policies') {
    title = 'POLÍTICAS DE RETIRO';
  } else if (activeView !== 'main') {
    title = `REPORTE - ${activeView.toUpperCase()}`;
  }

  return {
    title,
    paperWidth: '80mm',
    showDateTime: true,
    showTotalCount: true,
    footerText: '--- FIN DEL REPORTE ---'
  };
}

/**
 * Returns intelligent default column configuration using semantic detection
 */
export function getDefaultColumnConfig(header: string): TicketColumnConfig {
  const isSku = findColumnBySemantic([header], 'sku') !== undefined;
  if (isSku) {
    return { show: true, size: 12, bold: true };
  }

  const isDesc = findColumnBySemantic([header], 'descripcion') !== undefined;
  if (isDesc) {
    return { show: true, size: 11, bold: false };
  }

  const isFechaVc = findColumnBySemantic([header], 'fecha_vc') !== undefined;
  if (isFechaVc) {
    return { show: true, size: 11, bold: true };
  }

  const isCant = findColumnBySemantic([header], 'cantidad') !== undefined;
  if (isCant) {
    return { show: true, size: 10, bold: true };
  }

  const isLote = findColumnBySemantic([header], 'lote') !== undefined;
  if (isLote) {
    return { show: true, size: 10, bold: false };
  }

  const isTipoEvento = findColumnBySemantic([header], 'tipo_evento') !== undefined;
  if (isTipoEvento) {
    return { show: true, size: 11, bold: true };
  }

  const isNTraspaso = findColumnBySemantic([header], 'n_traspaso') !== undefined;
  if (isNTraspaso) {
    return { show: true, size: 10, bold: false };
  }

  const isFrcBod = findColumnBySemantic([header], 'frc_bod') !== undefined;
  if (isFrcBod) {
    return { show: true, size: 10, bold: false };
  }

  // Default for non-primary columns
  return { show: false, size: 10, bold: false };
}

/**
 * Creates full default settings for all headers
 */
export function getDefaultViewTicketSettings(headers: string[], activeView: string = 'main'): ViewTicketSettings {
  const columns: Record<string, TicketColumnConfig> = {};
  headers.forEach(h => {
    columns[h] = getDefaultColumnConfig(h);
  });

  return {
    columns,
    general: getDefaultTicketGeneralSettings(activeView)
  };
}

/**
 * Normalizes any legacy or partial ticket config into a complete ViewTicketSettings object
 */
export function normalizeTicketConfig(
  rawConfig: ViewTicketConfig | undefined,
  headers: string[],
  activeView: string = 'main'
): ViewTicketSettings {
  const defaultGeneral = getDefaultTicketGeneralSettings(activeView);
  
  if (!rawConfig) {
    return getDefaultViewTicketSettings(headers, activeView);
  }

  let rawColumns: Record<string, any> = {};
  let generalSettings: TicketGeneralSettings = { ...defaultGeneral };

  if ('columns' in rawConfig && typeof rawConfig.columns === 'object' && rawConfig.columns !== null) {
    rawColumns = rawConfig.columns;
    if (rawConfig.general) {
      generalSettings = { ...defaultGeneral, ...rawConfig.general };
    }
  } else {
    // Legacy format: rawConfig is directly Record<string, TicketColumnConfig>
    rawColumns = rawConfig as Record<string, any>;
  }

  // Check if at least one column is configured or visible
  const hasAnyConfigured = Object.keys(rawColumns).length > 0;
  const hasAnyVisible = Object.values(rawColumns).some(c => c && c.show === true);

  const columns: Record<string, TicketColumnConfig> = {};

  headers.forEach(header => {
    if (rawColumns[header] && typeof rawColumns[header] === 'object') {
      columns[header] = {
        show: Boolean(rawColumns[header].show),
        size: Number(rawColumns[header].size) || 10,
        bold: Boolean(rawColumns[header].bold)
      };
    } else if (!hasAnyConfigured || !hasAnyVisible) {
      // If config was completely empty, apply smart defaults
      columns[header] = getDefaultColumnConfig(header);
    } else {
      columns[header] = { show: false, size: 10, bold: false };
    }
  });

  return {
    columns,
    general: generalSettings
  };
}

/**
 * Loads ticket configs from localStorage
 */
export function loadTicketConfigFromStorage(): GlobalTicketConfig {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_TICKET_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load global ticket config from storage', e);
  }
  return {};
}

/**
 * Saves ticket configs to localStorage
 */
export function saveTicketConfigToStorage(config: GlobalTicketConfig): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_TICKET_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save global ticket config to storage', e);
  }
}
