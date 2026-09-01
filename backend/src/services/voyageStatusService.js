import { isDbConfigured } from '../config.js';
import { dbGetVoyageStatus } from './voyageStatusDb.js';

const MOCK_VOYAGE_STATUS = {
  identifiers: {
    vesselName: 'ATLANTIC STAR',
    voyage: 'V-2401 / 26-001',
    cpDate: '15-01-2026',
    charterer: 'Steel Corp',
    owner: 'Owner Shipping Ltd',
    broker: 'Broker Partners',
    lastPortAgent: 'Singapore Agents',
    statutoryCerts: false,
    insuranceDesk: false,
    charterersPiIdentified: false,
    masterSignedCargo: false,
    charterersPi: '—',
  },
  route: {
    loadPort: 'Singapore',
    dischargePort: 'Mundra',
    progressPercent: 45,
    noonReport: 'Next port: Mundra · ETA: 18-01-2026 08:00 · Dist to go: 420 NM',
  },
  ports: [
    {
      key: 'LP-Singapore',
      kind: 'LP',
      name: 'Singapore',
      cargo: 'Coal',
      qty: '50000',
      pdaStatus: 'PDA Rcvd',
      pdaRemarks: 'Agent nominated',
      pdaTone: 'green',
      laytimeNote: 'Not yet commenced',
      laytimeMuted: true,
      cwStatus: 'In Progress',
      cwStatusTone: 'amber',
    },
    {
      key: 'DP-Mundra',
      kind: 'DP',
      name: 'Mundra',
      cargo: 'Coal',
      qty: '50000',
      pdaStatus: 'Pending',
      pdaRemarks: 'FDA pending',
      pdaTone: 'amber',
      laytimeNote: 'Not yet commenced',
      laytimeMuted: true,
      cwStatus: 'Pending',
      cwStatusTone: 'amber',
    },
  ],
  bunkers: {
    bunkersStemmed: true,
    bunkerGrades: [
      {
        grade: 'VLSFO',
        date: '14-01-2026',
        shipFig: '420',
        rcptFig: '200',
        supplier: '—',
        barge: '—',
        price: '520',
        remarks: '',
        muted: false,
      },
    ],
  },
  financials: [
    { name: 'Freight Invoice', chip: 'Draft', tone: 'grey', remarks: 'Awaiting voyage completion', linkKey: 'cashflow' },
    { name: 'Demurrage Invoice', chip: 'Draft', tone: 'grey', remarks: 'Awaiting SOF from DP', linkKey: 'cashflow' },
    { divider: true },
    { name: 'Brokerage', chip: 'Draft', tone: 'grey', remarks: 'Awaiting freight settlement', linkKey: 'payment' },
    { name: 'Bunkers', chip: 'Hold', tone: 'amber', remarks: 'Invoice under review', linkKey: 'bunker' },
    { name: 'Hire', chip: 'Draft', tone: 'grey', remarks: '—', remarksMuted: true, linkKey: 'payment' },
  ],
};

export async function getVoyageStatus(comId, options = {}) {
  if (isDbConfigured()) return dbGetVoyageStatus(comId, options);
  return {
    comId: String(comId || ''),
    kind: options.kind || options.mode || 'vc',
    ...MOCK_VOYAGE_STATUS,
  };
}
