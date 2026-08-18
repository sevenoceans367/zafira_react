/**
 * Chronological Ops Checklist (WIP).
 * ACT arrival events are the base; dates auto-fill from Voyage Financials, SOF, and reports.
 */

export const VC_CHECKLIST_STEPS = [
  { id: 'fixture', label: 'Fixture', status: 'wip', statusLabel: 'Fixture' },
  { id: 'laycan', label: 'Laycan', status: 'wip', statusLabel: 'Laycan' },
  { id: 'arrivalLoad', label: 'Actual Arrival (Load)', status: 'wip', statusLabel: 'Arrived (Load)' },
  { id: 'norLoad', label: 'NOR Tendered (Load)', status: 'wip', statusLabel: 'NOR Tendered (Load)' },
  { id: 'loading', label: 'Loading', status: 'loading', statusLabel: 'Loading' },
  { id: 'sailedLoad', label: 'Sailed (Load)', status: 'sea', statusLabel: 'At Sea' },
  { id: 'bunkering', label: 'Bunkering', status: 'bunkering', statusLabel: 'Bunkering', optional: true },
  { id: 'arrivalDisch', label: 'Actual Arrival (Discharge)', status: 'wip', statusLabel: 'Arrived (Discharge)' },
  { id: 'norDisch', label: 'NOR Tendered (Discharge)', status: 'wip', statusLabel: 'NOR Tendered (Discharge)' },
  { id: 'discharging', label: 'Discharging', status: 'discharging', statusLabel: 'Discharging' },
  { id: 'sailedDisch', label: 'Sailed (Discharge)', status: 'sea', statusLabel: 'At Sea' },
  { id: 'completed', label: 'Voyage completed', status: 'wip', statusLabel: 'Completed' },
];

export const TC_CHECKLIST_STEPS = [
  { id: 'fixture', label: 'Fixture', status: 'wip', statusLabel: 'Fixture' },
  { id: 'laycan', label: 'Laycan', status: 'wip', statusLabel: 'Laycan' },
  { id: 'arrivalDel', label: 'Actual Arrival (Delivery)', status: 'wip', statusLabel: 'Arrived (Delivery)' },
  { id: 'norDel', label: 'NOR Tendered (Delivery)', status: 'wip', statusLabel: 'NOR Tendered (Delivery)' },
  { id: 'delivery', label: 'Delivery', status: 'onhire', statusLabel: 'On Hire' },
  { id: 'performing', label: 'On Hire / Performing', status: 'sea', statusLabel: 'On Hire' },
  { id: 'arrivalRedel', label: 'Actual Arrival (Re-delivery)', status: 'wip', statusLabel: 'Arrived (Re-delivery)' },
  { id: 'norRedel', label: 'NOR Tendered (Re-delivery)', status: 'wip', statusLabel: 'NOR Tendered (Re-delivery)' },
  { id: 'redelivery', label: 'Re-delivery', status: 'wip', statusLabel: 'Re-delivered' },
];

const STATE_STATUSES = new Set(['loading', 'sea', 'discharging', 'bunkering', 'onhire']);
const SKIP_BADGE_IDS = new Set(['fixture', 'laycan']);

function hasText(value) {
  const raw = String(value ?? '').trim();
  return raw !== '' && raw !== '—';
}

function eventValue(events, id) {
  const raw = events?.[id];
  if (raw == null) return { at: '', source: '', started: false, done: false };
  if (typeof raw === 'string') {
    const at = raw.trim();
    return { at, source: '', started: Boolean(at), done: Boolean(at) };
  }
  const at = String(raw.at || '').trim();
  const started = Boolean(raw.started || at);
  const done = raw.done != null ? Boolean(raw.done) : Boolean(at);
  return {
    at,
    source: String(raw.source || '').trim(),
    detail: String(raw.detail || '').trim(),
    started,
    done,
  };
}

export function buildChecklistSteps(defs, events = {}) {
  return defs.map((def) => {
    const value = eventValue(events, def.id);
    return {
      id: def.id,
      label: def.label,
      status: def.status,
      statusLabel: def.statusLabel,
      optional: Boolean(def.optional),
      at: value.at,
      source: value.source,
      detail: value.detail || '',
      started: value.started,
      done: value.done,
    };
  });
}

/**
 * Activity Status = current checklist WIP (ongoing state, else first incomplete operational step).
 * Fixture / laycan alone never invent At Sea / Loading — badge is "—".
 */
export function resolveChecklistActivity(steps = []) {
  const active = steps.filter((step) => !step.optional || step.started || step.done);
  const inProgress = [...active].reverse().find((step) => step.started && !step.done);
  if (inProgress) {
    return {
      status: inProgress.status,
      statusLabel: inProgress.statusLabel,
      wipId: inProgress.id,
    };
  }

  let lastDone = null;
  for (const step of active) {
    if (step.done) lastDone = step;
  }

  const next = active.find((step) => !step.done && !SKIP_BADGE_IDS.has(step.id));
  if (lastDone && STATE_STATUSES.has(lastDone.status) && (!next || next.id !== lastDone.id)) {
    return {
      status: lastDone.status,
      statusLabel: lastDone.statusLabel,
      wipId: next?.id || lastDone.id,
    };
  }

  const firstWip = active.find((step) => !step.done && !SKIP_BADGE_IDS.has(step.id));
  return {
    status: '',
    statusLabel: '—',
    wipId: firstWip?.id || active.find((step) => !step.done)?.id || null,
  };
}

export function deriveVcChecklist(events = {}) {
  const steps = buildChecklistSteps(VC_CHECKLIST_STEPS, events);
  const activity = resolveChecklistActivity(steps);
  return { kind: 'vc', steps, ...activity };
}

export function deriveTcChecklist(events = {}) {
  const steps = buildChecklistSteps(TC_CHECKLIST_STEPS, events);
  const activity = resolveChecklistActivity(steps);
  return { kind: 'tc', steps, ...activity };
}

export function formatRoute(left, right, fallback = '—') {
  const parts = [left, right].map((part) => String(part || '').trim()).filter(hasText);
  if (!parts.length) return fallback;
  return parts.join(' – ');
}
