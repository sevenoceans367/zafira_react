import { daysBetween, hasDateValue, parseTcDate } from '../../../services/tcEstimates.js';

export const EMPTY_TC_IN_HIRE = {
  deliveryDate: '',
  redeliveryDate: '',
  voyageDays: '',
  dailyHire: '',
  hireage: '',
  ballastBonus: '',
  grossHireage: '',
  addCommPct: '',
  addCommAmt: '',
  addCommVendor: '',
  brokerCommPct: '',
  brokerCommAmt: '',
  brokerVendor: '',
  nettHireage: '',
  cveMonth: '',
  cveAmt: '',
  randomId: '',
};

export const EMPTY_TC_IN_BUNKER = { bunkerId: '', qty: '', price: '', amount: '', bunkerDate: '' };
export const EMPTY_TC_IN_OFF = {
  reason: '',
  from: '',
  to: '',
  days: '',
  hireRate: '',
  amount: '',
  bunkers: [],
  bunkersOpen: false,
};

/**
 * If off-hire From/To falls inside a trip-schedule delivery→redelivery window,
 * return that leg's Hire ($/day) (may be blank). Otherwise null (no coincidence).
 */
export function matchedTripHireRateForOffHire({
  from = '',
  to = '',
  hirePeriods = [],
} = {}) {
  const anchor = parseTcDate(from) || parseTcDate(to);
  if (!anchor) return null;
  for (const period of hirePeriods || []) {
    const start = parseTcDate(period?.delDate || period?.deliveryDate);
    const end = parseTcDate(period?.reDelDate || period?.redeliveryDate);
    if (!start || !end) continue;
    if (anchor.getTime() >= start.getTime() && anchor.getTime() <= end.getTime()) {
      const rate = period?.hireRate ?? period?.dailyHire;
      return rate == null ? '' : String(rate);
    }
  }
  return null;
}

/** Map TC In hire rows into the shape matchedTripHireRateForOffHire expects. */
export function tcInHiresAsTripPeriods(hires = []) {
  return (hires || []).map((h) => ({
    delDate: h.delDate || h.deliveryDate || '',
    reDelDate: h.reDelDate || h.redeliveryDate || '',
    hireRate: h.hireRate ?? h.dailyHire ?? '',
  }));
}

/** Apply trip-schedule hire rates to off-hire rows whose dates fall in a trip leg. */
export function applyMatchedTripRatesToOffHires(offHires = [], hires = []) {
  const hirePeriods = tcInHiresAsTripPeriods(hires);
  return (offHires || []).map((row) => {
    const matched = matchedTripHireRateForOffHire({
      from: row.from,
      to: row.to,
      hirePeriods,
    });
    if (matched == null) return row;
    let days = Number(row.days) || 0;
    if (hasDateValue(row.from) && hasDateValue(row.to)) {
      days = daysBetween(row.to, row.from) || days;
    }
    return {
      ...row,
      hireRate: matched,
      days: days ? String(Number(days.toFixed(4))) : (row.days || ''),
      amount: (days * (Number(matched) || 0)).toFixed(2),
    };
  });
}
export const EMPTY_TC_IN_EXPENSE = {
  description: '',
  account: '',
  notes: '',
  addToTotal: false,
  amount: '',
  customer: '',
};
export const EMPTY_TC_IN_PRE_EXP = {
  ownerCharterer: '',
  description: '',
  amount: '',
  notes: '',
};
export const EMPTY_TC_IN_PERIOD = {
  terms: {
    // Parent-page / TcPeriodBlock keys
    laycanFrom: '',
    laycanTo: '',
    exchangeCurrency: 'USD',
    exchangeRate: '1',
    delRangePort: '',
    reDelRange: '',
    ballastBonus: '',
    cveMonth: '',
    ilohcUsd: '',
    addComm: '',
    brokerComm: '',
    broCommPayable: '',
    // Legacy aliases kept for calcs / older snapshots
    laycan: '',
    hireCurrency: 'USD',
    xrate: '1',
    delPort: '',
    reDelPort: '',
    ilohc: '',
    adComm: '',
    brokerage: '',
    brokeragePaidBy: '',
  },
  hires: [{ ...EMPTY_TC_IN_HIRE }],
  offHires: [{ ...EMPTY_TC_IN_OFF }],
};

