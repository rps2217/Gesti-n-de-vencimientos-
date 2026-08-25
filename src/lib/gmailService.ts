import { findColumnBySemantic, KnownFieldSemantic } from '../utils/columnAliases';
import { 
  formatDisplayDate, 
  parseAnyDate, 
  getEventCategory, 
  getItemStatus, 
  getItemResolutionStatus,
  EVENT_CATEGORIES 
} from '../utils/dateCalculations';

function createMimeMessage({
  to,
  subject,
  bodyHtml,
  bodyText
}: {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}) {
  const boundary = "=====" + Date.now().toString(16) + "=====";
  const nl = "\r\n";
  const str = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(bodyText || ''))),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(bodyHtml))),
    ``,
    `--${boundary}--`
  ].join(nl);

  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createGmailDraft(
  accessToken: string,
  params: { to: string; subject: string; bodyHtml: string; bodyText?: string }
) {
  const rawMessage = createMimeMessage(params);
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        raw: rawMessage
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Error al crear borrador en Gmail');
  }

  return await response.json();
}

/**
 * Intelligent helper to extract a field value from an item using semantic matching,
 * regex candidate matching across all object keys, and direct key checks.
 */
function extractFieldValue(
  item: any,
  candidateKeys: string[],
  semantic: KnownFieldSemantic,
  customAliases?: Record<string, string[]>,
  regexFallbacks: RegExp[] = []
): string {
  if (!item || typeof item !== 'object') return '';

  // 1. Direct explicit property checks on the item
  const itemKeys = Object.keys(item);
  
  // Specific direct checks based on semantic
  if (semantic === 'sku') {
    for (const k of ['SKU', 'sku', 'Sku', 'COD PRODUCTO', 'COD_PRODUCTO', 'CODIGO', 'CÓDIGO', 'COD', 'FRC_N', 'FRC/N', 'FRC', 'Item', 'ITEM', 'Articulo', 'ARTICULO', 'ID', 'id']) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
        return String(item[k]).trim();
      }
    }
  }

  if (semantic === 'descripcion') {
    for (const k of ['DESCRIPCION', 'DESCRIPCIÓN', 'Descripcion', 'Descripción', 'PRODUCTO', 'Producto', 'ARTICULO', 'Articulo', 'NOMBRE', 'Nombre', 'DETALLE', 'Detalle', 'DENOMINACION', 'Denominacion', 'Item_Name', 'ITEM_NAME']) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
        return String(item[k]).trim();
      }
    }
  }

  if (semantic === 'lote') {
    for (const k of ['LOTE', 'Lote', 'lote', 'BATCH', 'Batch', 'batch', 'LOT', 'Lot', 'NRO_LOTE', 'NUM_LOTE']) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
        return String(item[k]).trim();
      }
    }
  }

  if (semantic === 'cantidad') {
    for (const k of ['CANTIDAD', 'Cantidad', 'cantidad', 'CANTIDAD AFECTADA', 'CANTIDAD_AFECTADA', 'STOCK', 'Stock', 'UNIDADES', 'Unidades', 'QTY', 'Qty', 'qty', 'CANT', 'Cant']) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
        return String(item[k]).trim();
      }
    }
  }

  if (semantic === 'fecha_vc') {
    for (const k of ['FECHA_VENCIMIENTO', 'FECHA_VC', 'FECHA VC', 'FECHA VENCIMIENTO', 'VENCIMIENTO', 'Vto', 'VTO', 'F_VTO', 'F_VENC', 'FECHA_VTO', 'FECHA VTO', 'CADUCIDAD', 'EXP_DATE']) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
        return String(item[k]).trim();
      }
    }
  }

  if (semantic === 'fecha_retiro') {
    for (const k of ['FECHA_RETIRO', 'FECHA RETIRO', 'RETIRO', 'F_RETIRO', 'FECHA_CANJE', 'CANJE', 'fecha_retiro_calc', '_virtual_fecha_retiro']) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
        return String(item[k]).trim();
      }
    }
  }

  if (semantic === 'proveedor') {
    for (const k of ['PROVEEDOR', 'Proveedor', 'proveedor', 'LABORATORIO', 'Laboratorio', 'MARCA', 'Marca', 'FABRICANTE', 'Fabricante', 'VENDOR', 'Vendor', 'SUPPLIER', 'Supplier']) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
        return String(item[k]).trim();
      }
    }
  }

  if (semantic === 'tipo_evento') {
    for (const k of ['FRC_EVEN', 'FRC EVEN', 'TIPO_EVENTO', 'TIPO EVENTO', 'MOTIVO / INCIDENCIA', 'MOTIVO/INCIDENCIA', 'INCIDENCIA', 'EVENTO', 'MOTIVO', 'CONCEPTO']) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
        return String(item[k]).trim();
      }
    }
  }

  if (semantic === 'observacion') {
    for (const k of ['OBSERVACION', 'OBSERVACIONES', 'Observacion', 'Observaciones', 'OBS', 'Obs', 'COMENTARIOS', 'NOTAS', 'DETALLE']) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
        return String(item[k]).trim();
      }
    }
  }

  if (semantic === 'n_traspaso') {
    for (const k of ['N_TRASPASO', 'N TRASPASO', 'N_DE_TRASPASO', 'N° TRASPASO', 'TRASPASO', 'FOLIO', 'NUM_TRASPASO', 'NRO_TRASPASO']) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
        return String(item[k]).trim();
      }
    }
  }

  // 2. Try finding via semantic alias engine
  const matchedCol = findColumnBySemantic(candidateKeys, semantic, customAliases);
  if (matchedCol && item[matchedCol] !== undefined && item[matchedCol] !== null) {
    const val = String(item[matchedCol]).trim();
    if (val !== '') return val;
  }

  // 3. Direct regex matches on all item object keys
  for (const key of itemKeys) {
    if (key.startsWith('_')) continue;
    for (const pattern of regexFallbacks) {
      if (pattern.test(key.trim())) {
        const val = item[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }

  return '';
}

export interface RelationalContext {
  allMainItems?: any[];
  products?: any[];
  policies?: any[];
}

export type DraftTableColumnKey = 
  | 'sku' 
  | 'desc' 
  | 'lote' 
  | 'fechaVc' 
  | 'fechaRetiro' 
  | 'cant' 
  | 'status' 
  | 'prov' 
  | 'event' 
  | 'nTraspaso'
  | 'precio';

export interface DraftColumnDefinition {
  key: DraftTableColumnKey;
  label: string;
  defaultVisible: boolean;
}

export const DRAFT_AVAILABLE_COLUMNS: DraftColumnDefinition[] = [
  { key: 'sku', label: 'SKU', defaultVisible: true },
  { key: 'desc', label: 'Descripción', defaultVisible: true },
  { key: 'lote', label: 'Lote', defaultVisible: true },
  { key: 'fechaVc', label: 'F. Vencimiento', defaultVisible: true },
  { key: 'fechaRetiro', label: 'F. Retiro', defaultVisible: true },
  { key: 'cant', label: 'Cantidad', defaultVisible: true },
  { key: 'status', label: 'Estado', defaultVisible: true },
  { key: 'prov', label: 'Proveedor', defaultVisible: false },
  { key: 'event', label: 'Incidencia / Detalle', defaultVisible: true },
  { key: 'nTraspaso', label: 'N° Traspaso', defaultVisible: false },
  { key: 'precio', label: 'Precio / Costo', defaultVisible: false }
];

export function generateItemsHtmlTable(
  items: any[],
  headers: string[] = [],
  customAliases?: Record<string, string[]>,
  relationalContext?: RelationalContext,
  visibleColumnKeys?: DraftTableColumnKey[]
): string {
  if (!items || items.length === 0) {
    return `<p style="color: #64748b; font-style: italic;">(No hay productos seleccionados)</p>`;
  }

  const { allMainItems = [], products = [] } = relationalContext || {};

  // Default visible columns if not provided
  const activeColumns: DraftTableColumnKey[] = visibleColumnKeys && visibleColumnKeys.length > 0
    ? visibleColumnKeys
    : DRAFT_AVAILABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);

  // Process and normalize each item
  const processedData = items.map((item, index) => {
    const itemKeys = Object.keys(item || {}).filter(k => !k.startsWith('_'));
    const candidateKeys = Array.from(new Set([...(headers || []), ...itemKeys]));

    // 1. Extract SKU
    let sku = extractFieldValue(item, candidateKeys, 'sku', customAliases, [
      /^sku$/i, /^c[oó]digo(_|\s)?(art([ií]culo)?|prod(ucto)?)?$/i, /^cod$/i, /^art[ií]culo$/i, /^item$/i, /^frc_n$/i, /^id$/i
    ]);

    // 2. Extract Description
    let desc = extractFieldValue(item, candidateKeys, 'descripcion', customAliases, [
      /^desc(ripci[oó]n)?(_|\s)?(prod(ucto)?|art[ií]culo)?$/i, /^producto$/i, /^nombre(_|\s)?(prod(ucto)?)?$/i, /^detalle$/i
    ]);

    // 3. Extract Lote
    let lote = extractFieldValue(item, candidateKeys, 'lote', customAliases, [
      /^lote$/i, /^batch$/i, /^lot(_|\s)?(no|num)?$/i, /^nro(_|\s)?lote$/i
    ]);

    // 4. Extract Quantity
    let cant = extractFieldValue(item, candidateKeys, 'cantidad', customAliases, [
      /^cant(idad)?$/i, /^stock$/i, /^unidades$/i, /^qty$/i, /^saldo$/i
    ]);

    // 5. Extract Expiry Date
    let fechaVcRaw = extractFieldValue(item, candidateKeys, 'fecha_vc', customAliases, [
      /^f(echa)?(_|\s)?(v(en)?c(imiento)?|vto|cad(ucidad)?)$/i, /^vencimiento$/i, /^caducidad$/i, /^f(_|\.)?vto$/i, /^f(_|\.)?venc$/i
    ]);

    // 6. Extract Retirement Date
    let fechaRetRaw = extractFieldValue(item, candidateKeys, 'fecha_retiro', customAliases, [
      /^f(echa)?(_|\s)?retiro$/i, /^retiro$/i, /^fecha_retiro_calc$/i, /^_virtual_fecha_retiro$/i
    ]);

    // 7. Extract Provider
    let prov = extractFieldValue(item, candidateKeys, 'proveedor', customAliases, [
      /^proveedor$/i, /^laboratorio$/i, /^marca$/i, /^fabricante$/i, /^vendor$/i, /^supplier$/i
    ]);

    // 8. Extract Event / Observation / Traspaso
    const obs = extractFieldValue(item, candidateKeys, 'observacion', customAliases, [
      /^observaci[oó]n(es)?$/i, /^obs$/i, /^comentario(s)?$/i, /^nota(s)?$/i
    ]);

    const eventRaw = extractFieldValue(item, candidateKeys, 'tipo_evento', customAliases, [
      /^frc(_|\s)?even(to)?$/i, /^tipo(_|\s)?evento$/i, /^evento$/i, /^incidencia$/i, /^motivo$/i
    ]);

    const traspaso = extractFieldValue(item, candidateKeys, 'n_traspaso', customAliases, [
      /^n(_|\s)?traspaso$/i, /^nro(_|\s)?traspaso$/i, /^num(_|\s)?traspaso$/i, /^traspaso$/i, /^folio$/i
    ]);

    // 9. Extract Price / Cost
    let precio = extractFieldValue(item, candidateKeys, 'precio', customAliases, [
      /^precio$/i, /^costo$/i, /^val(_|\s)?unit$/i, /^p(_|\.)?unit$/i, /^valor$/i
    ]);

    // Relational Enrichment if any core field was missing
    if (sku) {
      const cleanSku = String(sku).trim().toLowerCase();

      // 1. Look up product in catalog
      if (!desc || !prov || !precio) {
        const prodMatch = products.find(p => {
          const pKeys = Object.keys(p);
          const pSku = extractFieldValue(p, pKeys, 'sku', customAliases) || p['COD PRODUCTO'] || p['C'] || p['Código'] || p['SKU'] || p['sku'];
          return pSku && String(pSku).trim().toLowerCase() === cleanSku;
        });
        if (prodMatch) {
          const pKeys = Object.keys(prodMatch);
          if (!desc) desc = extractFieldValue(prodMatch, pKeys, 'descripcion', customAliases) || prodMatch['DESCRIPCION'] || prodMatch['Nombre'] || prodMatch['PRODUCTO'] || '';
          if (!prov) prov = extractFieldValue(prodMatch, pKeys, 'proveedor', customAliases) || prodMatch['PROVEEDOR'] || prodMatch['RUT PROVEEDOR'] || prodMatch['Marca'] || '';
          if (!precio) precio = extractFieldValue(prodMatch, pKeys, 'precio', customAliases) || prodMatch['PRECIO'] || prodMatch['COSTO'] || '';
        }
      }

      // 2. Look up in allMainItems
      if (!desc || !fechaVcRaw || !lote || !prov || !precio) {
        const mainMatch = allMainItems.find(m => {
          const mKeys = Object.keys(m);
          const mSku = extractFieldValue(m, mKeys, 'sku', customAliases) || m['SKU'] || m['COD PRODUCTO'];
          return mSku && String(mSku).trim().toLowerCase() === cleanSku;
        });
        if (mainMatch) {
          const mKeys = Object.keys(mainMatch);
          if (!desc) desc = extractFieldValue(mainMatch, mKeys, 'descripcion', customAliases) || mainMatch['DESCRIPCION'] || mainMatch['DESCRIPCIÓN'] || mainMatch['Producto'];
          if (!lote) lote = extractFieldValue(mainMatch, mKeys, 'lote', customAliases) || mainMatch['LOTE'] || mainMatch['Lote'];
          if (!fechaVcRaw) fechaVcRaw = extractFieldValue(mainMatch, mKeys, 'fecha_vc', customAliases) || mainMatch['FECHA_VENCIMIENTO'] || mainMatch['FECHA_VC'];
          if (!prov) prov = extractFieldValue(mainMatch, mKeys, 'proveedor', customAliases) || mainMatch['PROVEEDOR'] || mainMatch['Proveedor'];
          if (!fechaRetRaw) fechaRetRaw = extractFieldValue(mainMatch, mKeys, 'fecha_retiro', customAliases) || mainMatch['FECHA_RETIRO'] || mainMatch['FECHA RETIRO'];
          if (!precio) precio = extractFieldValue(mainMatch, mKeys, 'precio', customAliases) || mainMatch['PRECIO'] || mainMatch['COSTO'];
        }
      }
    }

    // 3. Fallback: If still no description but lote exists, look up by lote in allMainItems
    if (!desc && lote && lote !== '-') {
      const cleanLote = String(lote).trim().toLowerCase();
      const matchByLote = allMainItems.find(m => {
        const mKeys = Object.keys(m);
        const mLote = extractFieldValue(m, mKeys, 'lote', customAliases) || m['LOTE'] || m['Lote'] || m['batch'] || m['Batch'];
        return mLote && String(mLote).trim().toLowerCase() === cleanLote;
      });
      if (matchByLote) {
        const mKeys = Object.keys(matchByLote);
        desc = extractFieldValue(matchByLote, mKeys, 'descripcion', customAliases) || matchByLote['DESCRIPCION'] || matchByLote['DESCRIPCIÓN'] || matchByLote['Producto'] || '';
        if (!prov) prov = extractFieldValue(matchByLote, mKeys, 'proveedor', customAliases) || matchByLote['PROVEEDOR'] || matchByLote['Proveedor'] || '';
        if (!sku || sku === '-') sku = extractFieldValue(matchByLote, mKeys, 'sku', customAliases) || matchByLote['SKU'] || matchByLote['sku'] || '';
        if (!fechaVcRaw) fechaVcRaw = extractFieldValue(matchByLote, mKeys, 'fecha_vc', customAliases) || matchByLote['FECHA_VC'] || matchByLote['FECHA_VENCIMIENTO'] || '';
      }
    }

    // 4. Last fallback on the item itself for any description or product column
    if (!desc) {
      for (const k of itemKeys) {
        if (/desc|prod|nom|art|denominaci/i.test(k) && item[k] && typeof item[k] === 'string' && item[k].trim() !== '') {
          desc = item[k].trim();
          break;
        }
      }
    }

    // Date formatting & Retirement date calculation
    let fechaVcFormatted = '-';
    let fechaRetFormatted = '-';

    if (fechaVcRaw) {
      const dVc = parseAnyDate(fechaVcRaw);
      if (dVc) {
        fechaVcFormatted = formatDisplayDate(dVc);

        if (!fechaRetRaw) {
          // If no retirement date provided, compute 30 days before expiration
          const dRet = new Date(dVc);
          dRet.setDate(dRet.getDate() - 30);
          fechaRetFormatted = formatDisplayDate(dRet);
        }
      } else {
        fechaVcFormatted = fechaVcRaw;
      }
    }

    if (fechaRetRaw) {
      const dRet = parseAnyDate(fechaRetRaw);
      fechaRetFormatted = dRet ? formatDisplayDate(dRet) : fechaRetRaw;
    }

    // Status Badges
    const eventCategory = getEventCategory(item, candidateKeys);
    const eventDefinition = EVENT_CATEGORIES[eventCategory];
    const itemStatus = getItemStatus(item, candidateKeys);
    const resolutionStatus = getItemResolutionStatus(item, candidateKeys);

    let statusHtml = '';
    if (eventRaw || traspaso || eventCategory !== 'VENCIMIENTO') {
      // Incident view status
      if (resolutionStatus.isResolved) {
        statusHtml = `<span style="background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 11px; display: inline-block;">Realizado</span>`;
      } else {
        statusHtml = `<span style="background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 11px; display: inline-block;">Pendiente</span>`;
      }
    } else {
      // Expiration view status
      if (itemStatus.code === 'EXPIRED') {
        statusHtml = `<span style="background-color: #fff1f2; color: #be123c; border: 1px solid #fecdd3; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 11px; display: inline-block;">Vencido</span>`;
      } else if (itemStatus.code === 'RETIRE_NOW') {
        statusHtml = `<span style="background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 11px; display: inline-block;">Retirar Ahora</span>`;
      } else if (itemStatus.code === 'UPCOMING') {
        statusHtml = `<span style="background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 11px; display: inline-block;">Próximo Retiro</span>`;
      } else if (itemStatus.code === 'DRAINAGE_PM') {
        statusHtml = `<span style="background-color: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 11px; display: inline-block;">Alerta Drenaje PM</span>`;
      } else {
        statusHtml = `<span style="background-color: #f8fafc; color: #475569; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 11px; display: inline-block;">En Regla</span>`;
      }
    }

    // Incident / Event label
    let eventLabel = eventRaw || (eventDefinition ? eventDefinition.shortLabel : '');
    if (traspaso && !eventLabel.includes(traspaso)) {
      eventLabel = eventLabel ? `${eventLabel} (${traspaso})` : `Traspaso: ${traspaso}`;
    }

    return {
      index,
      sku: sku || '-',
      desc: desc || '-',
      lote: lote || '-',
      cant: cant !== '' ? cant : '-',
      fechaVc: fechaVcFormatted,
      fechaRetiro: fechaRetFormatted,
      prov: prov || '-',
      eventLabel: eventLabel || '',
      obs: obs || '',
      nTraspaso: traspaso || '-',
      precio: precio ? `$${precio}` : '-',
      statusHtml
    };
  });

  // Map of column headers and render functions
  const columnRenderMap: Record<DraftTableColumnKey, { header: string; thAlign?: string; renderCell: (row: typeof processedData[0]) => string }> = {
    sku: {
      header: 'SKU',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-weight: bold; color: #0f172a; white-space: nowrap;">${row.sku}</td>`
    },
    desc: {
      header: 'Descripción',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${row.desc}</td>`
    },
    lote: {
      header: 'Lote',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-family: monospace; color: #475569;">${row.lote}</td>`
    },
    fechaVc: {
      header: 'F. Venc.',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: 600; white-space: nowrap;">${row.fechaVc}</td>`
    },
    fechaRetiro: {
      header: 'F. Retiro',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #d97706; font-weight: 600; white-space: nowrap;">${row.fechaRetiro}</td>`
    },
    cant: {
      header: 'Cant.',
      thAlign: 'center',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #0284c7;">${row.cant}</td>`
    },
    status: {
      header: 'Estado',
      thAlign: 'center',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">${row.statusHtml}</td>`
    },
    prov: {
      header: 'Proveedor',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #475569;">${row.prov}</td>`
    },
    event: {
      header: 'Incidencia / Detalle',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px;">
        ${row.eventLabel ? `<strong style="color: #334155;">${row.eventLabel}</strong>` : ''}
        ${row.eventLabel && row.obs ? `<br/>` : ''}
        ${row.obs ? `<span style="color: #64748b; font-style: italic;">${row.obs}</span>` : ''}
        ${!row.eventLabel && !row.obs ? '-' : ''}
      </td>`
    },
    nTraspaso: {
      header: 'N° Traspaso',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-family: monospace; color: #475569;">${row.nTraspaso}</td>`
    },
    precio: {
      header: 'Precio/Costo',
      thAlign: 'right',
      renderCell: (row) => `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #16a34a;">${row.precio}</td>`
    }
  };

  // Filter columns according to active selection
  const selectedDefs = activeColumns
    .filter(k => columnRenderMap[k])
    .map(k => ({ key: k, ...columnRenderMap[k] }));

  // Build the table rows
  let tableRows = '';
  processedData.forEach((row, index) => {
    const bgClass = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    const cells = selectedDefs.map(col => col.renderCell(row)).join('');
    tableRows += `
      <tr style="background-color: ${bgClass}; font-size: 13px; color: #334155;">
        ${cells}
      </tr>
    `;
  });

  // Build the table headers
  const headerThs = selectedDefs.map(col => {
    const align = col.thAlign ? `text-align: ${col.thAlign};` : 'text-align: left;';
    return `<th style="padding: 12px; border: 1px solid #1e293b; ${align}">${col.header}</th>`;
  }).join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          ${headerThs}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;
}
