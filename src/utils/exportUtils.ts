import * as XLSX from 'xlsx';
import { formatDisplayDate } from './pureCalculations';
import { calculateVirtualColumnValue } from './virtualColumns';

/**
 * Universal, clean Excel exporter with automatic column width calculation
 * and sanitized formatting for dates and numbers.
 */
export function exportToExcel(
  filename: string, 
  headers: string[], 
  items: any[], 
  sheetName = 'Inventario',
  virtualColumns?: any[],
  allData?: any
) {
  if (!items || !items.length) return;

  // Enhance items with virtual column data
  const enhancedItems = items.map(item => {
    const newItem = { ...item };
    if (virtualColumns) {
      virtualColumns.forEach(vc => {
        newItem[vc.label] = calculateVirtualColumnValue(vc, item, headers, allData);
      });
    }
    return newItem;
  });

  const allHeaders = [...headers, ...(virtualColumns?.map(vc => vc.label) || [])];

  // Format headers and rows
  const worksheetData = [
    allHeaders,
    ...enhancedItems.map(item => allHeaders.map(header => {
      const val = item[header];
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return formatDisplayDate(val);
      return val;
    }))
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-calculate column widths
  const colWidths = allHeaders.map((header, colIndex) => {
    let maxLen = header.length;
    for (let rowIndex = 1; rowIndex < worksheetData.length; rowIndex++) {
      const cellVal = String(worksheetData[rowIndex][colIndex] || '');
      if (cellVal.length > maxLen) {
        maxLen = cellVal.length;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 60) };
  });

  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename);
}

/**
 * Export array of items to tab-separated TSV clipboard string
 */
export function copyItemsToClipboardTSV(headers: string[], items: any[]): boolean {
  if (!items || !items.length) return false;

  const headerRow = headers.join('\t');
  const dataRows = items.map(item =>
    headers.map(h => {
      const val = item[h];
      if (val === null || val === undefined) return '';
      return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
    }).join('\t')
  );

  const fullText = [headerRow, ...dataRows].join('\n');
  navigator.clipboard.writeText(fullText);
  return true;
}
