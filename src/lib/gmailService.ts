import { findColumnBySemantic } from '../utils/columnAliases';
import { formatDisplayDate } from '../utils/dateCalculations';

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

export function generateItemsHtmlTable(
  items: any[],
  headers: string[],
  customAliases?: Record<string, string[]>
): string {
  const skuCol = findColumnBySemantic(headers, 'sku', customAliases) || 'SKU';
  const descCol = findColumnBySemantic(headers, 'descripcion', customAliases) || 'DESCRIPCION';
  const vcCol = findColumnBySemantic(headers, 'fecha_vc', customAliases) || 'FECHA_VC';
  const retCol = findColumnBySemantic(headers, 'fecha_retiro', customAliases) || 'FECHA_RETIRO';
  const cantCol = findColumnBySemantic(headers, 'cantidad', customAliases) || 'CANTIDAD';
  const loteCol = findColumnBySemantic(headers, 'lote', customAliases) || 'LOTE';
  const provCol = findColumnBySemantic(headers, 'proveedor', customAliases) || 'PROVEEDOR';
  const obsCol = findColumnBySemantic(headers, 'observacion', customAliases) || 'OBSERVACION';
  const eventCol = findColumnBySemantic(headers, 'tipo_evento', customAliases) || 'TIPO_EVENTO';

  let tableRows = '';

  items.forEach((item, index) => {
    const sku = item[skuCol] || '-';
    const desc = item[descCol] || '-';
    const vc = item[vcCol] ? formatDisplayDate(item[vcCol]) : '-';
    const ret = item[retCol] ? formatDisplayDate(item[retCol]) : '-';
    const cant = item[cantCol] !== undefined && item[cantCol] !== null ? item[cantCol] : '-';
    const lote = item[loteCol] || '-';
    const prov = item[provCol] || '';
    const obs = item[obsCol] || item[eventCol] || '';

    const bgClass = index % 2 === 0 ? '#ffffff' : '#f8fafc';

    tableRows += `
      <tr style="background-color: ${bgClass}; font-size: 13px; color: #334155;">
        <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #1e293b;">${sku}</td>
        <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: 600;">${desc}</td>
        <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${lote}</td>
        <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: 600;">${vc}</td>
        <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #d97706;">${ret}</td>
        <td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #0284c7;">${cant}</td>
        ${prov ? `<td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${prov}</td>` : ''}
        ${obs ? `<td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-style: italic; color: #64748b;">${obs}</td>` : ''}
      </tr>
    `;
  });

  const hasProv = items.some(i => i[provCol]);
  const hasObs = items.some(i => i[obsCol] || i[eventCol]);

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">
          <th style="padding: 12px; border: 1px solid #0f172a;">SKU</th>
          <th style="padding: 12px; border: 1px solid #0f172a;">Descripción</th>
          <th style="padding: 12px; border: 1px solid #0f172a;">Lote</th>
          <th style="padding: 12px; border: 1px solid #0f172a;">F. Venc.</th>
          <th style="padding: 12px; border: 1px solid #0f172a;">F. Retiro</th>
          <th style="padding: 12px; border: 1px solid #0f172a; text-align: center;">Cant.</th>
          ${hasProv ? `<th style="padding: 12px; border: 1px solid #0f172a;">Proveedor</th>` : ''}
          ${hasObs ? `<th style="padding: 12px; border: 1px solid #0f172a;">Detalle / Incidencia</th>` : ''}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;
}
