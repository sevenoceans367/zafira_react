import { isDbConfigured } from '../config.js';
import {
  dbGetCombinedSoaPayableCreatorAccess,
  dbListCombinedSoaPayable,
  mapCombinedSoaPayableStatus,
} from './combinedSoaPayableDb.js';

const MOCK_ROWS = {
  vc: [
    {
      index: 1,
      soaId: 1001,
      soaNo: 'SOA-P-26001',
      soaDate: '10-01-2026',
      vendor: 'Global Charter (GC02)',
      soaAmount: '125000.00',
      creator: 'Ops User',
      statusCode: 1,
      statusLabel: 'Level 1 Approval Pending',
      statusTone: 'warning',
      editHref: 'updatecombinedpayablesoa.php?id=1001',
    },
    {
      index: 2,
      soaId: 1002,
      soaNo: 'SOA-P-26002',
      soaDate: '15-01-2026',
      vendor: 'Seven Oceans (SO01)',
      soaAmount: '84500.50',
      creator: 'Finance Lead',
      statusCode: 6,
      statusLabel: 'Paid',
      statusTone: 'success',
      editHref: 'updatecombinedpayablesoa.php?id=1002',
    },
  ],
  tc: [
    {
      index: 1,
      soaId: 2001,
      soaNo: 'SOA-TC-26001',
      soaDate: '12-01-2026',
      vendor: 'Owner Services (OS01)',
      soaAmount: '98000.00',
      creator: 'Ops User',
      statusCode: 1,
      statusLabel: 'Level 1 Approval Pending',
      statusTone: 'warning',
      editHref: 'updatecombinedpayablesoa_tc.php?id=2001',
    },
    {
      index: 2,
      soaId: 2002,
      soaNo: 'SOA-TC-26002',
      soaDate: '18-01-2026',
      vendor: 'Seven Oceans (SO01)',
      soaAmount: '45250.75',
      creator: 'Finance Lead',
      statusCode: 5,
      statusLabel: 'Pending for Payment',
      statusTone: 'danger',
      editHref: 'updatecombinedpayablesoa_tc.php?id=2002',
    },
  ],
};

function filterMockRows(params = {}) {
  const variant = params.variant === 'tc' ? 'tc' : 'vc';
  const search = String(params.search || '').toLowerCase();
  let rows = [...(MOCK_ROWS[variant] || MOCK_ROWS.vc)];
  if (search) {
    rows = rows.filter((row) => [
      row.soaNo,
      row.soaDate,
      row.vendor,
      row.soaAmount,
      row.creator,
      row.statusLabel,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(params.pageSize) || 50));
  const start = (page - 1) * pageSize;
  return {
    records: rows.slice(start, start + pageSize).map((row, index) => ({
      ...row,
      index: start + index + 1,
    })),
    recordsTotal: rows.length,
    page,
    pageSize,
  };
}

export async function listCombinedSoaPayable(params = {}) {
  const variant = params.variant === 'tc' ? 'tc' : 'vc';
  if (isDbConfigured()) {
    const data = await dbListCombinedSoaPayable({ ...params, variant });
    const canCreate = await dbGetCombinedSoaPayableCreatorAccess(params.userId);
    return { ...data, canCreate, variant };
  }

  return {
    ...filterMockRows({ ...params, variant }),
    canCreate: true,
    variant,
  };
}

export async function listCombinedSoaPayableTc(params = {}) {
  return listCombinedSoaPayable({ ...params, variant: 'tc' });
}

export { mapCombinedSoaPayableStatus };
