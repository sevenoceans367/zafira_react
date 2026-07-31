import { isDbConfigured } from '../config.js';
import { dbGetBunkerForm, dbSaveBunker } from './bunkerDb.js';

const MOCK_FORM = {
  comId: '8',
  fcaId: '100',
  voyageNo: 'V25001',
  vesselName: 'KALYMNOS DAWN',
  message: 'NOM-001',
  charterer: 'Mock Charterer',
  currency: 'USD',
  prevComId: '7',
  prevVoyageOptions: [
    { id: '7', name: 'NOM-000' },
    { id: '6', name: 'NOM-PREV' },
  ],
  previousFo: [
    { bunkerId: '1', name: 'VLSFO', qty: '250.000', value: '125000.000', calDesc: '250*500' },
  ],
  previousDo: [
    { bunkerId: '2', name: 'MGO', qty: '40.000', value: '28000.000', calDesc: '40*700' },
  ],
  ports: [
    {
      key: '10-101',
      portId: '10',
      randomId: '101',
      portName: 'ROTTERDAM (NL)',
      comSlaveId: '1',
      sospDate: '01-01-2026 08:00:00',
      foRows: [
        {
          bunkerId: '1',
          robSosp: '200.000',
          qtyStemmed: '50.000',
          supplyPrice: '480.000',
          addCost: '100.000',
          effectivePrice: '482.000',
          stemmedValue: '24100.000',
          remarks: '',
          accountOf: 'Charterer',
        },
      ],
      doRows: [
        {
          bunkerId: '2',
          robSosp: '35.000',
          qtyStemmed: '10.000',
          supplyPrice: '700.000',
          addCost: '0',
          effectivePrice: '700.000',
          stemmedValue: '7000.000',
          remarks: '',
          accountOf: 'Owner',
        },
      ],
    },
    {
      key: '20-102',
      portId: '20',
      randomId: '102',
      portName: 'SINGAPORE (SG)',
      comSlaveId: '2',
      sospDate: '10-01-2026 12:00:00',
      foRows: [
        {
          bunkerId: '1',
          robSosp: '180.000',
          qtyStemmed: '0',
          supplyPrice: '0',
          addCost: '0',
          effectivePrice: '0',
          stemmedValue: '0',
          remarks: '',
          accountOf: 'Charterer',
        },
      ],
      doRows: [
        {
          bunkerId: '',
          robSosp: '',
          qtyStemmed: '',
          supplyPrice: '',
          addCost: '',
          effectivePrice: '',
          stemmedValue: '',
          remarks: '',
          accountOf: '',
        },
      ],
    },
  ],
  sospResults: {
    fo: [{ bunkerId: '1', name: 'VLSFO', value: '90000.000', calDesc: '180*500' }],
    do: [{ bunkerId: '2', name: 'MGO', value: '24500.000', calDesc: '35*700' }],
  },
  consumedCharterer: {
    fo: [{ bunkerId: '1', name: 'VLSFO', qty: '70.000', value: '35000.000' }],
    do: [{ bunkerId: '2', name: 'MGO', qty: '5.000', value: '3500.000' }],
  },
  consumedOwner: {
    fo: [],
    do: [{ bunkerId: '2', name: 'MGO', qty: '10.000', value: '7000.000' }],
  },
  lookups: {
    foGrades: [{ id: '1', name: 'VLSFO' }],
    doGrades: [{ id: '2', name: 'MGO' }],
    accountOfOptions: [
      { id: 'Owner', name: 'Owner' },
      { id: 'Charterer', name: 'Charterer' },
    ],
  },
};

let mockForm = structuredClone(MOCK_FORM);

export async function getBunkerForm(comId, prevComId) {
  if (isDbConfigured()) return dbGetBunkerForm(comId, prevComId);
  if (String(comId) !== String(mockForm.comId)) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
  }
  const form = structuredClone(mockForm);
  if (prevComId) form.prevComId = String(prevComId);
  return form;
}

export async function saveBunker(payload = {}) {
  if (isDbConfigured()) return dbSaveBunker(payload);

  const comId = payload.comId || payload.comid;
  if (String(comId) !== String(mockForm.comId)) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
  }

  const status = Number(payload.status ?? 0);
  mockForm = {
    ...mockForm,
    prevComId: payload.prevComId != null ? String(payload.prevComId) : mockForm.prevComId,
    previousFo: payload.previousFo || mockForm.previousFo,
    previousDo: payload.previousDo || mockForm.previousDo,
    ports: payload.ports || mockForm.ports,
    sospResults: payload.sospResults || mockForm.sospResults,
    consumedCharterer: payload.consumedCharterer || mockForm.consumedCharterer,
    consumedOwner: payload.consumedOwner || mockForm.consumedOwner,
  };

  return { msg: 0, closed: status === 1 };
}
