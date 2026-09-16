const BASE = '/api/internal-user/tc-estimates';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchTcBusinessTypes(selectedId = '2') {
  const response = await fetch(`${BASE}/business-types${toQuery({ selectedId })}`);
  return parseJson(response, 'Failed to load business types.');
}

export async function fetchTcLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load TC lookups.');
}

export async function fetchNextTcEstimateNo(tcNo) {
  const response = await fetch(`${BASE}/next-estimate-no${toQuery({ tcNo })}`);
  const data = await parseJson(response, 'Failed to load next Est No.');
  return Number(data?.estimateNo) > 0 ? Number(data.estimateNo) : 1;
}

export async function fetchTcEstimates(params = {}) {
  const response = await fetch(`${BASE}${toQuery(params)}`);
  return parseJson(response, 'Failed to load TC Out Estimates.');
}

export async function fetchTcEstimate(tcOutId) {
  const response = await fetch(`${BASE}/${encodeURIComponent(tcOutId)}`);
  return parseJson(response, 'Failed to load TC estimate.');
}

export async function downloadTcEstimatePdf(tcOutId) {
  const response = await fetch(`${BASE}/${encodeURIComponent(tcOutId)}/pdf`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to generate TC estimate PDF.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="?([^"]+)"?/i)?.[1] || `TC-Estimate-${tcOutId}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function createTcEstimate(payload, files = []) {
  const body = new FormData();
  body.append('payload', JSON.stringify(payload));
  for (const file of files) {
    body.append('attach_file', file);
  }
  const response = await fetch(BASE, {
    method: 'POST',
    body,
  });
  return parseJson(response, 'Failed to create TC estimate.');
}

export async function updateTcEstimate(tcOutId, payload, files = []) {
  const body = new FormData();
  body.append('payload', JSON.stringify(payload));
  for (const file of files) {
    body.append('attach_file', file);
  }
  const response = await fetch(`${BASE}/${encodeURIComponent(tcOutId)}`, {
    method: 'PUT',
    body,
  });
  return parseJson(response, 'Failed to update TC estimate.');
}

export async function saveTcCalculation(tcOutId, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(tcOutId)}/calculate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to save TC calculation.');
}

export async function deleteTcEstimate(tcOutId) {
  const response = await fetch(`${BASE}/${encodeURIComponent(tcOutId)}`, {
    method: 'DELETE',
  });
  return parseJson(response, 'Failed to delete TC estimate.');
}

export async function fetchTcCompareEstimates(ids = []) {
  const response = await fetch(`${BASE}/compare${toQuery({ ids: Array.isArray(ids) ? ids.join(',') : ids })}`);
  return parseJson(response, 'Failed to load compare candidates.');
}

export async function submitTcDecisionChart(payload) {
  const response = await fetch(`${BASE}/decision-chart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to submit decision chart.');
}

export async function sendTcEstimatesToOps(tcOutIds = []) {
  const response = await fetch(`${BASE}/send-to-ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tcOutIds }),
  });
  return parseJson(response, 'Failed to send TC estimate to Ops.');
}

export async function fetchTcDecisionCharts(params = {}) {
  const response = await fetch(`${BASE}/decision-charts${toQuery(params)}`);
  return parseJson(response, 'Failed to load decision charts.');
}

export async function fetchTcDecisionChartDetails(message) {
  const response = await fetch(`${BASE}/decision-charts/${encodeURIComponent(message)}`);
  return parseJson(response, 'Failed to load decision chart details.');
}

export async function downloadTcDecisionChartsPdf(message = '') {
  const path = message
    ? `/decision-charts/${encodeURIComponent(message)}/pdf`
    : '/decision-charts/pdf';
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to generate decision chart PDF.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="?([^"]+)"?/i)?.[1]
    || (message ? `TC-Decision-Chart-${message}.pdf` : 'TC-Decision-Charts.pdf');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Period-contract TC In seed (PHP loadPeriodDetails / options.php?id=103). */
export async function fetchPeriodTcInDetails(periodId) {
  if (!periodId) return null;
  const response = await fetch(`${BASE}/period-tc-in/${encodeURIComponent(periodId)}`);
  return parseJson(response, 'Failed to load period TC In details.');
}

/** Legacy PHP / MySQL epoch placeholders — treat as empty (same as DmyDateInput). */
function isEpochPlaceholder(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return true;
  return /^0?1[-/]0?1[-/]1970\b/.test(raw) || /^1970[-/]0?1[-/]0?1\b/.test(raw);
}

export function hasDateValue(value) {
  return value != null && String(value).trim() !== '' && !isEpochPlaceholder(value);
}

