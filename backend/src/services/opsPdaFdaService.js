import { isDbConfigured } from '../config.js';
import { dbGetOpsPdaFda, dbReviewOpsPdaFda } from './opsPdaFdaDb.js';

const MOCK = {
  comId: '1001',
  costSheetId: '2001',
  nomId: '26-006',
  voyageNo: '26-006',
  vesselName: 'POLYAIGOS',
  worksheetName: '26-006 Final',
  fcaId: '9001',
  legsCount: 1,
  ports: [
    {
      key: 'LP-10-101',
      tabLabel: 'LP – Lalang Terminal',
      portType: 'LP',
      portId: '10',
      portName: 'Lalang Terminal',
      randomId: '101',
      agentName: 'Aberdeen Intertrade Co.',
      agentCode: 'AG001',
      nominated: true,
      genAgencyId: 5001,
      lpCostId: 1,
      costStatus: 4,
      country: 'Malaysia',
      localCurrency: 'MYR',
      exchangeRate: 0.2364,
      date: '18-Apr-2026',
      voyageNo: '26-006',
      vesselName: 'POLYAIGOS',
      tabDot: 'done',
      pda: {
        status: 'approved',
        estimatedUsd: 42173.76,
        estimatedLc: 178400,
        meta: 'Submitted 18-Apr-2026 · Approved 19-Apr-2026',
        canReview: false,
        canViewBreakdown: true,
      },
      fda: {
        status: 'approved',
        estimatedUsd: 42173.76,
        estimatedLc: 178400,
        actualUsd: 44951.46,
        actualLc: 190150,
        varianceUsd: 2777.7,
        varianceLc: 11750,
        meta: 'Submitted 02-May-2026 · Approved 03-May-2026',
        canReview: false,
        canViewBreakdown: true,
      },
      header: {
        bankDetails: 'Maybank Kuala Lumpur · A/C 5124-7788-0091',
        preparedBy: 'Michael Tan',
        authorizedBy: 'APPROVED 2026-04-19',
        agentRemarks: 'Standard call, no anomalies expected. Bank details attached for the PDA amount.',
        operatorRemarks: 'Variance accepted — congestion confirmed against Port Activity log. Cleared for payment.',
      },
      lines: [
        { name: 'Port dues', estimatedUsd: 9597.84, estimatedLc: 40600, actualUsd: 9597.84, actualLc: 40600 },
        { name: 'Agency fee', estimatedUsd: 6193.68, estimatedLc: 26200, actualUsd: 6843.78, actualLc: 28950 },
        { name: 'Customs clearance', estimatedUsd: 2103.96, estimatedLc: 8900, actualUsd: 2103.96, actualLc: 8900 },
        { name: 'Pilotage / towage', estimatedUsd: 14775, estimatedLc: 62500, actualUsd: 16836.41, actualLc: 71220 },
        { name: 'Cargo survey', estimatedUsd: 7895.76, estimatedLc: 33400, actualUsd: 7895.76, actualLc: 33400 },
        { name: 'Sundries', estimatedUsd: 1607.52, estimatedLc: 6800, actualUsd: 1673.71, actualLc: 7080 },
      ],
    },
    {
      key: 'DP-20-201',
      tabLabel: 'DP – Ptsc Bien Dong 1',
      portType: 'DP',
      portId: '20',
      portName: 'Ptsc Bien Dong 1',
      randomId: '201',
      agentName: 'Saigon Marine Services',
      agentCode: 'AG002',
      nominated: true,
      genAgencyId: 5002,
      lpCostId: 2,
      costStatus: 2,
      country: 'Vietnam',
      localCurrency: 'USD',
      exchangeRate: 1,
      date: '20-Apr-2026',
      voyageNo: '26-006',
      vesselName: 'POLYAIGOS',
      tabDot: 'review',
      pda: {
        status: 'submitted',
        estimatedUsd: 18540,
        estimatedLc: 18540,
        meta: 'Submitted 20-Apr-2026 · awaiting office review',
        canReview: true,
        canViewBreakdown: true,
      },
      fda: {
        status: 'notstarted',
        estimatedUsd: 18540,
        estimatedLc: 18540,
        actualUsd: 0,
        actualLc: 0,
        varianceUsd: 0,
        varianceLc: 0,
        meta: 'Available once PDA is approved',
        canReview: false,
        canViewBreakdown: false,
      },
      header: {
        bankDetails: 'Vietcombank Ho Chi Minh City · A/C 0071-002-998876',
        preparedBy: 'Le Thi Hoa',
        authorizedBy: '',
        agentRemarks: "First call for this vessel at this terminal — estimate based on the terminal's published tariff.",
        operatorRemarks: '',
      },
      lines: [
        { name: 'Port dues', estimatedUsd: 3200, estimatedLc: 3200, actualUsd: 0, actualLc: 0 },
        { name: 'Agency fee', estimatedUsd: 4100, estimatedLc: 4100, actualUsd: 0, actualLc: 0 },
        { name: 'Customs clearance', estimatedUsd: 1850, estimatedLc: 1850, actualUsd: 0, actualLc: 0 },
        { name: 'Pilotage / towage', estimatedUsd: 6900, estimatedLc: 6900, actualUsd: 0, actualLc: 0 },
        { name: 'Cargo survey', estimatedUsd: 2000, estimatedLc: 2000, actualUsd: 0, actualLc: 0 },
        { name: 'Sundries', estimatedUsd: 490, estimatedLc: 490, actualUsd: 0, actualLc: 0 },
      ],
    },
  ],
};

