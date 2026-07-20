import { isDbConfigured } from '../config.js';
import { dbGetTcChecklist, dbSaveTcChecklist } from './tcChecklistDb.js';

const emptyForm = () => ({
  checklistId: null,
  checks: {
    reg: false,
    class: false,
    pni: false,
    ism: false,
    doc: false,
    itc: false,
    isps: false,
    ll: false,
    bq: false,
    hm: false,
    seaWeb: false,
    cargoDeclMaster: false,
    reqDocsSentToIns: false,
  },
  chartererPni: '',
  lastPortAgent: '',
  laycanFrom: '',
  laycanTo: '',
  draftResAsPerCp: '',
  loadRateCp: '',
  dischargeRateCp: '',
  deliveryEtas: [{ text: '', date: '' }],
  redeliveryEtas: [{ text: '', date: '' }],
  delivery: {
    actualArrivalText: 'ACTUAL ARRIVAL',
    actualArrivalDate: '',
    norTenderedText: 'NOR TENDERED',
    norTenderedDate: '',
    placePortText: 'DELIVERY PLACE/PORT',
    placePortData: 'Singapore',
    foDoText: 'DELIVERY FO/DO (MT)',
    foDoData: '',
    dateTimeText: 'DELIVERY DATE/TIME',
    dateTimeData: '15-01-2026',
  },
  redelivery: {
    actualArrivalText: 'ACTUAL ARRIVAL',
    actualArrivalDate: '',
    norTenderedText: 'NOR TENDERED',
    norTenderedDate: '',
    placePortText: 'RE-DELIVERY PLACE/PORT',
    placePortData: 'Mundra',
    foDoText: 'RE-DELIVERY FO/DO (MT)',
    foDoData: '',
    dateTimeText: 'RE-DELIVERY DATE/TIME',
    dateTimeData: '01-03-2026',
  },
  remarks: '',
});

let mockByComId = {
  9101: {
    comId: '9101',
    fixture: {
      tcOutId: 601,
      tcNo: 'TC-2601',
      vesselName: 'ATLANTIC STAR',
      cpDate: '15-01-2026',
      charterer: 'Steel Corp',
      built: '2012',
      deadweight: '55000',
      draft: '12.5',
      grtNrt: '32000/18000',
      tpc: '55',
      vesselPni: 'Gard',
      delRangePort: 'Singapore',
      reDelRange: 'Mundra',
      estimateLaycanFrom: '10-01-2026 00:00',
      estimateLaycanTo: '20-01-2026 00:00',
      delDateEst: '15-01-2026',
      reDelDateEst: '01-03-2026',
    },
    form: emptyForm(),
    pniVendors: [
      { id: 'PNI1', name: 'Gard ( PNI1 )' },
      { id: 'PNI2', name: 'Skuld ( PNI2 )' },
    ],
  },
};

export function __resetTcChecklistMockForTests() {
  mockByComId = {
    9101: {
      comId: '9101',
      fixture: {
        tcOutId: 601,
        tcNo: 'TC-2601',
        vesselName: 'ATLANTIC STAR',
        cpDate: '15-01-2026',
        charterer: 'Steel Corp',
        built: '2012',
        deadweight: '55000',
        draft: '12.5',
        grtNrt: '32000/18000',
        tpc: '55',
        vesselPni: 'Gard',
        delRangePort: 'Singapore',
        reDelRange: 'Mundra',
        estimateLaycanFrom: '10-01-2026 00:00',
        estimateLaycanTo: '20-01-2026 00:00',
        delDateEst: '15-01-2026',
        reDelDateEst: '01-03-2026',
      },
      form: emptyForm(),
      pniVendors: [
        { id: 'PNI1', name: 'Gard ( PNI1 )' },
        { id: 'PNI2', name: 'Skuld ( PNI2 )' },
      ],
    },
  };
}

export async function getTcChecklist(comId) {
  if (isDbConfigured()) return dbGetTcChecklist(comId);
  const key = String(comId);
  if (!mockByComId[key]) {
    mockByComId[key] = {
      comId: key,
      fixture: {
        tcOutId: Number(key) || 1,
        tcNo: `TC-${key}`,
        vesselName: 'MOCK VESSEL',
        cpDate: '01-01-2026',
        charterer: 'Mock Charterer',
        built: '2010',
        deadweight: '40000',
        draft: '11',
        grtNrt: '20000/10000',
        tpc: '40',
        vesselPni: '',
        delRangePort: 'Port A',
        reDelRange: 'Port B',
        estimateLaycanFrom: '',
        estimateLaycanTo: '',
        delDateEst: '',
        reDelDateEst: '',
      },
      form: {
        ...emptyForm(),
        delivery: {
          ...emptyForm().delivery,
          placePortData: 'Port A',
        },
        redelivery: {
          ...emptyForm().redelivery,
          placePortData: 'Port B',
        },
      },
      pniVendors: [
        { id: 'PNI1', name: 'Gard ( PNI1 )' },
        { id: 'PNI2', name: 'Skuld ( PNI2 )' },
      ],
    };
  }
  return structuredClone(mockByComId[key]);
}

export async function saveTcChecklist(comId, payload = {}) {
  if (isDbConfigured()) return dbSaveTcChecklist(comId, payload);

  if (!String(payload.lastPortAgent || '').trim()) {
    const error = new Error('Last Port Agent is required.');
    error.status = 400;
    throw error;
  }
  if (!String(payload.chartererPni || '').trim()) {
    const error = new Error('Charterers PNI is required.');
    error.status = 400;
    throw error;
  }
  if (!String(payload.laycanFrom || '').trim() || !String(payload.laycanTo || '').trim()) {
    const error = new Error('Laycan From and Laycan To are required.');
    error.status = 400;
    throw error;
  }
  if (!String(payload.remarks || '').trim()) {
    const error = new Error('Remarks are required.');
    error.status = 400;
    throw error;
  }

  const current = await getTcChecklist(comId);
  const nextForm = {
    ...current.form,
    ...payload,
    checks: { ...current.form.checks, ...(payload.checks || {}) },
    delivery: { ...current.form.delivery, ...(payload.delivery || {}) },
    redelivery: { ...current.form.redelivery, ...(payload.redelivery || {}) },
    deliveryEtas: Array.isArray(payload.deliveryEtas) ? payload.deliveryEtas : current.form.deliveryEtas,
    redeliveryEtas: Array.isArray(payload.redeliveryEtas) ? payload.redeliveryEtas : current.form.redeliveryEtas,
    checklistId: current.form.checklistId || 1,
  };
  mockByComId[String(comId)] = {
    ...current,
    form: nextForm,
  };
  return { msg: 0, checklistId: nextForm.checklistId };
}
