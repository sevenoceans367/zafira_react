import { isDbConfigured } from '../config.js';
import { dbGetEstimateDetail, dbUpdateEstimateDetail } from './estimateDetailDb.js';

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
    portLegs: [],
  };
}

export async function updateEstimateDetail(id, payload) {
  if (isDbConfigured()) {
    return dbUpdateEstimateDetail(id, payload);
  }
  return { msg: 0 };
}
