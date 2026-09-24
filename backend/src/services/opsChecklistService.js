import { isDbConfigured } from '../config.js';
import {
  dbGetOpsChecklist,
  dbListPerformingVessels,
  dbListSpotOpsInOpsFleetHeaders,
} from './opsChecklistDb.js';
import { deriveTcChecklist, deriveVcChecklist } from './opsChecklist.js';

export async function listPerformingVessels(params = {}) {
  if (isDbConfigured()) return dbListPerformingVessels(params);
  return { records: [] };
}

/** Fast fleet list for Vessels on Water — In Ops headers only (no checklist). */
export async function listSpotOpsInOpsFleetHeaders(params = {}) {
  if (isDbConfigured()) return dbListSpotOpsInOpsFleetHeaders(params);
  return { records: [] };
}

export async function getOpsChecklist(comId, kind = '') {
  if (isDbConfigured()) return dbGetOpsChecklist(comId, kind);
  const isTc = String(kind || '').toLowerCase() === 'tc';
  const derived = isTc
    ? deriveTcChecklist({ fixture: { at: '15-01-2026', done: true } })
    : deriveVcChecklist({ fixture: { at: '15-01-2026', done: true } });
  return {
    id: `${isTc ? 'tc' : 'vc'}-${comId || '0'}`,
    kind: isTc ? 'tc' : 'vc',
    comId: comId || '',
    vessel: '',
    voy: '',
    tcNo: '',
    cpDate: '15-01-2026',
    route: '—',
    status: derived.status,
    statusLabel: derived.statusLabel,
    wipId: derived.wipId,
    checklistHref: isTc
      ? `/internal-user/vc/ops-tc/checklist?comid=${encodeURIComponent(comId || '')}`
      : `/internal-user/vc/ops/checklist?comid=${encodeURIComponent(comId || '')}`,
    fixture: {
      vesselName: '',
      voyageNo: '',
      tcNo: '',
      cpDate: '15-01-2026',
      loadPort: '',
      dischargePort: '',
    },
    steps: derived.steps,
  };
}