let mockState = structuredClone(MOCK);

export async function getOpsPdaFda(comId) {
  if (isDbConfigured()) return dbGetOpsPdaFda(comId);
  if (String(comId) !== String(mockState.comId)) {
    const error = new Error('Ops voyage not found.');
    error.status = 404;
    throw error;
  }
  return structuredClone(mockState);
}

export async function reviewOpsPdaFda(payload = {}) {
  if (isDbConfigured()) return dbReviewOpsPdaFda(payload);

  const port = mockState.ports.find((p) => String(p.genAgencyId) === String(payload.genAgencyId));
  if (!port || String(payload.comId) !== String(mockState.comId)) {
    const error = new Error('Agency letter not found for this voyage.');
    error.status = 404;
    throw error;
  }

  const action = String(payload.action || '').toLowerCase();
  const mode = String(payload.mode || 'pda').toLowerCase() === 'fda' ? 'fda' : 'pda';
  const remarks = String(payload.operatorRemarks || '').trim();

  if (action === 'approve') {
    if (mode === 'pda') {
      port.pda.status = 'approved';
      port.pda.canReview = false;
      port.pda.meta = `Approved${remarks ? ` · ${remarks}` : ''}`;
      port.header.authorizedBy = `APPROVED ${new Date().toISOString().slice(0, 10)}`;
      port.tabDot = 'done';
    } else {
      port.fda.status = 'approved';
      port.fda.canReview = false;
      port.fda.meta = `Approved${remarks ? ` · ${remarks}` : ''}`;
      port.costStatus = 4;
      port.tabDot = 'done';
    }
    if (remarks) port.header.operatorRemarks = remarks;
  } else if (action === 'query') {
    if (!remarks) {
      const error = new Error('Please enter a query note for the agent.');
      error.status = 400;
      throw error;
    }
    port.header.operatorRemarks = [port.header.operatorRemarks, `[Query] ${remarks}`]
      .filter(Boolean)
      .join('\n');
  } else if (action === 'remarks') {
    port.header.operatorRemarks = remarks;
  } else {
    const error = new Error('Unknown review action.');
    error.status = 400;
    throw error;
  }

  return structuredClone(mockState);
}
