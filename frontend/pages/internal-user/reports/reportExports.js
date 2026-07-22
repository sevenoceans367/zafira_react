/**
 * Client Excel (.xls SpreadsheetML) + server PDF helpers for report tables.
 */

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function parseFilenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

/** Filter table rows by free-text search across visible columns. */
export function filterReportRows(rows, columns, search) {
  const query = String(search || '').trim().toLowerCase();
  if (!query) return rows;
  return (rows || []).filter((row) => (
    (columns || []).some((col) => {
      if (col.action) return false;
      return String(row?.[col.key] ?? '').toLowerCase().includes(query);
    })
  ));
}

/**
 * Download Excel-compatible SpreadsheetML (.xls) — opens in Excel like PHP exports.
 */
export function downloadReportExcel(filename, columns, rows) {
  const dataCols = (columns || []).filter((col) => !col.action);
  const headerCells = dataCols
    .map((col) => `<Cell><Data ss:Type="String">${escapeXml(col.label)}</Data></Cell>`)
    .join('');
  const bodyRows = (rows || []).map((row) => {
    const cells = dataCols.map((col) => {
      const raw = row?.[col.key];
      const text = raw == null || raw === '' ? '' : String(raw);
      const asNumber = text !== '' && /^-?\d+(\.\d+)?$/.test(text);
      return `<Cell><Data ss:Type="${asNumber ? 'Number' : 'String'}">${escapeXml(text)}</Data></Cell>`;
    }).join('');
    return `<Row>${cells}</Row>`;
  }).join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Report">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const safeName = String(filename || 'report').replace(/\.csv$/i, '').replace(/\.xlsx?$/i, '');
  downloadBlob(
    `${safeName}.xls`,
    new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
  );
}

/**
 * Download PDF via Node PDFKit endpoint (same pattern as Sensitivity Analysis).
 */
export async function downloadReportPdf({ title, filename, columns, rows }) {
  const dataCols = (columns || []).filter((col) => !col.action);
  const response = await fetch('/api/internal-user/reports/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: title || 'Report',
      filename: filename || 'report',
      columns: dataCols.map((col) => ({ key: col.key, label: col.label })),
      rows: rows || [],
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to generate PDF.');
  }

  const blob = await response.blob();
  const resolvedName = parseFilenameFromDisposition(
    response.headers.get('Content-Disposition'),
    `${String(filename || 'report').replace(/\.pdf$/i, '')}.pdf`,
  );
  downloadBlob(resolvedName, blob);
}
