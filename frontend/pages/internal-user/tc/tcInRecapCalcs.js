import { daysBetween, hasDateValue } from '../../../services/tcEstimates.js';

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
};
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
    laycan: '',
    hireCurrency: 'USD',
    xrate: '1',
    delPort: '',
    reDelPort: '',
    cveMonth: '',
    ilohc: '',
    ballastBonus: '',
    adComm: '',
    brokerage: '',
    brokeragePaidBy: '',
  },
  hires: [{ ...EMPTY_TC_IN_HIRE }],
  offHires: [{ ...EMPTY_TC_IN_OFF }],
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function resolveHireRow(row = {}) {
  let voyageDays = num(row.voyageDays);
  if (hasDateValue(row.deliveryDate) && hasDateValue(row.redeliveryDate)) {
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
    + num(terms.ilohc ?? tcIn.ilohc);

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
  const terms = period0.terms || {};
  return {
    ...tcIn,
    terms,
    hires: (period0.hires || []).map(resolveHireRow),
    offHires: period0.offHires?.length ? period0.offHires : [{ ...EMPTY_TC_IN_OFF }],
    cpDate: tcIn.identifiers?.cpDate || tcIn.cpDate || '',
    contractRef: tcIn.identifiers?.tcNo || tcIn.contractRef || '',
    deliveryPort: terms.delPort || tcIn.deliveryPort || '',
    redeliveryPort: terms.reDelPort || tcIn.redeliveryPort || '',
    ilohc: terms.ilohc || tcIn.ilohc || '',
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

function copyParentParticulars(detail = {}) {
  return {
    masterName: detail.masterName || detail.mastersName || '',
    vesselCode: detail.vesselCode || '',
    imoNo: detail.imoNo || '',
    yearBuild: detail.yearBuild || detail.builtYear || '',
    flag: detail.flag || detail.flag1 || detail.portOfReg || '',
    summerDwt: detail.summerDwt || detail.dwtSummer || '',
    summerDraft: detail.summerDraft || '',
    loa: detail.loa || '',
    extremeBreadth: detail.extremeBreadth || detail.breadth || '',
    grt: detail.grt || '',
    nrt: detail.nrt || '',
    cargoTkCap: detail.cargoTkCap || '',
    noOfGrades: detail.noOfGrades || '',
    noOfCargoPump: detail.noOfCargoPump || '',
    sbtCap: detail.sbtCap || '',
    cargoPpCap: detail.cargoPpCap || '',
  };
}

/** Build modal draft: prefer saved recap; else prefill from parent TC Out. */
export function buildTcInRecapDraft(detail = {}, existing = null) {
  if (existing?.recapVersion || existing?.identifiers || existing?.periods) {
    const synced = syncPeriodOneToLegacy({
      ...existing,
      periods: existing.periods?.length
        ? existing.periods
        : [{
          ...EMPTY_TC_IN_PERIOD,
          terms: { ...EMPTY_TC_IN_PERIOD.terms, ...(existing.terms || {}) },
          hires: existing.hires?.length
            ? existing.hires.map((r) => ({ ...EMPTY_TC_IN_HIRE, ...r }))
            : [{ ...EMPTY_TC_IN_HIRE }],
          offHires: existing.offHires?.length
            ? existing.offHires.map((r) => ({ ...EMPTY_TC_IN_OFF, ...r }))
            : [{ ...EMPTY_TC_IN_OFF }],
        }],
      deliveryBunkers: existing.deliveryBunkers?.length
        ? existing.deliveryBunkers.map((r) => ({ ...EMPTY_TC_IN_BUNKER, ...r }))
        : [{ ...EMPTY_TC_IN_BUNKER }],
      redeliveryBunkers: existing.redeliveryBunkers?.length
        ? existing.redeliveryBunkers.map((r) => ({ ...EMPTY_TC_IN_BUNKER, ...r }))
        : [{ ...EMPTY_TC_IN_BUNKER }],
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

  const hires = hirePeriods.map((row) => resolveHireRow({
    ...EMPTY_TC_IN_HIRE,
    deliveryDate: row.delDate || row.deliveryDate || '',
    redeliveryDate: row.reDelDate || row.redeliveryDate || '',
    voyageDays: row.days || row.voyageDays || '',
    dailyHire: row.hireRate || row.dailyHire || detail.hireFixPer || '',
    addCommPct: detail.addComm || '',
    ballastBonus: '',
    brokerCommPct: '',
    cveMonth: detail.cveMonth || '',
  }));

  const offHires = (detail.offHires?.length ? detail.offHires : [{ ...EMPTY_TC_IN_OFF }]).map((row) => ({
    ...EMPTY_TC_IN_OFF,
    ...row,
    hireRate: row.hireRate || detail.hireFixPer || '',
    bunkers: (row.bunkers || []).map((b) => ({ ...EMPTY_TC_IN_BUNKER, ...b })),
  }));

  const deliveryBunkers = (detail.deliveryBunkers?.length
    ? detail.deliveryBunkers
    : [{ ...EMPTY_TC_IN_BUNKER }]).map((r) => ({ ...EMPTY_TC_IN_BUNKER, ...r }));
  const redeliveryBunkers = deliveryBunkers.map((row) => ({
    ...EMPTY_TC_IN_BUNKER,
    bunkerId: row.bunkerId || '',
    qty: row.qty || '',
    price: '',
    amount: '',
    bunkerDate: '',
  }));

  const terms = {
    ...EMPTY_TC_IN_PERIOD.terms,
    laycan: '',
    hireCurrency: detail.exchangeCurrency || detail.hireCurrency || 'USD',
    xrate: detail.exchangeRate || detail.xrate || '1',
    delPort: detail.delRangePort || '',
    reDelPort: detail.reDelRange || '',
    cveMonth: detail.cveMonth || '',
    ilohc: detail.ilohcUsd || detail.ilohc || '',
    ballastBonus: detail.ballastBonus || '',
    adComm: detail.addComm || '',
    brokerage: detail.brokerComm || '',
    brokeragePaidBy: '',
  };

  const draft = {
    recapVersion: 1,
    identifiers: {
      contractType: 'tcin',
      businessType: detail.businessTypeName || detail.businessType || '',
      vessel: detail.vesselName || '',
      vesselType: detail.vesselType || '',
      cpDate: '',
      tcNo: '',
      estNo: '',
      charteringTeam: detail.charteringTeam || '',
      charteringPic: detail.charteringPic1 || detail.charteringPic || '',
      opsPic: detail.charteringPic2 || detail.opsPic || '',
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
