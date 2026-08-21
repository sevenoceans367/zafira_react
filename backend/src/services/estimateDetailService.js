import { isDbConfigured } from '../config.js';
import {
  dbCheckVoyageNoExists,
  dbCreateEstimateDetail,
  dbGetEstimateDetail,
  dbGetEstimateLookups,
  dbGetPeriodPrefill,
  dbGetVesselEstimatePrefill,
  dbNextEstimateNo,
  dbSearchVessels,
  dbUpdateEstimateDetail,
} from './estimateDetailDb.js';
import { normalizeEstimateNo } from './estimateVoyage.js';

export async function getEstimateDetail(id) {
  if (isDbConfigured()) {
    return dbGetEstimateDetail(id);
  }

  return {
    id: String(id),
    fixtureTypeId: 3,
    estimateType: 2,
    estimateTypeLabel: 'Tanker',
    vesselImoId: '1',
    vesselName: 'Atlantic Star',
    imoNo: '9123456',
    vesselType: 'LR1 PRODUCT',
    flag: 'MH',
    transDate: '01-03-2026',
    voyageNo: 'V001',
    estimateNo: 1,
    voyageName: 'VC Gas Q1-2026',
    dwtSummer: '85000',
    gnrt: '45000',
    nrt: 31500,
    loa: '228',
    tpc: '65',
    totalDays: 42,
    cargoQuantity: 65000,
    dailyEarning: 48500,
    dailyVesselOperationExp: 41200,
    profitLoss: 306600,
    freightGross: '325000',
    portLegs: [],
    cargoRows: [],
    bunkerRows: [],
  };
}

export async function getEstimateLookups(estimateType) {
  if (isDbConfigured()) {
    return dbGetEstimateLookups(estimateType);
  }
  return {
    cargos: [{ id: '1', name: 'Crude Oil' }],
    bunkerGrades: [{ id: '1', name: 'VLSFO', bunkerType: 'IFO' }],
    ownerCosts: [{ id: '1', name: 'Agency Fee' }],
    owners: [{ id: '1', name: 'Demo Owner ( OWN )' }],
  };
}

export async function getPeriodPrefill(periodId) {
  if (!periodId) return null;
  if (isDbConfigured()) {
    return dbGetPeriodPrefill(periodId);
  }
  return {
    periodId: String(periodId),
    brokeragePercent: '1.25',
    addCommPercent: '2.5',
    hireRate: '15000',
  };
}

export async function updateEstimateDetail(id, payload, upload = {}) {
  assertEstimateRequiredFields(payload);

  if (isDbConfigured()) {
    const estimateNo = normalizeEstimateNo(payload.estimateNo ?? 1);
    const exists = await dbCheckVoyageNoExists(payload.voyageNo, {
      excludeFcaId: id,
      estimateNo,
      allowSameVoyage: true,
    });
    if (exists) {
      throw new Error('Voyage number already exists');
    }
    return dbUpdateEstimateDetail(id, { ...payload, estimateNo }, upload);
  }
  return { msg: 0 };
}

export async function searchVessels(query) {
  if (isDbConfigured()) {
    const result = await dbSearchVessels(query);
    // Newer shape: { rows, source, warning }; keep array fallback for safety.
    if (Array.isArray(result)) return { rows: result };
    return result;
  }

  const term = String(query || '').trim().toLowerCase();
  const mock = [
    {
      id: '1',
      name: 'Atlantic Star (9123456)',
      vesselName: 'Atlantic Star',
      imoNo: '9123456',
      dwt: '85000',
      vesselType: '5',
      flag: '251',
      loa: '228',
      gnrt: '45000',
    },
  ];
  return {
    rows: mock.filter(
      (row) => row.name.toLowerCase().includes(term) || row.imoNo.includes(term),
    ),
    source: 'mock',
  };
}

export async function getVesselEstimatePrefill(vesselId) {
  if (isDbConfigured()) {
    return dbGetVesselEstimatePrefill(vesselId);
  }

  return {
    vesselImoId: String(vesselId || '1'),
    vesselName: 'Atlantic Star',
    imoNo: '9123456',
    vesselType: 'LR1 PRODUCT',
    flag: 'MH',
    dwtSummer: '85000',
    dwtTropical: '',
    gnrt: '45000',
    loa: '228',
    beam: '32',
    gear: '',
    builtYear: '2015',
    tpc: '65',
    grainCap: '',
    baleCap: '',
    loadable: '85000',
    hasCommercialParameters: true,
    bFullSpeed: '14.5',
    bEcoSpeed1: '12.5',
    bEcoSpeed2: '11',
    lFullSpeed: '13.5',
    lEcoSpeed1: '12',
    lEcoSpeed2: '10.5',
    bFoFullSpeed: '28',
    lFoFullSpeed: '30',
    bDoFullSpeed: '2.5',
    lDoFullSpeed: '2.5',
    pIfoFullSpeed: '3',
    pWfoFullSpeed: '5',
    pIdoFullSpeed: '1',
    pWdoFullSpeed: '1.5',
    consumptionRows: [],
  };
}

function assertEstimateRequiredFields(payload) {
  if (!payload.fixtureTypeId) {
    throw new Error('Please select Business Type');
  }
  if (!payload.vesselImoId) {
    throw new Error('Please select Vessel');
  }
  if (!String(payload.voyageNo || '').trim()) {
    throw new Error('Please fill Voyage No.');
  }

  const firstLeg = (payload.portLegs || [])[0] || {};
  if (!String(firstLeg.fromPortId || '').trim()) {
    throw new Error('Please select From Port');
  }
  if (!String(firstLeg.toPortId || '').trim()) {
    throw new Error('Please select To Port');
  }
  if (!String(firstLeg.passageType || '').trim()) {
    throw new Error('Please select Laden/Ballast');
  }
  if (!String(firstLeg.speedType || '').trim()) {
    throw new Error('Please select Speed Type');
  }
  if (!String(firstLeg.distance ?? '').trim()) {
    throw new Error('Please fill Total Dist.');
  }

  const hasCargo = (payload.cargoRows || []).some((row) => String(row.cargoId || '').trim());
  if (!hasCargo) {
    throw new Error('Please fill Cargo Name');
  }
  if (!String(payload.charteringTeam || '').trim()) {
    throw new Error('Please select Chartering Team');
  }
  if (!String(payload.charteringPic || '').trim()) {
    throw new Error('Please select Chartering PIC');
  }
}

export async function checkVoyageNoExists(voyageNo, options = {}) {
  if (!isDbConfigured()) {
    return false;
  }
  return dbCheckVoyageNoExists(voyageNo, options);
}

export async function nextEstimateNo(voyageNo) {
  if (!isDbConfigured()) {
    return 1;
  }
  return dbNextEstimateNo(voyageNo);
}

export async function createEstimateDetail(payload, upload = {}) {
  assertEstimateRequiredFields(payload);

  if (isDbConfigured()) {
    const isReplicate = Boolean(payload.replicateFrom || payload.allowSameVoyage);
    let estimateNo = normalizeEstimateNo(payload.estimateNo ?? 1);
    if (isReplicate) {
      estimateNo = await dbNextEstimateNo(payload.voyageNo);
    }
    const exists = await dbCheckVoyageNoExists(payload.voyageNo, {
      estimateNo,
      allowSameVoyage: isReplicate,
    });
    if (exists) {
      throw new Error(
        isReplicate
          ? 'Voyage / estimate number combination already exists'
          : 'Voyage number already exists',
      );
    }
    return dbCreateEstimateDetail({ ...payload, estimateNo }, upload);
  }

  return { msg: 0, id: '999' };
}