/** Parse TC date strings (dd-mm-yyyy[ HH:MM[:SS]] or Date-parsable). */
export function parseTcDate(value) {
  if (!hasDateValue(value)) return null;
  const str = String(value).trim();
  const dmy = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (dmy) {
    const [, day, month, year, hh = '0', mm = '0'] = dmy;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(str);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

/** Client-side P&L helpers matching php/updatetcestimatecal.php getFinalCalculation. */
export function daysBetween(endValue, startValue) {
  const end = parseTcDate(endValue);
  const start = parseTcDate(startValue);
  if (!end || !start) return 0;
  return (end.getTime() - start.getTime()) / 86400000;
}

/**
 * Pick hire rate for an off-hire from the trip period whose date range covers
 * the off-hire (prefer From, else To). Falls back to first period rate / hireFixPer.
 */
export function hireRateForOffHireEvent({
  from = '',
  to = '',
  hirePeriods = [],
  fallback = '',
} = {}) {
  const anchor = parseTcDate(from) || parseTcDate(to);
  const periods = Array.isArray(hirePeriods) ? hirePeriods : [];

  if (anchor) {
    for (const period of periods) {
      const start = parseTcDate(period?.delDate);
      const end = parseTcDate(period?.reDelDate);
      const rate = period?.hireRate;
      if (!start || !end || rate == null || String(rate).trim() === '') continue;
      if (anchor.getTime() >= start.getTime() && anchor.getTime() <= end.getTime()) {
        return String(rate);
      }
    }
  }

  for (const period of periods) {
    const rate = period?.hireRate;
    if (rate != null && String(rate).trim() !== '' && Number(rate) !== 0) {
      return String(rate);
    }
  }

  if (fallback != null && String(fallback).trim() !== '') return String(fallback);
  return '';
}

function bunkerGridTotal(rows = []) {
  return rows.reduce((sum, row) => {
    const qty = Number(row.qty);
    const price = Number(row.price);
    const amount = Number(row.amount);
    if (Number.isFinite(amount) && amount !== 0 && (!Number.isFinite(qty) || !Number.isFinite(price))) {
      return sum + amount;
    }
    return sum + ((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0));
  }, 0);
}

/** True when bunker grid has real qty/price/amount (grade alone is not enough). */
function hasBunkerGridData(rows = []) {
  return rows.some((row) => {
    const qty = Number(row.qty);
    const price = Number(row.price);
    const amount = Number(row.amount);
    return (Number.isFinite(qty) && qty !== 0)
      || (Number.isFinite(price) && price !== 0)
      || (Number.isFinite(amount) && amount !== 0);
  });
}

function offHireBunkerTotal(row = {}) {
  const bunkers = Array.isArray(row.bunkers) ? row.bunkers : [];
  return bunkers.reduce((sum, bunker) => {
    const qty = Number(bunker.qty);
    const price = Number(bunker.price);
    const fromQtyPrice = (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0);
    if (fromQtyPrice) return sum + fromQtyPrice;
    const amount = Number(bunker.amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

export function calcTcTotals(input = {}) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  let hireIncome = 0;
  let tcDays = 0;
  const hirePeriods = Array.isArray(input.hirePeriods) ? input.hirePeriods : [];
  const resolvedPeriods = hirePeriods.map((period) => {
    // PHP getFinalCalculation always recomputes TC days from del/redel dates when present.
    let days = num(period.days);
    const hasDel = hasDateValue(period.delDate);
    const hasReDel = hasDateValue(period.reDelDate);
    if (hasDel && hasReDel) {
      days = daysBetween(period.reDelDate, period.delDate);
    }
    const hireRate = num(period.hireRate);
    const amount = hireRate * days;
    hireIncome += amount;
    tcDays += days;
    return {
      ...period,
      days: days ? days.toFixed(4) : (days === 0 && hasDel && hasReDel ? '0.0000' : ''),
      amount: amount.toFixed(2),
    };
  });

  if (!hirePeriods.length) {
    tcDays = num(input.tcDays);
    hireIncome = num(input.dailyGrossHire) * tcDays;
  }

  const ballastBonus = num(input.ballastBonus ?? input.ballastBonusAmt);
  const commissionBase = hireIncome + ballastBonus;
  const addCommPct = num(input.addCommPct);
  const brokerCommPct = num(input.brokerCommPct);
  const addCommAmt = (commissionBase * addCommPct) / 100;
  const brokerCommAmt = (commissionBase * brokerCommPct) / 100;
  const nettHire = hireIncome - addCommAmt - brokerCommAmt;
  const nettRev = hireIncome + ballastBonus - addCommAmt - brokerCommAmt;

  const delHfoAmt = num(input.delHfoMt) * num(input.delHfoUsd);
  const delMdoAmt = num(input.delMgoMt) * num(input.delMgoUsd);
  const reDelHfoAmt = num(input.reDelHfoMt) * num(input.reDelHfoUsd);
  const reDelMdoAmt = num(input.reDelMgoMt) * num(input.reDelMgoUsd);
  const delTotal = hasBunkerGridData(input.deliveryBunkers)
    ? bunkerGridTotal(input.deliveryBunkers)
    : delHfoAmt + delMdoAmt;
  const reDelTotal = hasBunkerGridData(input.redeliveryBunkers)
    ? bunkerGridTotal(input.redeliveryBunkers)
    : reDelHfoAmt + reDelMdoAmt;
  const bunkerDiffAmt = delTotal - reDelTotal;

  let offHireDays = 0;
  let lessOffHire = num(input.lessOffHire);
  const offHires = Array.isArray(input.offHires) ? input.offHires : [];
  if (offHires.length) {
    lessOffHire = 0;
    for (const row of offHires) {
      let days = num(row.days);
      const hasFrom = hasDateValue(row.from);
      const hasTo = hasDateValue(row.to);
      // PHP getTimeDiff requires both dates; amount can still use manual days×rate.
      if (hasFrom && hasTo) {
        days = daysBetween(row.to, row.from);
      }
      // Utilisation off-hire days only when From is filled and timediff is computed (both dates).
      if (hasFrom && hasTo) {
        offHireDays += days;
      }
      const bunkerAmt = offHireBunkerTotal(row);
      // PHP: second loop always adds bunkers; first loop adds them again when From is set.
      lessOffHire += days * num(row.hireRate) + bunkerAmt;
      if (hasFrom) {
        lessOffHire += bunkerAmt;
      }
    }
  }

  const utilisationDays = tcDays - offHireDays;
  const netTcDays = utilisationDays;
  const netHirePerDay = netTcDays > 0 ? nettRev / netTcDays : 0;
  const hasCveMonth = input.cveMonth != null && String(input.cveMonth).trim() !== '';
  // PHP: empty txtCVEM → CVE amount 0 (do not keep a stale CVE_EST).
  const cve = hasCveMonth
    ? (num(input.cveMonth) / 30) * utilisationDays
    : (input.cveMonth != null ? 0 : num(input.cve));
  const otherIncome = num(input.otherIncome);
  const ilohcAmt = num(input.ilohcAmt ?? input.ilohcUsd);
  const nettHireInvoice = nettRev - lessOffHire + cve + bunkerDiffAmt + ilohcAmt;
  const totalRev = nettHireInvoice + otherIncome;
  const totalExp = num(input.totalExp);
  const voyageEarn = totalRev - totalExp;
  const profitPerDay = utilisationDays ? voyageEarn / utilisationDays : 0;

  return {
    hirePeriods: resolvedPeriods,
    hireIncome: hireIncome.toFixed(2),
    tcDays: String(Number(tcDays.toFixed(4))),
    offHireDays: String(Number(offHireDays.toFixed(4))),
    utilisationDays: String(Number(utilisationDays.toFixed(4))),
    netTcDays: String(Number(netTcDays.toFixed(4))),
    netHirePerDay: netHirePerDay.toFixed(2),
    delHfoAmt: delHfoAmt.toFixed(2),
    delMdoAmt: delMdoAmt.toFixed(2),
    reDelHfoAmt: reDelHfoAmt.toFixed(2),
    reDelMdoAmt: reDelMdoAmt.toFixed(2),
    delBunkerTotal: delTotal.toFixed(2),
    reDelBunkerTotal: reDelTotal.toFixed(2),
    bunkerDiffAmt: bunkerDiffAmt.toFixed(2),
    addCommAmt: addCommAmt.toFixed(2),
    brokerCommAmt: brokerCommAmt.toFixed(2),
    nettHire: nettHire.toFixed(2),
    nettRev: nettRev.toFixed(2),
    lessOffHire: lessOffHire.toFixed(2),
    cve: cve.toFixed(2),
    ballastBonus: ballastBonus.toFixed(2),
    ilohcAmt: ilohcAmt.toFixed(2),
    nettHireInvoice: nettHireInvoice.toFixed(2),
    totalRev: totalRev.toFixed(2),
    voyageEarn: voyageEarn.toFixed(2),
    profitPerDay: profitPerDay.toFixed(2),
  };
}
