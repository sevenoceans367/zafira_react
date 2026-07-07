const CSV_COLUMNS = [
  { key: 'rowNum', label: '#' },
  { key: 'vesselDisplay', label: 'Vessel Name/Type' },
  { key: 'businessType', label: 'Business Type' },
  { key: 'cpDate', label: 'CP Date' },
  { key: 'dwt', label: 'DWT' },
  { key: 'lpDp', label: 'LP/DP' },
  { key: 'duration', label: 'Duration' },
  { key: 'cargoQuantity', label: 'Cargo Quantity' },
  { key: 'tce', label: 'TCE' },
  { key: 'profitLoss', label: 'P/L' },
];

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadEstimateListCsv(rows, filename = 'vc-out-estimates.csv') {
  const header = CSV_COLUMNS.map((column) => escapeCsvValue(column.label)).join(',');
  const body = rows.map((row) =>
    CSV_COLUMNS.map((column) => escapeCsvValue(row[column.key])).join(','),
  );
  const csv = [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function buildEstimateListPdfUrl({ estimateType, businessType }) {
  const params = new URLSearchParams();
  if (estimateType) params.set('estimatetype', String(estimateType));
  if (businessType) params.set('selBType', businessType);
  const query = params.toString();
  return `/api/internal-user/sopf/estimate_list/export/pdf${query ? `?${query}` : ''}`;
}

export function buildEstimateListEmailUrl({ estimateType, businessType }) {
  const params = new URLSearchParams();
  if (estimateType) params.set('estimatetype', String(estimateType));
  if (businessType) params.set('selBType', businessType);
  const query = params.toString();
  return `/api/internal-user/sopf/estimate_list/export/email${query ? `?${query}` : ''}`;
}
