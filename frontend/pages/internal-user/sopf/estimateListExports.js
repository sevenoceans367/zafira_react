const CSV_COLUMNS = [
  { key: 'rowNum', label: 'Item' },
  { key: 'vesselName', label: 'Vessel' },
  { key: 'voyageNo', label: 'Voyage No' },
  { key: 'cpDate', label: 'CP Date' },
  { key: 'dwt', label: 'DWT' },
  { key: 'lpDp', label: 'LP - DP' },
  { key: 'duration', label: 'Voy Days' },
  { key: 'cargoQuantity', label: 'Cargo' },
  { key: 'tce', label: 'TCE' },
];

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvDisplay(value, pendingEmpty = false) {
  if (pendingEmpty) {
    const text = String(value ?? '').trim();
    return text === '' ? 'pending' : text;
  }
  return value;
}

export function downloadEstimateListCsv(rows, filename = 'vc-out-estimates.csv', { performing = false } = {}) {
  const columns = performing
    ? [
      ...CSV_COLUMNS,
      { key: 'profitLoss', label: 'Fixed P&L' },
      { key: 'liveProfitLoss', label: 'Live P&L' },
    ]
    : [
      ...CSV_COLUMNS,
      { key: 'profitLoss', label: 'Fixed P&L' },
    ];
  const header = columns.map((column) => escapeCsvValue(column.label)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(
      csvDisplay(row[column.key], performing && column.key === 'liveProfitLoss'),
    )).join(','),
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
