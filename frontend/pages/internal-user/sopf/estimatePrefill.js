import {
  BUNKER_ACTIVITY_SEED_FIELDS,
  createEmptyBunkerActivityRow,
  createEmptyDeliveryBunkerRow,
  createEmptyHireRow,
  createEmptyOffHireRow,
  createEmptyPortLeg,
  createEmptySecaBunkerRow,
} from './estimateDetail.constants.js';

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
    consumptionRows: Array.isArray(prefill.consumptionRows) && prefill.consumptionRows.length
      ? prefill.consumptionRows
      : current.consumptionRows,
    variousBunkerRates: variousRates.length ? variousRates : (current.variousBunkerRates || []),
    bunkerActivityRows,
    portLegs,
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
    brokeragePercent: periodData.brokeragePercent || current.brokeragePercent,
    addCommPercent: periodData.addCommPercent || current.addCommPercent,
    hireRate: periodData.hireRate || current.hireRate,
    hireRows,
    offHireRows,
    deliveryBunkerRows,
    redeliveryBunkerRows,
  };
}
