export const EXPORT_FIELDS = [
  { key: 'date', label: 'Date' },
  { key: 'vessel', label: 'Vessel' },
  { key: 'voyageNo', label: 'Voyage No' },
  { key: 'formName', label: 'TXN' },
  { key: 'invoiceNo', label: 'TXN No.' },
  { key: 'statement', label: 'Statement' },
  { key: 'amountLabel', label: 'Amount' },
  { key: 'moneyTypeLabel', label: 'Type' },
  { key: 'holdBy', label: 'PIC' },
  { key: 'vendor', label: 'Customer' },
  { key: 'statusShort', label: 'Status' },
  { key: 'alRem', label: 'Accruals' },
];

export function deriveMoneyType(row) {
  const pay = String(row?.payType || '').toLowerCase();
  if (pay === 'receivable') return 'receivable';
  if (pay === 'payable') return 'payable';
  const hay = `${row?.identify || ''} ${row?.formName || ''}`.toLowerCase();
  if (hay.includes('invoice') || hay.includes('freight payment') || hay.includes('laytime')) {
    return 'receivable';
  }
  return 'payable';
}

export function deriveVoyType(row) {
  const hay = `${row?.identify || ''} ${row?.formName || ''} ${row?.voyageNo || ''}`.toLowerCase();
  if (hay.includes('tc') || String(row?.voyageNo || '').startsWith('T')) return 'TC';
  if (hay.includes('coa') || hay.includes('generic')) return 'Other';
  return 'Voy';
}

export function deriveStatement(row) {
  const invoiceType = String(row?.invoiceType || '').trim();
  if (invoiceType) {
    return invoiceType.replace(/\b\w/g, (char) => char.toUpperCase());
  }
  const hay = String(row?.formName || '');
  const match = hay.match(/\b(accrual|interim|final|pfhs)\b/i);
  return match ? match[1].replace(/\b\w/g, (char) => char.toUpperCase()) : '';
}

export function deriveDesk(voyageNo) {
  const value = String(voyageNo || '');
  if (value.startsWith('S') || value.startsWith('TS')) return 'Singapore';
  if (value.startsWith('U') || value.startsWith('TU')) return 'Dubai';
  return '';
}

export function formatDisplayDate(value) {
  if (!value) return '—';
  return String(value).replace(/-/g, '/');
}

export function formatMoney(value) {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  const abs = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `($${abs})` : `$${abs}`;
}

export function shortStatus(row) {
  const code = Number(row?.statusCode);
  const daysMatch = String(row?.statusLabel || '').match(/(\d+)\s*Days/i);
  const days = daysMatch ? Number(daysMatch[1]) : null;
  const withDays = (label) => (days != null ? `${label} · ${days}d` : label);
  if (code === 0) return { cls: 'draft', label: 'Draft' };
  if (code === 1 || code === 3) return { cls: 'approval', label: withDays('Approval Pending') };
  return { cls: 'pending', label: withDays('Pending') };
}

export function enrichTodoRow(row) {
  const moneyType = row?.moneyType || deriveMoneyType(row);
  const statement = row?.statement || deriveStatement(row);
  const status = shortStatus(row);
  const amount = row?.amount;
  return {
    ...row,
    moneyType,
    moneyTypeLabel: moneyType === 'receivable' ? 'Receivable' : 'Payable',
    statement: statement || '—',
    voyType: row?.voyType || deriveVoyType(row),
    cargoClass: row?.cargoClass || '',
    desk: row?.desk || deriveDesk(row?.voyageNo),
    statusShort: status.label,
    statusBox: status.cls,
    amount,
    amountLabel: formatMoney(amount),
    displayDate: formatDisplayDate(row?.date),
  };
}
