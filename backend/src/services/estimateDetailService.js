import { isDbConfigured } from '../config.js';
import {
  dbCreateEstimateDetail,
  dbGetEstimateDetail,
  dbGetEstimateLookups,
  dbGetPeriodPrefill,
  dbSearchVessels,
  dbUpdateEstimateDetail,
} from './estimateDetailDb.js';

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
  if (isDbConfigured()) {
    return dbUpdateEstimateDetail(id, payload, upload);
  }
  return { msg: 0 };
}

export async function searchVessels(query) {
  if (isDbConfigured()) {
    return dbSearchVessels(query);
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
  return mock.filter(
    (row) => row.name.toLowerCase().includes(term) || row.imoNo.includes(term),
  );
}

export async function createEstimateDetail(payload, upload = {}) {
  if (!payload.fixtureTypeId) {
    throw new Error('Business type is required.');
  }
  if (!payload.vesselImoId) {
    throw new Error('Vessel is required.');
  }
  if (!payload.voyageNo?.trim()) {
    throw new Error('Voyage No. is required.');
  }

  if (isDbConfigured()) {
    return dbCreateEstimateDetail(payload, upload);
  }

  return { msg: 0, id: '999' };
}
