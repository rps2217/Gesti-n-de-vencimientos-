export function exportToCSV(filename: string, headers: string[], items: any[], delimiter = ',') {
  if (!items || !items.length) return;

  const csvRows: string[] = [];
  
  // Format cell value escaping quotes and newlines
  const formatCell = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Create headers row
  csvRows.push(headers.map(h => formatCell(h)).join(delimiter));

  // Create data rows
  for (const item of items) {
    const row = headers.map(header => formatCell(item[header]));
    csvRows.push(row.join(delimiter));
  }

  const csvContent = csvRows.join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel compatibility
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.endsWith('.csv') ? filename : `${filename}.csv`}`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Prevent memory leak by revoking the Blob URL after download trigger
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