/** Blank extension period — same shape/workflow as TC Out `emptyTcPeriodExtension()`. */
export function emptyTcInPeriodExtension() {
  return {
    terms: {
      ...EMPTY_TC_IN_PERIOD.terms,
      laycanFrom: '',
      laycanTo: '',
      exchangeCurrency: 'USD',
      exchangeRate: '1',
      delRangePort: '',
      reDelRange: '',
      ballastBonus: '',
      cveMonth: '',
      ilohcUsd: '',
      addComm: '',
      brokerComm: '',
      broCommPayable: '',
      hireCurrency: 'USD',
      xrate: '1',
      delPort: '',
      reDelPort: '',
      ilohc: '',
      adComm: '',
      brokerage: '',
      brokeragePaidBy: '',
    },
    hires: [{ ...EMPTY_TC_IN_HIRE }],
    offHires: [{ ...EMPTY_TC_IN_OFF }],
  };
}

/** Normalize period terms so TcPeriodBlock + calcs share one shape. */
export function normalizeTcInTerms(terms = {}) {
  const exchangeCurrency = terms.exchangeCurrency || terms.hireCurrency || 'USD';
  const exchangeRate = terms.exchangeRate ?? terms.xrate ?? '1';
  const delRangePort = terms.delRangePort || terms.delPort || '';
  const reDelRange = terms.reDelRange || terms.reDelPort || '';
  const ilohcUsd = terms.ilohcUsd || terms.ilohc || '';
  const addComm = terms.addComm || terms.adComm || '';
  const brokerComm = terms.brokerComm || terms.brokerage || '';
  const broCommPayable = terms.broCommPayable || terms.brokeragePaidBy || '';
  return {
    ...EMPTY_TC_IN_PERIOD.terms,
    ...terms,
    laycanFrom: terms.laycanFrom || '',
    laycanTo: terms.laycanTo || '',
    exchangeCurrency,
    exchangeRate,
    delRangePort,
    reDelRange,
    ballastBonus: terms.ballastBonus || '',
    cveMonth: terms.cveMonth || '',
    ilohcUsd,
    addComm,
    brokerComm,
    broCommPayable,
    hireCurrency: exchangeCurrency,
    xrate: exchangeRate,
    delPort: delRangePort,
    reDelPort: reDelRange,
    ilohc: ilohcUsd,
    adComm: addComm,
    brokerage: brokerComm,
    brokeragePaidBy: broCommPayable,
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function resolveHireRow(row = {}, opts = {}) {
  let voyageDays = num(row.voyageDays);
  // When keepDays is set (user edited Days), preserve voyageDays even if dates exist.
  if (
    !opts.keepDays
    && hasDateValue(row.deliveryDate)
    && hasDateValue(row.redeliveryDate)
  ) {
    voyageDays = daysBetween(row.redeliveryDate, row.deliveryDate);
  }
  const dailyHire = num(row.dailyHire);
  const hireage = dailyHire * voyageDays;
  const ballastBonus = num(row.ballastBonus);
  const grossHireage = hireage + ballastBonus;
  const addCommPct = num(row.addCommPct);
  const brokerCommPct = num(row.brokerCommPct);
  const addCommAmt = (grossHireage * addCommPct) / 100;
  const brokerCommAmt = (hireage * brokerCommPct) / 100;
  const nettHireage = grossHireage - addCommAmt - brokerCommAmt;
  const cveMonth = num(row.cveMonth);
  const cveAmt = ((cveMonth * 12) / 365) * voyageDays;
  return {
    ...row,
    voyageDays: voyageDays ? String(Number(voyageDays.toFixed(4))) : '',
    hireage: hireage.toFixed(2),
    grossHireage: grossHireage.toFixed(2),
    addCommAmt: addCommAmt.toFixed(2),
    brokerCommAmt: brokerCommAmt.toFixed(2),
    nettHireage: nettHireage.toFixed(2),
    cveAmt: cveAmt.toFixed(2),
  };
}

export function bunkerAmount(row = {}) {
  return (num(row.qty) * num(row.price)).toFixed(2);
}

export function bunkerRowHasValues(row = {}) {
  return Boolean(
    String(row.bunkerId || '').trim()
    || String(row.qty || '').trim()
    || String(row.price || '').trim()
    || String(row.amount || '').trim(),
  );
}

/** Same as TC Out: copy delivery bunker lines onto redelivery (dates use redelivery). */
export function copyDeliveryBunkersToRedelivery(deliveryRows = [], reDelDate = '') {
  const source = deliveryRows?.length ? deliveryRows : [{ ...EMPTY_TC_IN_BUNKER }];
  return source.map((row) => ({
    ...EMPTY_TC_IN_BUNKER,
    bunkerId: row.bunkerId != null && String(row.bunkerId).trim() !== '' ? String(row.bunkerId) : '',
    gradeName: row.gradeName || '',
    qty: row.qty || '',
    price: row.price || '',
    amount: row.amount || bunkerAmount(row),
    bunkerDate: reDelDate || '',
  }));
}

export function calcTcInFinalHireage(tcIn = {}) {
  const hires = (tcIn.hires || []).map(resolveHireRow);
  const delTotal = (tcIn.deliveryBunkers || []).reduce((s, r) => s + num(r.qty) * num(r.price), 0);
  const reDelTotal = (tcIn.redeliveryBunkers || []).reduce((s, r) => s + num(r.qty) * num(r.price), 0);
  let offHireDays = 0;
  let offHireAmt = 0;
  let ownerBunker = num(tcIn.bunkerOnOwner);
  const offHires = (tcIn.offHires || []).map((row) => {
    let days = num(row.days);
    const hasFrom = hasDateValue(row.from);
    const hasTo = hasDateValue(row.to);
    if (hasFrom && hasTo) {
      days = daysBetween(row.to, row.from);
    }
    const amount = days * num(row.hireRate);
    if (hasFrom) offHireDays += days;
    offHireAmt += amount;
    if (!tcIn.bunkerOnOwner && Array.isArray(row.bunkers)) {
      for (const bunker of row.bunkers) {
        if (bunker.onOwner || bunker.calc) {
          ownerBunker += (num(bunker.qty) * num(bunker.price)) || num(bunker.amount);
        }
      }
    }
    return {
      ...row,
      days: days ? String(Number(days.toFixed(4))) : '',
      amount: amount.toFixed(2),
    };
  });
  const offHireCveMonth = num(tcIn.offHireCveMonth);
  const offHireCveAmt = ((offHireCveMonth * 12) / 365) * offHireDays;
  const lessOffHire = offHireAmt + offHireCveAmt + ownerBunker;
  const nettPlusCve = hires.reduce((s, r) => s + num(r.nettHireage) + num(r.cveAmt), 0);
  const finalHireage = nettPlusCve
    + num(tcIn.awrpCost)
    + delTotal
    - reDelTotal
    - lessOffHire
    + num(tcIn.ilohc);
  return {
    hires,
    deliveryBunkers: (tcIn.deliveryBunkers || []).map((r) => ({ ...r, amount: bunkerAmount(r) })),
    redeliveryBunkers: (tcIn.redeliveryBunkers || []).map((r) => ({ ...r, amount: bunkerAmount(r) })),
    offHires,
    bunkerOnOwner: ownerBunker ? ownerBunker.toFixed(2) : (tcIn.bunkerOnOwner || ''),
    offHireCveAmt: offHireCveAmt.toFixed(2),
    lessOffHire: lessOffHire.toFixed(2),
    finalHireage: finalHireage.toFixed(2),
  };
}

/** Popup RHS only — does not replace parent Final TC In Hireage. */
export function calcTcInGrossHireExpense(tcIn = {}) {
  const period = (tcIn.periods && tcIn.periods[0]) || null;
  const terms = period?.terms || tcIn.terms || {};
  const hires = (period?.hires || tcIn.hires || []).map(resolveHireRow);
  const offHires = (period?.offHires || tcIn.offHires || []).map((row) => {
    let days = num(row.days);
    if (hasDateValue(row.from) && hasDateValue(row.to)) {
      days = daysBetween(row.to, row.from);
    }
    const amount = days * num(row.hireRate);
    let bunkerAmt = 0;
    for (const bunker of row.bunkers || []) {
      bunkerAmt += num(bunker.qty) * num(bunker.price) || num(bunker.amount);
    }
    return {
      ...row,
      days: days ? String(Number(days.toFixed(4))) : '',
      amount: amount.toFixed(2),
      bunkerAmt,
    };
  });

  const tripHire = hires.reduce((s, r) => s + num(r.hireage), 0);
  const tripDays = hires.reduce((s, r) => s + num(r.voyageDays), 0);
  const totalHirePayable = tripHire
    + num(terms.ballastBonus ?? tcIn.ballastBonus)
    + num(terms.cveMonth ?? tcIn.cveMonth)
    + num(terms.ilohcUsd ?? terms.ilohc ?? tcIn.ilohc);

  const lessOffHire = offHires.reduce((s, r) => s + num(r.amount) + num(r.bunkerAmt), 0);
  const offHireDays = offHires.reduce((s, r) => s + num(r.days), 0);
  const netHireExpense = totalHirePayable - lessOffHire;
  const netTcDays = tripDays - offHireDays;
  const netHirePerDay = netTcDays > 0 ? netHireExpense / netTcDays : 0;

  const preTcTotal = (tcIn.preTc?.expenses || []).reduce((s, r) => s + num(r.amount), 0);
  const tcExpensesTotal = (tcIn.expenses || [])
    .filter((r) => r.addToTotal === true)
    .reduce((s, r) => s + num(r.amount), 0);
  const grossHireExpense = netHireExpense + preTcTotal + tcExpensesTotal;

  return {
    totalHirePayable: totalHirePayable.toFixed(2),
    lessOffHire: lessOffHire.toFixed(2),
    netTcDays: netTcDays ? String(Number(netTcDays.toFixed(4))) : '0',
    netHirePerDay: netHirePerDay.toFixed(2),
    netHireExpense: netHireExpense.toFixed(2),
    preTcTotal: preTcTotal.toFixed(2),
    tcExpensesTotal: tcExpensesTotal.toFixed(2),
    grossHireExpense: grossHireExpense.toFixed(2),
    tripDays: tripDays ? String(Number(tripDays.toFixed(4))) : '0',
    tripHireAmt: tripHire.toFixed(2),
  };
}

export function syncPeriodOneToLegacy(tcIn = {}) {
  const period0 = (tcIn.periods && tcIn.periods[0]) || null;
  if (!period0) {
    return {
      ...tcIn,
      hires: (tcIn.hires || []).map(resolveHireRow),
      offHires: tcIn.offHires || [{ ...EMPTY_TC_IN_OFF }],
    };
  }
  const terms = normalizeTcInTerms(period0.terms || {});
  const periods = [...(tcIn.periods || [])];
  periods[0] = { ...period0, terms };
  return {
    ...tcIn,
    periods,
    terms,
    hires: (period0.hires || []).map(resolveHireRow),
    offHires: period0.offHires?.length ? period0.offHires : [{ ...EMPTY_TC_IN_OFF }],
    cpDate: tcIn.identifiers?.cpDate || tcIn.cpDate || '',
    contractRef: tcIn.contractRef || '',
    deliveryPort: terms.delRangePort || terms.delPort || tcIn.deliveryPort || '',
    redeliveryPort: terms.reDelRange || terms.reDelPort || tcIn.redeliveryPort || '',
    ilohc: terms.ilohcUsd || terms.ilohc || tcIn.ilohc || '',
    ballastBonus: terms.ballastBonus || tcIn.ballastBonus || '',
  };
}

export function hasSavedTcInRecap(tcIn) {
  if (!tcIn) return false;
  if (tcIn.recapVersion) return true;
  if (tcIn.identifiers || tcIn.terms || tcIn.periods || tcIn.expenses || tcIn.preTc) return true;
  return Boolean(tcIn?.hires?.some((row) => (
    (row.dailyHire != null && String(row.dailyHire).trim() !== '')
    || (row.deliveryDate != null && String(row.deliveryDate).trim() !== '')
    || (row.hireage != null && String(row.hireage).trim() !== '' && Number(row.hireage) !== 0)
  )));
}

function copyParentVoyageTerms(detail = {}) {
  return {
    windForce: detail.windForce || '',
    speedLaden: detail.speedLaden || detail.speedL || '',
    speedBallast: detail.speedBallast || detail.speedB || '',
    cpSpeed: detail.cpSpeed || '',
    foConsLaden: detail.foConsLaden || '',
    doConsLaden: detail.doConsLaden || '',
    foConsBallast: detail.foConsBallast || '',
    doConsBallast: detail.doConsBallast || '',
    foConsLdg: detail.foConsLdg || '',
    doConsLdg: detail.doConsLdg || '',
    foConsDisch: detail.foConsDisch || '',
    doConsDisch: detail.doConsDisch || '',
    foConsIdle: detail.foConsIdle || '',
    doConsIdle: detail.doConsIdle || '',
    loadRate: detail.loadRate || '',
    dischRate: detail.dischRate || '',
  };
}

/** Snapshot of TC Out Vessel Particulars (same keys / labels as the parent page). */
export function copyParentParticulars(detail = {}) {
  const mastersName = detail.mastersName || detail.masterName || '';
  const vesselCode = detail.vesselCode || detail.vesselImoId || '';
  const flag = detail.flag1 || detail.flag || detail.portOfReg || '';
  const loa1 = detail.loa1 || detail.loa || '';
  const breadth = detail.breadth || detail.extremeBreadth || '';
  const grossTonn = detail.grossTonn || detail.grt || '';
  const netTonn = detail.netTonn || detail.nrt || '';
  const cargoTankCap = detail.cargoTankCap || detail.cargoTkCap || '';
  const noOfCargoPumps = detail.noOfCargoPumps || detail.noOfCargoPump || '';
  const totalSbtCap = detail.totalSbtCap || detail.sbtCap || '';
  const cargoPumpCap = detail.cargoPumpCap || detail.cargoPpCap || '';
  return {
    mastersName,
    // Legacy alias kept so older snapshots still round-trip.
    masterName: mastersName,
    vesselCode,
    imoNo: detail.imoNo || '',
    yearBuild: detail.yearBuild || detail.builtYear || '',
    flag,
    flag1: flag,
    summerDwt: detail.summerDwt || detail.dwtSummer || '',
    summerDraft: detail.summerDraft || '',
    loa1,
    loa: loa1,
    breadth,
    extremeBreadth: breadth,
    grossTonn,
    grt: grossTonn,
    netTonn,
    nrt: netTonn,
    cargoTankCap,
    cargoTkCap: cargoTankCap,
    noOfGrades: detail.noOfGrades || '',
    noOfCargoPumps,
    noOfCargoPump: noOfCargoPumps,
    totalSbtCap,
    sbtCap: totalSbtCap,
    cargoPumpCap,
    cargoPpCap: cargoPumpCap,
  };
}

/** Prefer saved snapshot values; fill blanks from parent TC Out. */
export function mergeVesselParticulars(saved = {}, detail = {}) {
  const parent = copyParentParticulars(detail);
  const out = { ...parent };
  for (const [key, value] of Object.entries(saved || {})) {
    if (value != null && String(value).trim() !== '') out[key] = value;
  }
  // Keep dual keys in sync when only one side was saved.
  const mastersName = out.mastersName || out.masterName || parent.mastersName;
  out.mastersName = mastersName;
  out.masterName = mastersName;
  out.loa1 = out.loa1 || out.loa || parent.loa1;
  out.loa = out.loa1;
  out.breadth = out.breadth || out.extremeBreadth || parent.breadth;
  out.extremeBreadth = out.breadth;
  out.grossTonn = out.grossTonn || out.grt || parent.grossTonn;
  out.grt = out.grossTonn;
  out.netTonn = out.netTonn || out.nrt || parent.netTonn;
  out.nrt = out.netTonn;
  out.flag = out.flag1 || out.flag || parent.flag;
  out.flag1 = out.flag;
  out.cargoTankCap = out.cargoTankCap || out.cargoTkCap || parent.cargoTankCap;
  out.cargoTkCap = out.cargoTankCap;
  out.noOfCargoPumps = out.noOfCargoPumps || out.noOfCargoPump || parent.noOfCargoPumps;
  out.noOfCargoPump = out.noOfCargoPumps;
  out.totalSbtCap = out.totalSbtCap || out.sbtCap || parent.totalSbtCap;
  out.sbtCap = out.totalSbtCap;
  out.cargoPumpCap = out.cargoPumpCap || out.cargoPpCap || parent.cargoPumpCap;
  out.cargoPpCap = out.cargoPumpCap;
  out.vesselCode = out.vesselCode || parent.vesselCode;
  return out;
}

/** Build modal draft: prefer saved recap; else prefill from parent TC Out. */
export function buildTcInRecapDraft(detail = {}, existing = null) {
  if (existing?.recapVersion || existing?.identifiers || existing?.periods) {
    const periods = existing.periods?.length
      ? existing.periods.map((p) => ({
        ...EMPTY_TC_IN_PERIOD,
        ...p,
        terms: normalizeTcInTerms({ ...EMPTY_TC_IN_PERIOD.terms, ...(p.terms || existing.terms || {}) }),
        hires: (p.hires?.length ? p.hires : [{ ...EMPTY_TC_IN_HIRE }]).map((r) => ({ ...EMPTY_TC_IN_HIRE, ...r })),
        offHires: (p.offHires?.length ? p.offHires : [{ ...EMPTY_TC_IN_OFF }]).map((r) => ({ ...EMPTY_TC_IN_OFF, ...r })),
      }))
      : [{
        ...EMPTY_TC_IN_PERIOD,
        terms: normalizeTcInTerms({ ...EMPTY_TC_IN_PERIOD.terms, ...(existing.terms || {}) }),
        hires: existing.hires?.length
          ? existing.hires.map((r) => ({ ...EMPTY_TC_IN_HIRE, ...r }))
          : [{ ...EMPTY_TC_IN_HIRE }],
        offHires: existing.offHires?.length
          ? existing.offHires.map((r) => ({ ...EMPTY_TC_IN_OFF, ...r }))
          : [{ ...EMPTY_TC_IN_OFF }],
      }];
    const synced = syncPeriodOneToLegacy({
      ...existing,
      periods,
      deliveryBunkers: existing.deliveryBunkers?.length
        ? existing.deliveryBunkers.map((r) => ({ ...EMPTY_TC_IN_BUNKER, ...r }))
        : [{ ...EMPTY_TC_IN_BUNKER }],
      redeliveryBunkers: existing.redeliveryBunkers?.length
        ? existing.redeliveryBunkers.map((r) => ({ ...EMPTY_TC_IN_BUNKER, ...r }))
        : [{ ...EMPTY_TC_IN_BUNKER }],
      vesselParticulars: mergeVesselParticulars(existing.vesselParticulars, detail),
    });
    return { recapVersion: 1, ...synced };
  }

  const hirePeriods = detail.hirePeriods?.length
    ? detail.hirePeriods
    : [{
      delDate: detail.delDate || '',
      reDelDate: detail.reDelDate || '',
      days: detail.durFixPer || '',
      hireRate: detail.hireFixPer || '',
    }];

  // Copy trip schedule from parent TC Out; leave Hire ($/day) blank by design.
  const hires = hirePeriods.map((row) => resolveHireRow({
    ...EMPTY_TC_IN_HIRE,
    deliveryDate: row.delDate || row.deliveryDate || '',
    redeliveryDate: row.reDelDate || row.redeliveryDate || '',
    voyageDays: row.days || row.voyageDays || '',
    dailyHire: '',
    hireRate: '',
    addCommPct: detail.addComm || '',
    ballastBonus: '',
    brokerCommPct: '',
    cveMonth: detail.cveMonth || '',
  }));

  // Copy Off Hire (+ nested bunkers) from parent TC Out; Rate/Day follows trip schedule when dates coincide.
  const tripPeriodsForMatch = hires.map((h) => ({
    delDate: h.deliveryDate || '',
    reDelDate: h.redeliveryDate || '',
    hireRate: h.dailyHire || h.hireRate || '',
  }));
  const offHires = (detail.offHires?.length ? detail.offHires : [{ ...EMPTY_TC_IN_OFF }]).map((row) => {
    const bunkers = (row.bunkers || []).map((b) => ({
      ...EMPTY_TC_IN_BUNKER,
      ...b,
      amount: bunkerAmount(b),
    }));
    const matched = matchedTripHireRateForOffHire({
      from: row.from,
      to: row.to,
      hirePeriods: tripPeriodsForMatch,
    });
    // When dates fall in a trip leg, use that leg's Hire ($/day) (often blank until user fills it).
    // Otherwise keep the TC Out off-hire rate.
    const hireRate = matched != null
      ? matched
      : (row.hireRate || detail.hireFixPer || '');
    let days = Number(row.days) || 0;
    if (hasDateValue(row.from) && hasDateValue(row.to)) {
      days = daysBetween(row.to, row.from) || days;
    }
    return {
      ...EMPTY_TC_IN_OFF,
      ...row,
      hireRate,
      days: days ? String(Number(days.toFixed(4))) : (row.days || ''),
      amount: (days * (Number(hireRate) || 0)).toFixed(2),
      bunkers,
      bunkersOpen: bunkers.length > 0 || Boolean(row.bunkersOpen),
    };
  });

  // Copy Delivery + Redelivery bunkers from parent TC Out (same pattern as main page).
  const deliveryBunkers = (detail.deliveryBunkers?.length
    ? detail.deliveryBunkers
    : [{ ...EMPTY_TC_IN_BUNKER }]).map((r) => ({
    ...EMPTY_TC_IN_BUNKER,
    ...r,
    amount: bunkerAmount(r),
  }));
  const parentRedelivery = detail.redeliveryBunkers || [];
  const redeliveryHasValues = parentRedelivery.some(bunkerRowHasValues);
  const lastHire = (detail.hirePeriods || []).length
    ? detail.hirePeriods[detail.hirePeriods.length - 1]
    : null;
  const reDelDate = lastHire?.reDelDate || detail.reDelDate || '';
  const redeliveryBunkers = redeliveryHasValues
    ? parentRedelivery.map((r) => ({
      ...EMPTY_TC_IN_BUNKER,
      ...r,
      amount: bunkerAmount(r),
    }))
    : copyDeliveryBunkersToRedelivery(deliveryBunkers, reDelDate);

  // Copy TC Terms from parent TC Out except Laycan + Brokerage Paid By (blank by design).
  const terms = normalizeTcInTerms({
    laycanFrom: '',
    laycanTo: '',
    exchangeCurrency: detail.exchangeCurrency || detail.hireCurrency || 'USD',
    exchangeRate: detail.exchangeRate || detail.xrate || '1',
    delRangePort: detail.delRangePort || '',
    reDelRange: detail.reDelRange || '',
    cveMonth: detail.cveMonth || '',
    ilohcUsd: detail.ilohcUsd || detail.ilohc || '',
    ballastBonus: detail.ballastBonus || '',
    addComm: detail.addComm || '',
    brokerComm: detail.brokerComm || '',
    broCommPayable: '',
  });

  const draft = {
    recapVersion: 1,
    identifiers: {
      contractType: 'tcin',
      businessType: detail.businessTypeName || detail.businessType || '',
      vessel: detail.vesselName || '',
      vesselType: detail.vesselType || '',
      // Copy CP Date + PIC/team from main TC Out recap (no TC No. / Est No. in popup)
      cpDate: detail.cpDate || '',
      charteringTeam: detail.charteringTeam || '',
      charteringPic: detail.charteringPic1 || detail.charteringPic || '',
      opsPic: detail.charOperation || detail.charteringPic2 || detail.opsPic || '',
    },
    cp: {
      cpType: '',
      lawArbit: '',
      headOwners: '',
      address: '',
    },
    terms,
    periods: [{
      ...EMPTY_TC_IN_PERIOD,
      terms: { ...terms },
      hires: hires.length ? hires : [{ ...EMPTY_TC_IN_HIRE }],
      offHires: offHires.length ? offHires : [{ ...EMPTY_TC_IN_OFF }],
    }],
    expenses: [{ ...EMPTY_TC_IN_EXPENSE }],
    vesselParticulars: copyParentParticulars(detail),
    preTc: {
      itinerary: {
        from: { place: '', dateTime: '', notes: '' },
        to: { place: '', dateTime: '', notes: '' },
      },
      expenses: [{ ...EMPTY_TC_IN_PRE_EXP }],
    },
    deliveryBunkers,
    redeliveryBunkers,
    voyageTerms: copyParentVoyageTerms(detail),
    additionalInfo: '',
    documents: [],
    attachmentFiles: [],
    // legacy Final Hireage fields
    hires: hires.length ? hires : [{ ...EMPTY_TC_IN_HIRE }],
    offHires: offHires.length ? offHires : [{ ...EMPTY_TC_IN_OFF }],
    cpDate: '',
    contractRef: '',
    deliveryPort: terms.delPort,
    redeliveryPort: terms.reDelPort,
    offHireCveMonth: existing?.offHireCveMonth || '',
    bunkerOnOwner: existing?.bunkerOnOwner || '',
    ilohc: terms.ilohc,
    awrpCost: existing?.awrpCost || '',
    finalVendor: existing?.finalVendor || '',
    finalHireage: existing?.finalHireage || '0.00',
  };

  // Legacy slave-only existing without recapVersion: merge hire/bunker/offhire
  if (existing?.hires?.length && !existing.recapVersion) {
    draft.hires = existing.hires.map((r) => ({ ...EMPTY_TC_IN_HIRE, ...r }));
    draft.periods[0].hires = draft.hires;
    draft.deliveryBunkers = existing.deliveryBunkers?.length
      ? existing.deliveryBunkers.map((r) => ({ ...EMPTY_TC_IN_BUNKER, ...r }))
      : draft.deliveryBunkers;
    draft.redeliveryBunkers = existing.redeliveryBunkers?.length
      ? existing.redeliveryBunkers.map((r) => ({ ...EMPTY_TC_IN_BUNKER, ...r }))
      : draft.redeliveryBunkers;
    draft.offHires = existing.offHires?.length
      ? existing.offHires.map((r) => ({ ...EMPTY_TC_IN_OFF, ...r }))
      : draft.offHires;
    draft.periods[0].offHires = draft.offHires;
    draft.cpDate = existing.cpDate || '';
    draft.contractRef = existing.contractRef || '';
    draft.offHireCveMonth = existing.offHireCveMonth || '';
    draft.bunkerOnOwner = existing.bunkerOnOwner || '';
    draft.ilohc = existing.ilohc || draft.ilohc;
    draft.awrpCost = existing.awrpCost || '';
    draft.finalVendor = existing.finalVendor || '';
  }

  return draft;
}
