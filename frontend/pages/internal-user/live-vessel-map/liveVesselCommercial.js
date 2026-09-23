import { appPath } from '@bainbridge/shared-routing';
import { vesselDisplayName, vesselField } from './liveVesselMap.constants.js';

export const CONTRACT_LABEL = {
  spot: 'Spot',
  tc: 'TC',
  coa: 'COA',
  period: 'Period',
  relet: 'Relet',
};

export function agentInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
}

export function formatMoney(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  const n = Number(value);
  const abs = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

export function metricTone(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  return Number(value) >= 0 ? 'pos' : 'neg';
}

/** Build commercial view-model for bubble + full-details panel. */
export function resolveCommercial(vessel) {
  const c = vessel?.commercial || {};
  const origin = vesselField(vessel, 'OriginDeclared');
  const dest = vesselField(vessel, 'DestDeclared');
  const contract = String(
    c.contract
    || (vessel?.fleetKind === 'tc' ? 'tc' : '')
    || (vessel?.isFleet ? 'spot' : ''),
  ).toLowerCase();

  const contacts = Array.isArray(c.contacts) ? c.contacts : [];
  const approachingAgent = contacts.find((item) => item.type === 'agent') || contacts[0] || null;

  return {
    name: vesselDisplayName(vessel),
    vesselType: c.vesselType || '',
    contract,
    contractLabel: CONTRACT_LABEL[contract] || '',
    from: c.from || origin,
    to: c.to || dest,
    legFrom: c.legFrom || origin,
    legTo: c.legTo || dest,
    voyageNo: c.voyageNo || vesselField(vessel, 'fleetVoyageNo') || '',
    cargo: c.cargo || '',
    laycan: c.laycan || '',
    rate: c.rate || '',
    charterer: c.charterer || '',
    owner: c.owner || '',
    terms: c.terms || '',
    tce: c.tce,
    pnl: c.pnl,
    contacts,
    approachingAgent,
    fleetComId: vessel?.fleetComId || c.comId || '',
    workingCostSheetId: c.workingCostSheetId || null,
    workingSheetName: c.workingSheetName || '',
    workingVfKind: c.workingVfKind || vessel?.fleetKind || 'vc',
  };
}

export function workingVfHref(commercial) {
  const comId = commercial?.fleetComId;
  const sheetId = commercial?.workingCostSheetId;
  if (!comId || !sheetId) return '';
  if (commercial.workingVfKind === 'tc') {
    return appPath(
      `/internal-user/vc/ops-tc/cost-sheet?comid=${encodeURIComponent(comId)}&cost_sheet_id=${encodeURIComponent(sheetId)}&page=1`,
    );
  }
  return appPath(
    `/internal-user/vc/ops/cost-sheet?comid=${encodeURIComponent(comId)}&cost_sheet_id=${encodeURIComponent(sheetId)}&page=1`,
  );
}

export function rateRowLabel(contract) {
  if (contract === 'tc' || contract === 'period') return 'Hire';
  return 'Freight';
}
