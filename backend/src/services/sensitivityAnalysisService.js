import { isDbConfigured } from '../config.js';
import {
  dbGetSensitivityAnalysis,
  dbUpdateSensitivityEstimate,
} from './sensitivityAnalysisDb.js';

function buildMockColumn(id, index) {
  return {
    id,
    vesselName: `Vessel ${index + 1}`,
    voyageNo: `V-${index + 1}`,
    cargoType: 'Tanker',
    estimateType: 2,
    chkLumpSum: false,
    freight: 25,
    qty: 40000,
    lumpsumAmt: 0,
    freightAdjustments: [{
      key: 'fa-1',
      minCargoQty: 30000,
      minFlatRate: 50,
      minWSRate: 120,
      minAmt: 1800000,
      overageQty: 10000,
      overageFlatRate: 25,
      overageWSRate: 120,
      overageAmt: 300000,
    }],
    loadPorts: [{ key: 'lp-1', portId: '1', portName: 'Rotterdam', cost: 12000 }],
    discPorts: [{ key: 'dp-1', portId: '2', portName: 'Singapore', cost: 10000 }],
    transitPorts: [],
    bunkeringPorts: [],
    bunkerExpenses: [
      { grade: 'VLSFO', estMt: 500, estPrice: 600, estCost: 300000 },
      { grade: 'MGO', estMt: 50, estPrice: 900, estCost: 45000 },
    ],
    hire: {
      rate: 12000,
      ballastBonus: 50000,
      hierageAddCommPercent: 3.75,
      hierageBrokeragePercent: 1.25,
      cvePerMonth: 2500,
      totalDays: 42,
      ilohcCost: 15000,
    },
    brokeragePer: 1.25,
    brokerageAmt: 26250,
    addCommPer: 2.5,
    addressCommAmt: 52500,
    otherIncome: 0,
    operationalCost: 5000,
  };
}

export async function getSensitivityAnalysis(ids, businessType = '2') {
  const idList = Array.isArray(ids) ? ids.map(String) : String(ids ?? '').split(',').filter(Boolean);

  if (!idList.length) {
    throw new Error('Please select at least one checkbox');
  }

  if (isDbConfigured()) {
    const data = await dbGetSensitivityAnalysis(idList);
    return { ...data, businessType: String(businessType) };
  }

  return {
    businessType: String(businessType),
    bunkerGrades: ['VLSFO', 'MGO'],
    columns: idList.map((id, index) => buildMockColumn(id, index)),
  };
}

export async function updateSensitivityEstimate(id, payload) {
  if (!id) {
    throw new Error('Estimate id is required.');
  }

  if (isDbConfigured()) {
    return dbUpdateSensitivityEstimate(id, payload);
  }

  return { success: true, id: String(id), mock: true };
}
