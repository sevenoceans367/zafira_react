import {
  BUNKER_ACTIVITY_SEED_FIELDS,
  PORT_BUNKER_GRADE_OPTIONS,
  createEmptyBunkerActivityRow,
  createEmptyDeliveryBunkerRow,
  createEmptyHireRow,
  createEmptyOffHireRow,
  createEmptyPortLeg,
  createEmptySecaBunkerRow,
} from './estimateDetail.constants.js';
import { classifyBunkerGradeName } from './estimateCalculations.js';

const PORT_BUNKER_GRADE_ORDER = PORT_BUNKER_GRADE_OPTIONS.map((option) => option.value);

/**
 * PHP vessel select (options.php?id=42): Port Details bunker grades follow FO/DO
 * consumption rows from commercial parameters — typically VLSFO + LSMGO.
 */
export function derivePortBunkerGrades(consumptionRows = [], bunkerGrades = []) {
  const gradeById = Object.fromEntries(
    (bunkerGrades || []).map((grade) => [String(grade.id), grade.name || '']),
  );
  const seen = new Set();

  const addGrade = (rawKey) => {
    const key = rawKey === 'HSFO+SCRUBBER' ? 'HSFO+SCRUBBER' : rawKey;
    if (!key || seen.has(key)) return;
    if (!PORT_BUNKER_GRADE_ORDER.includes(key)) return;
    seen.add(key);
  };

  for (const row of consumptionRows || []) {
    const name = gradeById[String(row.bunkerGradeId)] || '';
    let key = classifyBunkerGradeName(name);
    const identify = String(row.identify || 'FO').toUpperCase();
    if (!key) key = identify === 'DO' ? 'LSMGO' : 'VLSFO';
    addGrade(key);
  }

  const hasFo = (consumptionRows || []).some((row) => String(row.identify || 'FO').toUpperCase() === 'FO');
  const hasDo = (consumptionRows || []).some((row) => String(row.identify || '').toUpperCase() === 'DO');
  if (hasFo) addGrade('VLSFO');
  if (hasDo) addGrade('LSMGO');

  if (!seen.size) return ['VLSFO', 'LSMGO'];
  return PORT_BUNKER_GRADE_ORDER.filter((grade) => seen.has(grade));
}

function resolveActivityPrice(bunkerGrade, market = {}) {
  const upper = String(bunkerGrade || '').toUpperCase();
  if (upper.includes('LSMGO') || upper.includes('MGO')) {
    return market.marineGasOil || market.vlsfo || '';
  }
  return market.vlsfo || market.marineGasOil || '';
}

function hasPositiveRate(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n !== 0;
}

function isDoGrade(identify, bunkerType, bunkerName) {
  const id = String(identify || '').toUpperCase();
  if (id === 'DO') return true;
  const name = String(bunkerName || '').toUpperCase();
  const type = String(bunkerType || '').toUpperCase();
  return name.includes('LSMGO')
    || name.includes('MDO')
    || (name.includes('MGO') && !name.includes('VLSFO'))
    || name === 'DO'
    || ['MDO', 'DO', 'MGO', 'LSDO', 'ULSDO', 'LSMGO'].includes(type);
}

export function classifyConsumptionIdentify(row, bunkerGrades = []) {
  const grade = (bunkerGrades || []).find((item) => String(item.id) === String(row?.bunkerGradeId));
  return isDoGrade(row?.identify, grade?.bunkerType, grade?.name) ? 'DO' : 'FO';
}

function resolveGradeOption(bunkerName) {
  const upper = String(bunkerName || '').toUpperCase();
  if (upper.includes('LSMGO') || (upper.includes('MGO') && !upper.includes('VLSFO'))) {
    return 'LSMGO';
  }
  if (upper.includes('HSFO') || upper.includes('SCRUBBER')) return 'HSFO+SCRUBBER';
  if (upper.includes('VLSFO')) return 'VLSFO';
  return bunkerName || 'VLSFO';
}

function isVlsfoRate(row) {
  return /vlsfo/i.test(String(row?.bunkerName || ''));
}

function isLsmgoRate(row) {
  const name = String(row?.bunkerName || '');
  return /lsmgo/i.test(name) || (/mgo/i.test(name) && !/vlsfo/i.test(name));
}

