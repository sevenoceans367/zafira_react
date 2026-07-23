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
            { key: 'initialInvoice', label: 'Initial Invoice', variant: 'warning', enabled: true, migrated: false },
            { key: 'finalInvoice', label: 'Final Invoice', variant: 'info', enabled: true, migrated: false },
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
            { key: 'demurrageInvoice', label: 'Invoice', variant: 'info', enabled: true, migrated: false },
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
            { key: 'bunkerPayment', label: 'Payment', variant: 'warning', enabled: true, migrated: false },
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
            { key: 'brokerPayment', label: 'Payment', variant: 'warning', enabled: true, migrated: false },
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
            { key: 'portPayment', label: 'Payment', variant: 'warning', enabled: true, migrated: false },
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
            { key: 'hireStatement', label: 'Hire Statement', variant: 'danger', enabled: true, migrated: false },
          ],
          badges: [],
        },
        {
          key: 'owners-broker',
          name: 'Owners Side brokerage',
          vendorId: '',
          vendorName: '',
          totalPaid: '',
          lastPaidDate: '',
          actions: [],
          badges: [],
          highlight: true,
        },
      ],
    },
  ],
};

export async function getPaymentGridVc(comId) {
  if (isDbConfigured()) return dbGetPaymentGridVc(comId);
  if (String(comId) !== String(MOCK_GRID.comId)) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
  }
  return structuredClone(MOCK_GRID);
}
