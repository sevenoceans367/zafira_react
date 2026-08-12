import { isDbConfigured } from '../config.js';
import { dbGetPaymentGridVc } from './paymentGridVcDb.js';

const MOCK_GRID = {
  comId: '2001',
  fcaId: '3001',
  voyageNo: 'V25001',
  message: 'NOM-001',
  vesselName: 'KALYMNOS DAWN',
  sections: [
    {
      key: 'freight',
      periodLabel: 'Freight Details',
      columns: { showPayments: false, showVoyageId: false },
      lines: [
        {
          key: 'freight-1',
          name: 'Final Nett Freight (WHEAT)',
          vendorId: 'CH001',
          vendorName: 'Ocean Charterers',
          actions: [
            {
              key: 'initialInvoice',
              label: 'Initial Invoice',
              variant: 'warning',
              enabled: true,
              migrated: true,
              href: '/internal-user/vc/ops/freight-invoice?id=2001%2C3001%2CCH001%2C100000.00%2C0%2C10000%2C1%2C0%2C0%2C1%2C1&name=Final%20Nett%20Freight%20(WHEAT)&page=1&invType=Interim&voyageNo=V25001',
            },
            {
              key: 'finalInvoice',
              label: 'Final Invoice',
              variant: 'info',
              enabled: true,
              migrated: true,
              href: '/internal-user/vc/ops/freight-invoice?id=2001%2C3001%2CCH001%2C100000.00%2C0%2C10000%2C1%2C0%2C0%2C1%2C1&name=Final%20Nett%20Freight%20(WHEAT)&page=1&invType=Final&voyageNo=V25001',
            },
          ],
          badges: [],
        },
      ],
    },
    {
      key: 'demurrage',
      periodLabel: 'Demurrage Dispatch Ship Owner',
      columns: { showPayments: false, showVoyageId: false },
      lines: [
        {
          key: 'dem-lp',
          name: 'Load Port ROTTERDAM',
          vendorId: 'CH001',
          vendorName: 'Ocean Charterers',
          actions: [
            {
              key: 'demurrageInvoice',
              label: 'Invoice',
              variant: 'info',
              enabled: true,
              migrated: true,
              href: '/internal-user/vc/ops/other-invoice?id=2001%2C3001%2CCH001%2C5000%2CDemurrage%2FDispatch%28LP%29&name=Demurrage%2FDispatch%20Invoice%20for%20Load%20Port%20ROTTERDAM&page=1&amountTitle=Load%20Port%20ROTTERDAM&portType=LP&randomId=1&portId=1&voyageNo=V25001',
            },
          ],
          badges: [],
        },
      ],
    },
    {
      key: 'other-income',
      periodLabel: 'Other Income',
      columns: { showPayments: false, showVoyageId: false },
      lines: [],
    },
    {
      key: 'bunkers',
      periodLabel: 'Bunkers Nett Supply',
      columns: { showPayments: true, showVoyageId: true },
      lines: [
        {
          key: 'bunker-1',
          name: 'VLSFO Nett',
          vendorId: 'BK001',
          vendorName: 'Bunker Supplier',
          totalPaid: '12000',
          lastPaidDate: '05-01-2026',
          voyageId: 'V25001',
          actions: [
            {
              key: 'bunkerPayment',
              label: 'Payment',
              variant: 'warning',
              enabled: true,
              migrated: true,
              href: '/internal-user/vc/ops/request-port-cost?id=2%2CBunkers%20Nett%20Supply%2CG001%2CBK001%2C2001%2C12000&name=VLSFO%20Nett&page=1&voyageNo=V25001',
            },
          ],
          badges: [],
        },
      ],
    },
    {
      key: 'ops-costs',
      periodLabel: 'Operational Costs (Others)',
      columns: { showPayments: true, showVoyageId: true },
      lines: [
        {
          key: 'broker-1',
          name: 'Brokerage Commission (%)',
          vendorId: 'BR001',
          vendorName: 'Broker Co',
          totalPaid: '3125',
          lastPaidDate: '12-01-2026',
          voyageId: 'V25001',
          actions: [
            {
              key: 'brokerPayment',
              label: 'Payment',
              variant: 'warning',
              enabled: true,
              migrated: true,
              href: '/internal-user/vc/ops/request-port-cost?id=3%2COperational%20Costs%20(Others)%2C0%2CBR001%2C1%2C3125&name=Brokerage%20Commission&page=1&voyageNo=V25001',
            },
          ],
          badges: [],
        },
      ],
    },
    {
      key: 'port-costs',
      periodLabel: 'Port Costs',
      columns: { showPayments: true, showVoyageId: true },
      lines: [
        {
          key: 'port-lp',
          name: 'Load Port ROTTERDAM',
          vendorId: 'AG001',
          vendorName: 'Port Agent',
          totalPaid: '',
          lastPaidDate: '',
          voyageId: '',
          actions: [
            {
              key: 'portPayment',
              label: 'Payment',
              variant: 'warning',
              enabled: true,
              migrated: true,
              href: '/internal-user/vc/ops/request-port-cost?id=5%2CLoad%20Port%20Costs%2CP001%2CAG001%2C2001%2C0%2CLoad%2C1&name=Load%20Port%20%20ROTTERDAM&page=1&voyageNo=V25001',
            },
          ],
          badges: [],
        },
      ],
    },
    {
      key: 'hireage',
      periodLabel: 'Hireage',
      columns: { showPayments: true, showVoyageId: false },
      lines: [
        {
          key: 'hire',
          name: 'Hire',
          vendorId: 'OWN1',
          vendorName: 'Ocean Owners',
          totalPaid: '',
          lastPaidDate: '',
          actions: [
            {
              key: 'hireStatement',
              label: 'Hire Statement',
              variant: 'danger',
              enabled: true,
              migrated: true,
              href: '/internal-user/vc/ops/hire-statement?comId=2001&page=1&voyageNo=V25001',
            },
          ],
          badges: [],
        },
        {
          key: 'owners-broker',
          name: 'Owners Side brokerage',
          vendorId: 'BR002',
          vendorName: 'Owners Broker',
          totalPaid: '',
          lastPaidDate: '',
          actions: [
            {
              key: 'ownersBrokerPayment',
              label: 'Payment',
              variant: 'warning',
              enabled: true,
              migrated: true,
              href: '/internal-user/vc/ops/request-port-cost?id=13%2COwners%20Side%20brokerage%2C1771%2CBR002%2C2001%2C0&name=Owners%20Side%20brokerage&page=1&voyageNo=V25001',
            },
          ],
          badges: [],
          highlight: true,
        },
      ],
    },
  ],
};

export async function getPaymentGridVc(comId, options = {}) {
  if (isDbConfigured()) return dbGetPaymentGridVc(comId, options);
  if (String(comId) !== String(MOCK_GRID.comId)) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
  }
  const page = String(options.page || '1');
  const voyageNo = String(options.voyageNo || MOCK_GRID.voyageNo || '');
  const mock = structuredClone(MOCK_GRID);
  for (const section of mock.sections || []) {
    for (const row of section.lines || []) {
      row.actions = (row.actions || []).map((item) => {
        if (item.key !== 'initialInvoice' && item.key !== 'finalInvoice') return item;
        const invType = item.key === 'initialInvoice' ? 'Interim' : 'Final';
        const params = new URLSearchParams({
          id: `${mock.comId},${mock.fcaId},${row.vendorId || 'CH001'},0,0,0,0,0,0`,
          name: row.name || 'Final Nett Freight',
          page,
          invType,
        });
        if (voyageNo) params.set('voyageNo', voyageNo);
        return {
          ...item,
          migrated: true,
          href: `/internal-user/vc/ops/freight-invoice?${params.toString()}`,
        };
      });
    }
  }
  return mock;
}
