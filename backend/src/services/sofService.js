import { isDbConfigured } from '../config.js';
import {
  dbGetSofForm,
  dbSaveSof,
  validateSofActivityPartialPercentages,
  validateSofCompletedIntervals,
  validateSofDeductionPartialPercentages,
} from './sofDb.js';

const MOCK_FORM = {
  comId: '8',
  fcaId: '100',
  voyageNo: 'V25001',
  vesselName: 'KALYMNOS DAWN',
  message: 'NOM-001',
  cargo: ['WHEAT'],
  estimateType: 3,
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
      sofId: '',
      terminal: '',
      submitId: 0,
      locked: false,
      canEdit: true,
      uploads: [],
      stowageQty: '',
      vesselArrived: '',
      norTendered: '',
      pilotOnBoard: '',
      loadCommenced: '',
      loadCompleted: '',
      vesselSailed: '',
      agentRemarks: '',
      entityRows: [],
      blRows: [{ blDate: '', cargo: '', blQty: '' }],
      portActivities: [{
        activity: '', from: '', to: '', duration: '',
        layTimeCount: false, portTimeCount: false, notes: '',
      }],
      deductions: [],
      laytimeId: '',
      laytimeLocked: false,
      preArrival: {
        cargoDecl: false,
        stowPlanQty: '',
        spDeptDraft: '',
        spArrDraft: '',
        eta30: '',
        eta25: '',
        eta20: '',
        eta15: '',
        eta10: '',
        eta7: '',
        eta5: '',
        eta3: '',
        eta2: '',
        eta1: '',
        actualArrival: '',
        norTendered: '',
      },
      dailyQty: [{
        date: '', engagementQty: '', loadLast: '', ttlLoad: '', balance: '', etcd: '',
      }],
      keyOperations: [
        {
          activity: 'EOSP',
          activityDateTime: '01-01-2026 08:00',
          robIfo: '100',
          robMdo: '20',
          comments: '',
          tDefault: 1,
        },
        {
          activity: 'NOR tendered',
          activityDateTime: '',
          robIfo: '',
          robMdo: '',
          comments: '',
          tDefault: 1,
        },
        {
          activity: 'Full away on passage',
          activityDateTime: '03-01-2026 18:00',
          robIfo: '80',
          robMdo: '15',
          comments: '',
          tDefault: 1,
        },
      ],
      cargoRows: [
        {
          activity: 'Cargo Loaded',
          shipFigure: '',
          blFigure: '',
          waterDensity: '',
          remarks: '',
          tDefault: 1,
        },
        {
          activity: 'Remarks/delays/interuptions',
          shipFigure: '',
          blFigure: '',
          waterDensity: '',
          remarks: '',
          tDefault: 1,
        },
      ],
    },
  ],
};

let mockForm = structuredClone(MOCK_FORM);

export function __resetSofMockForTests() {
  mockForm = structuredClone(MOCK_FORM);
}

export async function getSofForm(comId) {
  if (isDbConfigured()) return dbGetSofForm(comId);
  if (String(comId) !== String(mockForm.comId)) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
  }
  return structuredClone(mockForm);
}

export async function saveSof(payload = {}) {
  if (isDbConfigured()) return dbSaveSof(payload);
  if (Array.isArray(payload.portActivities)) {
    validateSofActivityPartialPercentages(payload.portActivities);
  }
  if (Array.isArray(payload.deductions)) {
    validateSofDeductionPartialPercentages(payload.deductions);
  }
  // Mock fixture is Dry (estimateType 3); keep interval gate aligned with dbSaveSof Dry scope.
  if (Number(mockForm.estimateType) === 3) {
    if (Array.isArray(payload.portActivities)) {
      validateSofCompletedIntervals(payload.portActivities, {
        fromKey: 'from',
        toKey: 'to',
        label: 'Activity',
        rejectUnparseable: true,
      });
    }
    if (Array.isArray(payload.deductions)) {
      validateSofCompletedIntervals(payload.deductions, {
        fromKey: 'start',
        toKey: 'end',
        label: 'Deduction',
        rejectUnparseable: true,
      });
    }
  }
  const port = mockForm.ports.find(
    (item) => item.key === `${payload.portType}-${payload.portId}-${payload.randomId}`,
  );
  if (!port) {
    const error = new Error('Port tab not found.');
    error.status = 404;
    throw error;
  }
  if (port.locked) {
    const error = new Error('This SOF is locked (Submit & Close).');
    error.status = 400;
    throw error;
  }
  if (payload.terminal !== undefined) port.terminal = payload.terminal || '';
  if (payload.stowageQty !== undefined) port.stowageQty = payload.stowageQty || '';
  if (payload.vesselArrived !== undefined) port.vesselArrived = payload.vesselArrived || '';
  if (payload.norTendered !== undefined) port.norTendered = payload.norTendered || '';
  if (payload.pilotOnBoard !== undefined) port.pilotOnBoard = payload.pilotOnBoard || '';
  if (payload.loadCommenced !== undefined) port.loadCommenced = payload.loadCommenced || '';
  if (payload.loadCompleted !== undefined) port.loadCompleted = payload.loadCompleted || '';
  if (payload.vesselSailed !== undefined) port.vesselSailed = payload.vesselSailed || '';
  if (payload.agentRemarks !== undefined) port.agentRemarks = payload.agentRemarks || '';
  if (Array.isArray(payload.entityRows)) port.entityRows = payload.entityRows;
  if (Array.isArray(payload.blRows)) port.blRows = payload.blRows;
  if (Array.isArray(payload.portActivities)) port.portActivities = payload.portActivities;
  if (Array.isArray(payload.deductions) && !port.laytimeLocked) port.deductions = payload.deductions;
  if (payload.preArrival && typeof payload.preArrival === 'object' && !Array.isArray(payload.preArrival)) {
    port.preArrival = payload.preArrival;
  }
  if (Array.isArray(payload.dailyQty)) port.dailyQty = payload.dailyQty;
  if (Array.isArray(payload.keyOperations)) port.keyOperations = payload.keyOperations;
  if (Array.isArray(payload.cargoRows)) port.cargoRows = payload.cargoRows;
  if (Array.isArray(payload.keepFiles)) {
    port.uploads = payload.keepFiles.map(String).filter(Boolean);
  } else if (Array.isArray(payload.appendFiles)) {
    port.uploads = [
      ...(port.uploads || []),
      ...payload.appendFiles.map(String).filter(Boolean),
    ];
  }
  port.submitId = Number(payload.submitId || 1);
  port.locked = port.submitId === 2;
  port.canEdit = !port.locked;
  port.sofId = port.sofId || '9001';
  return { msg: 0, sofId: port.sofId, submitId: port.submitId, closed: port.locked };
}
