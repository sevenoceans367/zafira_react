import { isDbConfigured } from '../config.js';
import { dbGetSofForm, dbSaveSof } from './sofDb.js';

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
        activity: '', from: '', to: '', duration: '', notes: '',
      }],
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
  port.terminal = payload.terminal || '';
  port.stowageQty = payload.stowageQty || '';
  port.vesselArrived = payload.vesselArrived || '';
  port.norTendered = payload.norTendered || '';
  port.pilotOnBoard = payload.pilotOnBoard || '';
  port.loadCommenced = payload.loadCommenced || '';
  port.loadCompleted = payload.loadCompleted || '';
  port.vesselSailed = payload.vesselSailed || '';
  port.agentRemarks = payload.agentRemarks || '';
  port.entityRows = payload.entityRows || port.entityRows;
  port.blRows = payload.blRows || port.blRows;
  port.portActivities = payload.portActivities || port.portActivities;
  port.preArrival = payload.preArrival || port.preArrival;
  port.dailyQty = payload.dailyQty || port.dailyQty;
  port.keyOperations = payload.keyOperations || port.keyOperations;
  port.cargoRows = payload.cargoRows || port.cargoRows;
  port.submitId = Number(payload.submitId || 1);
  port.locked = port.submitId === 2;
  port.canEdit = !port.locked;
  port.sofId = port.sofId || '9001';
  return { msg: 0, sofId: port.sofId, submitId: port.submitId, closed: port.locked };
}
