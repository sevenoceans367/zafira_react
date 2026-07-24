import { isDbConfigured, isMgmtUser } from '../config.js';
import {
  dbGetCoaList,
  dbGetCoaShipments,
  dbGetPeriodList,
  dbGetTcDashboard,
  dbGetVcDashboard,
} from './vcDashboardDb.js';
import { BUSINESS_TYPES } from './estimateListMappers.js';

const MOCK_VC = {
  recordCount: 2,
  chartRows: [
    {
      vessel: 'Atlantic Star',
      voyageNo: 'V-101',
      fixture: '125.50',
      interim: '118.20',
      completion: '132.40',
      fixtureValue: 125.5,
      interimValue: 118.2,
      completionValue: 132.4,
    },
    {
      vessel: 'Pacific Dawn',
      voyageNo: 'V-102',
      fixture: '98.00',
      interim: '95.50',
      completion: '',
      fixtureValue: 98,
      interimValue: 95.5,
      completionValue: 0,
    },
  ],
  completedRows: [
    {
      vessel: 'Atlantic Star',
      voyageNo: 'V-101',
      cpDate: '15-03-2026',
      cpDateSort: 1773532800000,
      voyage: 'SINGAPORE / ROTTERDAM',
      deliveryRedelivery: '01-03-2026 - 15-04-2026',
      fixture: '125.50',
      interim: '118.20',
      completion: '132.40',
    },
    {
      vessel: 'Pacific Dawn',
      voyageNo: 'V-102',
      cpDate: '01-02-2026',
      cpDateSort: 1769904000000,
      voyage: 'FUJAIRAH / MUMBAI',
      deliveryRedelivery: '10-02-2026 - 20-03-2026',
      fixture: '98.00',
      interim: '95.50',
      completion: '',
    },
  ],
  freightRows: [
    {
      voyage: 'V-101',
      vessel: 'Atlantic Star',
      charterer: 'ACME Trading(C001)',
      initialFreight: '45000.00',
      finalFreight: '47500.00',
    },
  ],
  freightTotals: { initial: '45000.00', final: '47500.00' },
};

const MOCK_TC = {
  recordCount: 1,
  chartRows: [
    {
      tcNo: 'TC-2401',
      vessel: 'Nordic Spirit',
      fixture: '210.00',
      interim: '205.50',
      completion: '215.00',
      fixtureValue: 210,
      interimValue: 205.5,
      completionValue: 215,
    },
  ],
  completedRows: [
    {
      tcNo: 'TC-2401',
      vessel: 'Nordic Spirit',
      cpDate: '10-01-2026',
      cpDateSort: 1768003200000,
      deliveryRedelivery: '15-01-2026 - 15-07-2026',
      fixture: '210.00',
      interim: '205.50',
      completion: '215.00',
    },
  ],
  hireRows: [
    {
      tcNo: 'TC-2401',
      vessel: 'Nordic Spirit(TC-2401)',
      customer: 'Global Charter(C002)',
      amount: '125000.00',
    },
  ],
  otherRows: [],
  hireTotal: '125000.00',
  otherTotal: '0.00',
};

const MOCK_COAS = {
  records: [
    {
      index: 1,
      coaId: 1,
      coaRoute: 'Asia-Europe',
      coaIdentity: 'COA-001',
      coaNo: '2026/01',
      coaDate: '01-01-2026',
      vesselType: 'Capesize',
      charterer: 'Steel Corp(SC01)',
      cargo: 'Iron Ore(IO01)',
      minQty: '500000',
      duration: '12 months',
      totalShipments: '10',
      shipmentsPerformed: 3,
      balanceCargo: '350000.00',
    },
  ],
  recordsTotal: 1,
  page: 1,
  pageSize: 10,
};

const MOCK_PERIODS = {
  records: [
    {
      index: 1,
      periodId: 1,
      contractId: 'PC-001',
      contractNo: 'PER-2026-01',
      contractDate: '01-01-2026',
      vesselName: 'Atlantic Star',
      ownBusinessAccount: 'Seven Oceans(SO01)',
      workingCurrency: 'USD',
      totalDays: '180.00000',
      performedDays: '45',
      balanceDays: '135.00000',
      vcShipments: 2,
      tcShipments: 1,
    },
  ],
  recordsTotal: 1,
  page: 1,
  pageSize: 10,
};

export function getVcBusinessTypes(selectedId = '2') {
  return BUSINESS_TYPES.map((type) => ({
    ...type,
    selected: type.id === String(selectedId),
  }));
}

export async function getVcDashboard(filters) {
  if (!isDbConfigured()) return MOCK_VC;
  return dbGetVcDashboard(filters);
}

export async function getTcDashboard(filters) {
  if (!isDbConfigured()) return MOCK_TC;
  return dbGetTcDashboard(filters);
}

export async function getCoaList(params) {
  if (!isDbConfigured()) return MOCK_COAS;
  return dbGetCoaList(params);
}

export async function getPeriodList(params) {
  if (!isDbConfigured()) return MOCK_PERIODS;
  return dbGetPeriodList(params);
}

export async function getCoaShipments(coaId) {
  if (!isDbConfigured()) {
    return {
      coaLabel: 'COA-001 - Performed Shipments',
      currency: 'USD',
      rows: MOCK_VC.completedRows.map((row, i) => ({
        index: i + 1,
        vesselName: row.vessel,
        vesselType: 'Capesize',
        coaIdentity: 'COA-001',
        voyageNo: row.voyageNo,
        cpDate: row.cpDate,
        ports: row.voyage,
        duration: '42',
        cargoQty: '65000',
        tce: '48500',
        profitLoss: '306600',
        message: '',
      })),
    };
  }
  return dbGetCoaShipments(coaId);
}

export function getDashboardMeta() {
  return {
    isMgmtUser: isMgmtUser(),
    defaultBusinessType: '2',
    refreshIntervalMs: 50000,
  };
}
