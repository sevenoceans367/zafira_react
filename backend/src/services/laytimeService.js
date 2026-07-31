import { isDbConfigured } from '../config.js';
import { dbGetLaytimeForm, dbSaveLaytime } from './laytimeDb.js';

const MOCK_FORM = {
  comId: '8',
  fcaId: '100',
  voyageNo: 'V25001',
  vesselName: 'KALYMNOS DAWN',
  message: 'NOM-001',
  cargo: ['WHEAT'],
  currency: 'USD',
  rateUnit: 'days',
  canOpen: true,
  approverOptions: [],
  vesselParticulars: {
    vesselName: 'KALYMNOS DAWN',
    built: '2012',
    grtNrt: '25000/15000',
    flag: 'PANAMA',
    dwt: '55000',
    loaBeam: '190/32.2',
    estimateType: 3,
    gearLabel: 'GEAR/GRABS',
    gearValue: '4 X 30MT CRANES',
    hatchLabel: 'HATCH/HOLD',
    hatchValue: '5/5',
  },
  ports: [
    {
      key: 'LP-10-101',
      tabLabel: 'LP-ROTTERDAM (NL)',
      portType: 'LP',
      portId: '10',
      portName: 'ROTTERDAM (NL)',
      randomId: '101',
      operation: 'Loading',
      laytimeId: '',
      sofId: '',
      submitId: 0,
      locked: false,
      canEdit: true,
      terminal: '',
      stowageQty: '',
      vesselArrived: '01-01-2026 08:00',
      norTendered: '01-01-2026 09:00',
      norAccepted: '',
      startCounting: '',
      pilotOnBoard: '',
      loadCommenced: '01-01-2026 12:00',
      loadCompleted: '02-01-2026 18:00',
      vesselSailed: '03-01-2026 06:00',
      loadedQty: '10000',
      loadedRate: '',
      laytimeAllowed: '',
      actualLaytime: '',
      turnTime: '',
      turnTimeToAdd: '',
      timeToDemurrage: '',
      demurrageRate: '',
      ttlDemurrage: '',
      ttlDemurrageManual: '',
      timeToDespatch: '',
      despatchRate: '',
      ttlDespatch: '',
      ttlDespatchManual: '',
      totalDaysAtPort: '',
      loadedTerms: '',
      remarks: '',
      reversible: '0',
      detention: '0',
      laytimeApplicable: '1',
      portNameManual: '',
      approvers: [],
      uploads: [],
      activities: [
        {
          activity: 'Commenced cargo operations',
          start: '01-01-2026 12:00',
          end: '02-01-2026 18:00',
          duration: '30.0000',
          ltCounts: true,
          ltNoCounts: false,
          ltPartial: '100',
          cumulative: '30.0000',
          notes: '',
        },
      ],
      deductions: [
        {
          activity: '',
          start: '',
          end: '',
          duration: '',
          ltPartial: '',
          cumulative: '',
          notes: '',
        },
      ],
      entityRows: [
        { name: 'EOSP', value: '01-01-2026 08:00' },
      ],
    },
  ],
};

let mockForm = structuredClone(MOCK_FORM);

export async function getLaytimeForm(comId) {
  if (isDbConfigured()) return dbGetLaytimeForm(comId);
  if (String(comId) !== String(mockForm.comId)) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
  }
  return structuredClone(mockForm);
}

export async function saveLaytime(payload = {}) {
  if (isDbConfigured()) return dbSaveLaytime(payload);

  const port = mockForm.ports.find(
    (item) => item.key === `${payload.portType}-${payload.portId}-${payload.randomId}`,
  );
  if (!port) {
    const error = new Error('Port tab not found.');
    error.status = 404;
    throw error;
  }

  const action = String(payload.action || 'save').toLowerCase();
  if (port.locked && action !== 'open') {
    const error = new Error('This Laytime is locked (Submit & Close).');
    error.status = 400;
    throw error;
  }

  let submitId = Number(payload.submitId ?? 0);
  if (action === 'open') submitId = 0;

  Object.assign(port, {
    terminal: payload.terminal ?? port.terminal,
    stowageQty: payload.stowageQty ?? port.stowageQty,
    vesselArrived: payload.vesselArrived ?? port.vesselArrived,
    norTendered: payload.norTendered ?? port.norTendered,
    norAccepted: payload.norAccepted ?? port.norAccepted,
    startCounting: payload.startCounting ?? port.startCounting,
    pilotOnBoard: payload.pilotOnBoard ?? port.pilotOnBoard,
    loadCommenced: payload.loadCommenced ?? port.loadCommenced,
    loadCompleted: payload.loadCompleted ?? port.loadCompleted,
    vesselSailed: payload.vesselSailed ?? port.vesselSailed,
    loadedQty: payload.loadedQty ?? port.loadedQty,
    loadedRate: payload.loadedRate ?? port.loadedRate,
    laytimeAllowed: payload.laytimeAllowed ?? port.laytimeAllowed,
    actualLaytime: payload.actualLaytime ?? port.actualLaytime,
    turnTime: payload.turnTime ?? port.turnTime,
    turnTimeToAdd: payload.turnTimeToAdd ?? port.turnTimeToAdd,
    timeToDemurrage: payload.timeToDemurrage ?? port.timeToDemurrage,
    demurrageRate: payload.demurrageRate ?? port.demurrageRate,
    ttlDemurrage: payload.ttlDemurrage ?? port.ttlDemurrage,
    ttlDemurrageManual: payload.ttlDemurrageManual ?? port.ttlDemurrageManual,
    timeToDespatch: payload.timeToDespatch ?? port.timeToDespatch,
    despatchRate: payload.despatchRate ?? port.despatchRate,
    ttlDespatch: payload.ttlDespatch ?? port.ttlDespatch,
    ttlDespatchManual: payload.ttlDespatchManual ?? port.ttlDespatchManual,
    totalDaysAtPort: payload.totalDaysAtPort ?? port.totalDaysAtPort,
    loadedTerms: payload.loadedTerms ?? port.loadedTerms,
    remarks: payload.remarks ?? port.remarks,
    reversible: payload.reversible != null ? (Number(payload.reversible) === 1 || payload.reversible === true || payload.reversible === '1' ? '1' : '0') : port.reversible,
    detention: payload.detention != null ? (Number(payload.detention) === 1 || payload.detention === true || payload.detention === '1' ? '1' : '0') : port.detention,
    laytimeApplicable: payload.laytimeApplicable != null ? (Number(payload.laytimeApplicable) === 1 || payload.laytimeApplicable === true || payload.laytimeApplicable === '1' ? '1' : '0') : port.laytimeApplicable,
    portNameManual: payload.portNameManual ?? port.portNameManual,
    approvers: Array.isArray(payload.approvers) ? payload.approvers : port.approvers,
    activities: payload.activities || port.activities,
    deductions: payload.deductions || port.deductions,
    entityRows: payload.entityRows || port.entityRows,
    submitId,
    locked: submitId === 5,
    canEdit: submitId !== 5,
    laytimeId: port.laytimeId || '9001',
  });

  return {
    msg: 0,
    laytimeId: port.laytimeId,
    submitId: port.submitId,
    closed: port.locked,
  };
}

export async function openLaytime(payload = {}) {
  return saveLaytime({ ...payload, action: 'open', submitId: 0 });
}