/** Merge Seca / Non-Seca various rows for the same bunker grade (prefer non-empty). */
function mergeVariousByGrade(variousRates = []) {
  const map = new Map();
  for (const row of variousRates) {
    const name = String(row.bunkerName || '').trim();
    if (!name) continue;
    const key = name.toUpperCase();
    if (!map.has(key)) {
      map.set(key, { ...row, bunkerName: name });
      continue;
    }
    const target = map.get(key);
    for (const { field } of BUNKER_ACTIVITY_SEED_FIELDS) {
      if (!hasPositiveRate(target[field]) && hasPositiveRate(row[field])) {
        target[field] = row[field];
      }
    }
  }
  return [...map.values()];
}

/**
 * Mirror PHP js/common.js addBunkerVariousItems(): for VLSFO then LSMGO,
 * add one Activity row per non-zero Bunkers Various rate. Qty stays empty
 * (user / voyage calc fills it); price uses market like PHP oilPrices.
 */
export function buildBunkerActivityRowsFromVariousRates(variousRates = [], market = {}) {
  const merged = mergeVariousByGrade(variousRates);
  const rows = [];

  const appendForGrade = (rate) => {
    if (!rate) return;
    const grade = resolveGradeOption(rate.bunkerName);
    const price = resolveActivityPrice(grade, market);
    for (const { activity, field } of BUNKER_ACTIVITY_SEED_FIELDS) {
      if (!hasPositiveRate(rate[field])) continue;
      rows.push(createEmptyBunkerActivityRow({
        activity,
        bunkerGrade: grade,
        qty: '',
        price,
        amount: '',
      }));
    }
  };

  appendForGrade(merged.find(isVlsfoRate));
  appendForGrade(merged.find(isLsmgoRate));

  if (rows.length) return rows;

  const fallbackGrade = resolveGradeOption(merged[0]?.bunkerName || 'VLSFO');
  return [createEmptyBunkerActivityRow({
    activity: 'Cold Wash',
    bunkerGrade: fallbackGrade,
    price: resolveActivityPrice(fallbackGrade, market),
    qty: '',
  })];
}

export function applyVesselPrefillToForm(current, prefill, lookups = {}) {
  if (!prefill) return current;

  const market = lookups.marketPrices || {};
  const portLegs = [...(current.portLegs || [])];
  if (prefill.toPort) {
    if (!portLegs.length) portLegs.push(createEmptyPortLeg());
    const first = { ...portLegs[0] };
    if (!first.fromPortId) {
      first.fromPortId = String(prefill.toPort);
      first.fromPortName = prefill.toPortName || first.fromPortName || '';
      portLegs[0] = first;
    }
  }

  let secaBunkerRows = current.secaBunkerRows || [];
  if (market.vlsfo || market.marineGasOil) {
    if (!secaBunkerRows.length) {
      secaBunkerRows = [createEmptySecaBunkerRow('SECA', 'FO')];
    }
    secaBunkerRows = secaBunkerRows.map((row) => {
      if (row.price) return row;
      const isDo = String(row.bunkerType || '').toUpperCase() === 'DO'
        || /mgo|do/i.test(String(row.identify || ''));
      const price = isDo ? (market.marineGasOil || market.vlsfo) : (market.vlsfo || market.marineGasOil);
      return price ? { ...row, price: String(price) } : row;
    });
  }

  const variousRates = Array.isArray(prefill.variousBunkerRates) ? prefill.variousBunkerRates : [];
  // Always rebuild on vessel select (PHP addBunkerVariousItems after commercial load).
  const bunkerActivityRows = buildBunkerActivityRowsFromVariousRates(variousRates, market);

  const consumptionRows = (Array.isArray(prefill.consumptionRows) && prefill.consumptionRows.length
    ? prefill.consumptionRows
    : current.consumptionRows
  ).map((row) => ({
    ...row,
    identify: classifyConsumptionIdentify(row, lookups.bunkerGrades || current._bunkerGrades || []),
  }));
  const portBunkerGrades = derivePortBunkerGrades(
    consumptionRows,
    lookups.bunkerGrades || current._bunkerGrades || [],
  );
  const portLegsWithBunkerGrades = portLegs.map((leg) => ({
    ...leg,
    lpBunkerGrades: portBunkerGrades,
    dpBunkerGrades: portBunkerGrades,
    tpBunkerGrades: portBunkerGrades,
  }));

  return {
    ...current,
    vesselImoId: prefill.vesselImoId || current.vesselImoId,
    vesselName: prefill.vesselName || current.vesselName,
    vesselType: prefill.vesselType || current.vesselType,
    flag: prefill.flag || current.flag,
    dwtSummer: prefill.dwtSummer || current.dwtSummer,
    dwtTropical: prefill.dwtTropical || current.dwtTropical,
    gnrt: prefill.gnrt || current.gnrt,
    nrt: prefill.nrt || current.nrt,
    loa: prefill.loa || current.loa,
    beam: prefill.beam || current.beam,
    gear: prefill.gear || current.gear,
    builtYear: prefill.builtYear || current.builtYear,
    tpc: prefill.tpc || current.tpc,
    grainCap: prefill.grainCap || current.grainCap,
    baleCap: prefill.baleCap || current.baleCap,
    loadable: prefill.loadable || prefill.dwtSummer || current.loadable,
    bFullSpeed: prefill.bFullSpeed || current.bFullSpeed,
    bEcoSpeed1: prefill.bEcoSpeed1 || current.bEcoSpeed1,
    bEcoSpeed2: prefill.bEcoSpeed2 || current.bEcoSpeed2,
    lFullSpeed: prefill.lFullSpeed || current.lFullSpeed,
    lEcoSpeed1: prefill.lEcoSpeed1 || current.lEcoSpeed1,
    lEcoSpeed2: prefill.lEcoSpeed2 || current.lEcoSpeed2,
    bFoFullSpeed: prefill.bFoFullSpeed || current.bFoFullSpeed,
    lFoFullSpeed: prefill.lFoFullSpeed || current.lFoFullSpeed,
    bDoFullSpeed: prefill.bDoFullSpeed || current.bDoFullSpeed,
    lDoFullSpeed: prefill.lDoFullSpeed || current.lDoFullSpeed,
    pIfoFullSpeed: prefill.pIfoFullSpeed || current.pIfoFullSpeed,
    pWfoFullSpeed: prefill.pWfoFullSpeed || current.pWfoFullSpeed,
    pIdoFullSpeed: prefill.pIdoFullSpeed || current.pIdoFullSpeed,
    pWdoFullSpeed: prefill.pWdoFullSpeed || current.pWdoFullSpeed,
    consumptionRows,
    variousBunkerRates: variousRates.length ? variousRates : (current.variousBunkerRates || []),
    bunkerActivityRows,
    portLegs: portLegsWithBunkerGrades,
    secaBunkerRows,
    euaPrice: current.euaPrice || market.euaPrice || '',
    sdrToUsd: current.sdrToUsd || market.sdrToUsd || '',
  };
}

