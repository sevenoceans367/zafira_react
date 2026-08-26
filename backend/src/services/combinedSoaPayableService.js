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

const MOCK_VENDORS = [
  { id: 'GC02', name: 'Global Charter (GC02)' },
  { id: 'SO01', name: 'Seven Oceans (SO01)' },
  { id: 'OS01', name: 'Owner Services (OS01)' },
  { id: 'WRI', name: 'WRI LTD' },
  { id: 'CM01', name: 'CHINA MARINE SHIPPING AGENCY JIANGSU CO.,LTD' },
];

const MOCK_CURRENCIES = [
  { id: 'USD', name: 'United States Dollar' },
  { id: 'EUR', name: 'Euro' },
  { id: 'SGD', name: 'Singapore Dollar' },
  { id: 'INR', name: 'Indian Rupee' },
];

let mockNextId = 3000;

export async function getGroupPaymentLookups() {
  if (isDbConfigured()) {
    // Vendor/currency lists for create still come from Generic Finances lookups on the client
    // when DB is live; return empty here so the React form can fall back gracefully.
    return { vendors: [], currencies: MOCK_CURRENCIES, canCreate: true };
  }
  return {
    vendors: MOCK_VENDORS,
    currencies: MOCK_CURRENCIES,
    canCreate: true,
  };
}

export async function createGroupPayment(params = {}) {
  const variant = params.contractType === 'tc' ? 'tc' : 'vc';
  const vendorId = String(params.selVendor || '').trim();
  if (!vendorId) {
    const error = new Error('Vendor is required.');
    error.status = 400;
    throw error;
  }
  if (!String(params.txtPaymentDate || '').trim()) {
    const error = new Error('Payment/SOA Date is required.');
    error.status = 400;
    throw error;
  }
  if (!String(params.selBankingDetails || '').trim()) {
    const error = new Error('Banking Details are required.');
    error.status = 400;
    throw error;
  }

  if (isDbConfigured()) {
    const error = new Error(
      variant === 'tc'
        ? 'Creating TC group payments against the live database is not wired yet.'
        : 'Creating group payments against the live database is not wired yet.',
    );
    error.status = 501;
    throw error;
  }

  const vendor = MOCK_VENDORS.find((row) => String(row.id) === vendorId);
  const lines = Array.isArray(params.lines) ? params.lines : [];
  if (!lines.length) {
    const error = new Error('Please select at least one cost line.');
    error.status = 400;
    throw error;
  }
  const amount = lines.reduce((sum, line) => sum + (Number(String(line.actual || '').replace(/,/g, '')) || 0), 0);
  const voyageNumbers = lines.map((line) => line.voyageNo).filter(Boolean).join(', ') || '—';
  const year = String(params.selYear || new Date().getFullYear());
  const soaId = mockNextId++;
  const prefix = variant === 'tc' ? 'SOA-TC' : 'SOA';
  const row = {
    index: 1,
    soaId,
    soaNo: `${prefix}-${String(soaId).padStart(4, '0')}-${year}`,
    soaDate: params.txtPaymentDate || '—',
    vendor: vendor?.name || vendorId,
    soaAmount: amount.toFixed(2),
    creator: 'Ops User',
    statusCode: 1,
    statusLabel: 'Level 1 Approval Pending',
    statusTone: 'warning',
    editHref: variant === 'tc'
      ? `updatecombinedpayablesoa_tc.php?id=${soaId}`
      : `updatecombinedpayablesoa.php?id=${soaId}`,
    voyageNumbers,
  };

  MOCK_ROWS[variant] = [row, ...(MOCK_ROWS[variant] || [])];
  return {
    id: soaId,
    soaNo: row.soaNo,
    variant,
    message: variant === 'tc' ? 'TC group payment created.' : 'Group payment created.',
  };
}

export async function createGroupPaymentTc(params = {}) {
  return createGroupPayment({ ...params, contractType: 'tc' });
}

/** Mock cost lines — mirrors options.php id=111 (Spot) / id=114 (TC). */
export async function listGroupPaymentCostLines(params = {}) {
  const contractType = params.contractType === 'tc' ? 'tc' : 'spot';
  const vendorId = String(params.selVendor || '').trim();
  if (!vendorId) {
    return { records: [], banking: [] };
  }

  if (isDbConfigured()) {
    return { records: [], banking: [], message: 'Live cost-line lookup is not wired yet.' };
  }

  const vendor = MOCK_VENDORS.find((row) => String(row.id) === vendorId);
  const vendorName = vendor?.name || vendorId;
  const year = String(params.selYear || new Date().getFullYear());

  const banking = [
    {
      id: `${vendorId}-BANK-1`,
      name: `${vendorName} — ****${String(vendorId).slice(-4) || '0001'}`,
      address: '1 Harbour Front, Singapore',
      accountNo: '1234567890',
      bank: 'Demo International Bank',
      bankAddress: 'Singapore',
      swiftCode: 'DEMO SG SG',
      ibanNo: 'SG00DEMO0001234567890',
    },
  ];

  if (contractType === 'tc') {
    return {
      records: [
        {
          id: `${vendorId}-tc-1`,
          voyageNo: 'TCV260004',
          vessel: 'PACIFIC STAR',
          costDesc: 'TC Hire Period',
          costType: 'Hire',
          estimated: '18500.00',
          selected: false,
        },
        {
          id: `${vendorId}-tc-2`,
          voyageNo: 'TCV260007',
          vessel: 'OCEAN PEARL',
          costDesc: 'Owners Expenses',
          costType: 'Owners Expenses',
          estimated: '2100.00',
          selected: false,
        },
        {
          id: `${vendorId}-tc-3`,
          voyageNo: 'TCV260009',
          vessel: 'OCEAN PEARL',
          costDesc: 'Off Hire Adjustment',
          costType: 'Off Hire',
          estimated: '980.00',
          selected: false,
        },
      ],
      banking,
      contractType,
    };
  }

  return {
    records: [
      {
        id: `${vendorId}-spot-1`,
        voyageNo: `U${String(year).slice(2)}0043`,
        vessel: 'ATLANTIC WAVE',
        costDesc: 'IFO380 Nett',
        costType: 'Bunkers Nett Supply',
        estimated: '12500.00',
        selected: false,
      },
      {
        id: `${vendorId}-spot-2`,
        voyageNo: `U${String(year).slice(2)}0051`,
        vessel: 'ATLANTIC WAVE',
        costDesc: 'Brokerage Commission',
        costType: 'Operational Costs (Others)',
        estimated: '3200.50',
        selected: false,
      },
      {
        id: `${vendorId}-spot-3`,
        voyageNo: `S${String(year).slice(2)}0068`,
        vessel: 'NORTH STAR',
        costDesc: 'Singapore',
        costType: 'Load Port Costs',
        estimated: '4500.00',
        selected: false,
      },
      {
        id: `${vendorId}-spot-4`,
        voyageNo: `S${String(year).slice(2)}0071`,
        vessel: 'NORTH STAR',
        costDesc: 'OSB',
        costType: 'Owners Side brokerage',
        estimated: '1800.00',
        selected: false,
      },
    ],
    banking,
    contractType,
    year,
  };
}

export { mapCombinedSoaPayableStatus };
