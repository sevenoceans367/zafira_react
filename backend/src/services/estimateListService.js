import { isDbConfigured } from '../config.js';
import {
  dbDeleteEstimate,
  dbGetCompareEstimates,
  dbGetEstimateList,
  dbReplicateEstimate,
  dbSendEstimateToOps,
  dbSubmitDecisionChart,
} from './estimateListDb.js';
import {
  BUSINESS_TYPES,
  mapCompareRow,
  mapListRow,
  parsePeriodDate,
  isDateWithinPeriod,
} from './estimateListMappers.js';

/** In-memory fallback when DB is not configured in backend/.env */
let estimates = [
  {
    fcaId: '1001',
    estimateType: 1,
    vesselName: 'Atlantic Star',
    vesselType: 'LNG Carrier',
    voyageName: 'VC Gas Q1-2026',
    voyageNo: '260001',
    transDate: '2026-03-01',
    dwt: '85000',
    totalDays: 42,
    gasQuantity: 65000,
    tankQuantity: 0,
    quantity: 0,
    qtyTypeRadio: 1,
    dailyEarning: 48500,
    dailyVesselOperationExp: 41200,
    profitLoss: 306600,
    charteringPicName: 'John Smith',
    ifBenchmark: 0,
    comid: '',
    gasMarket: 1,
    gasBaseRate: 12.5,
    gasLumsum: 0,
    tankerRadioSingleDis: 1,
  },
];

const portLegs = {
  1001: { load: ['Ras Laffan'], discharge: ['Tokyo'], ballast: ['Fujairah'] },
};

let compareCounter = 2;

export { BUSINESS_TYPES };

export function getBusinessTypes(selectedId = '') {
  return BUSINESS_TYPES.map((type) => ({
    ...type,
    selected: type.id === String(selectedId),
  }));
}

export async function getEstimateList({ selBType, periodFrom, periodTo } = {}) {
  if (isDbConfigured()) {
    return dbGetEstimateList({ selBType, periodFrom, periodTo });
  }

  if (!selBType) {
    return {
      estimateType: null,
      businessType: '',
      rows: [],
      stats: {
        openTrade: 0,
        vesselsInSubs: 0,
        tradesInOperations: 0,
        vesselsOnWater: 0,
      },
    };
  }

  const type = Number(selBType);
  const scoped = estimates
    .filter((row) => row.estimateType === type)
    .filter((row) => isDateWithinPeriod(row.transDate, periodFrom, periodTo));
  const inSubs = scoped.filter((row) => !row.comid);
  const inOps = scoped.filter((row) => row.comid);
  const openTradePl = inSubs.reduce((sum, row) => sum + Number(row.profitLoss || 0), 0);
  const opsPl = inOps.reduce((sum, row) => sum + Number(row.profitLoss || 0), 0);

  return {
    estimateType: type,
    businessType: selBType,
    rows: scoped.map((row, index) => mapListRow(row, index, portLegs)),
    stats: {
      openTrade: openTradePl / 1000,
      vesselsInSubs: inSubs.length,
      tradesInOperations: opsPl / 1000,
      vesselsOnWater: scoped.length,
    },
  };
}

export async function deleteEstimate(id) {
  if (isDbConfigured()) {
    return dbDeleteEstimate(id);
  }

  const exists = estimates.some((row) => row.fcaId === id);
  if (!exists) return null;
  estimates = estimates.filter((row) => row.fcaId !== id);
  delete portLegs[id];
  return { msg: 2 };
}

export async function replicateEstimate(id) {
  if (isDbConfigured()) {
    return dbReplicateEstimate(id);
  }

  const source = estimates.find((row) => row.fcaId === id);
  if (!source) return null;

  const newId = String(1000 + estimates.length + 1);
  estimates = [
    {
      ...source,
      fcaId: newId,
      voyageNo: '',
      voyageName: source.voyageName ? `${source.voyageName} (Copy)` : '',
      comid: '',
    },
    ...estimates,
  ];
  portLegs[newId] = portLegs[id] ? { ...portLegs[id] } : { load: [], discharge: [], ballast: [] };

  return { msg: 0, newId };
}

export async function getCompareEstimates(ids) {
  if (isDbConfigured()) {
    return dbGetCompareEstimates(ids);
  }

  const idList = Array.isArray(ids) ? ids : String(ids).split(',').filter(Boolean);
  const selected = estimates.filter((row) => idList.includes(row.fcaId));
  return {
    businessType: selected[0]?.estimateType ?? null,
    count: selected.length,
    fixtures: selected.map((row, index) => mapCompareRow(row, index, portLegs)),
  };
}

export async function sendEstimateToOps(id) {
  if (isDbConfigured()) {
    return dbSendEstimateToOps(id);
  }

  const row = estimates.find((entry) => entry.fcaId === String(id));
  if (!row) return null;
  if (row.comid) {
    throw new Error('This estimate has already been sent to Operations.');
  }

  return submitDecisionChart({
    selection: {
      id: String(id),
      remarks: 'Sent to Operations',
    },
  });
}

export async function submitDecisionChart({ selection }) {
  if (isDbConfigured()) {
    return dbSubmitDecisionChart({ selection });
  }

  const { id, remarks } = selection ?? {};
  if (!id || !remarks?.trim()) {
    throw new Error('Please select one Fixture and fill remarks');
  }

  const year = new Date().getFullYear().toString().slice(-2);
  const messageNo = String(compareCounter++).padStart(3, '0');
  const message = `${year}-${messageNo}`;

  estimates = estimates.map((row) =>
    row.fcaId === id ? { ...row, comid: String(500 + compareCounter) } : row,
  );

  return {
    msg: 0,
    message,
    messageNo,
    redirect: '/internal-user/sopf/decisionchart_list',
  };
}