export function applyPeriodPrefillToForm(current, periodData) {
  if (!periodData) return current;

  const hireRows = (periodData.hireRows || []).length
    ? periodData.hireRows.map((row) => ({
      ...createEmptyHireRow(),
      ...row,
    }))
    : current.hireRows;

  const offHireRows = (periodData.offHireRows || []).length
    ? periodData.offHireRows.map((row) => {
      const base = createEmptyOffHireRow();
      return {
        ...base,
        reason: row.reason || '',
        from: row.from || '',
        to: row.to || '',
        days: row.days || '',
        rate: row.rate || '',
        amount: row.amount || '',
        bunkers: (row.bunkers || []).length
          ? row.bunkers.map((b) => ({
            ...createEmptyOffHireRow().bunkers[0],
            bunkerGradeId: b.bunkerGradeId || '',
            qty: b.qty || '',
            price: b.price || '',
            amount: b.amount || '',
            calc: b.calc !== false,
          }))
          : base.bunkers,
      };
    })
    : current.offHireRows;

  const deliveryBunkerRows = (periodData.deliveryBunkerRows || []).length
    ? periodData.deliveryBunkerRows.map((row) => ({
      ...createEmptyDeliveryBunkerRow('DEL'),
      ...row,
    }))
    : current.deliveryBunkerRows;

  const redeliveryBunkerRows = (periodData.redeliveryBunkerRows || []).length
    ? periodData.redeliveryBunkerRows.map((row) => ({
      ...createEmptyDeliveryBunkerRow('REDEL'),
      ...row,
    }))
    : current.redeliveryBunkerRows;

  return {
    ...current,
    periodId: periodData.periodId || current.periodId,
    // PHP periodAdComm / periodBComm fill dummyAdcom / dummyBrokerage → hireage only.
    // Freight ADCOM (addCommPercent / txtFrAdjPerAC) stays independent.
    hireagePercent: periodData.hireagePercent || periodData.addCommPercent || current.hireagePercent,
    hireageBroPercent:
      periodData.hireageBroPercent || periodData.brokeragePercent || current.hireageBroPercent,
    hireRate: periodData.hireRate || current.hireRate,
    hireRows,
    offHireRows,
    deliveryBunkerRows,
    redeliveryBunkerRows,
  };
}
