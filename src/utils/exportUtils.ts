import * as XLSX from 'xlsx';

export function exportToExcel(filename: string, headers: string[], items: any[]) {
  if (!items || !items.length) return;

  // Format data array: each row is an array of values mapping to the headers
  const worksheetData = [
    headers,
    ...items.map(item => headers.map(header => {
      const val = item[header];
      return val === null || val === undefined ? '' : val;
    }))
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');

  // Generate Excel file and trigger download
  XLSX.writeFile(workbook, `${filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`}`);
}
