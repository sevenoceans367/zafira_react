function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Sea days from distance (nm) and speed (kn). */
export function calcSeaDays(distance, speed) {
  const d = num(distance);
  const s = num(speed);
  if (!d || !s) return 0;
  return round2(d / (s * 24));
}

export function calcBunkerCost(qty, price) {
  return round2(num(qty) * num(price));
}

export function calcCargoAmount(mt, rate) {
  return round2(num(mt) * num(rate));
}

/**
 * Core voyage roll-up (simplified from PHP getVoyageTime / getFinalCalculation).
 */
export function computeEstimateTotals(form) {
  const portLegs = form.portLegs || [];
  const cargoRows = form.cargoRows || [];
  const bunkerRows = form.bunkerRows || [];

  const totalDistance = round2(
    portLegs.reduce((sum, leg) => sum + num(leg.distance), 0),
  );

  const ballastSpeed = num(form.bFullSpeed) || num(form.bEcoSpeed1) || 12;
  const ladenSpeed = num(form.lFullSpeed) || num(form.lEcoSpeed1) || ballastSpeed || 12;

  let seaDays = 0;
  const legsWithDays = portLegs.map((leg) => {
    const speed = String(leg.passageType) === '2' ? ladenSpeed : ballastSpeed;
    const days = num(leg.seaDays) || calcSeaDays(leg.distance, speed);
    seaDays += days;
    return { ...leg, seaDays: days ? String(round2(days)) : leg.seaDays };
  });

  const totalPortCost = round2(
    portLegs.reduce(
      (sum, leg) => sum + num(leg.loadPortCost) + num(leg.discPortCost),
      0,
    ),
  );

  const bunkers = bunkerRows.map((row) => {
    const cost = calcBunkerCost(row.qty, row.price);
    return { ...row, cost: cost ? String(cost) : row.cost };
  });
  const totalBunkerCost = round2(bunkers.reduce((sum, row) => sum + num(row.cost), 0));

  const cargos = cargoRows.map((row) => {
    const amount = num(row.amountUsd) || calcCargoAmount(row.cargoMt, row.rateUsdMt);
    return { ...row, amountUsd: amount ? String(amount) : row.amountUsd };
  });
  const cargoQuantity = round2(cargos.reduce((sum, row) => sum + num(row.cargoMt), 0));

  const freightFromCargo = round2(cargos.reduce((sum, row) => sum + num(row.amountUsd), 0));
  const lumpsum = num(form.lumpsum);
  const freightGross = round2(num(form.freightGross) || freightFromCargo || lumpsum);

  const brokeragePercent = num(form.brokeragePercent);
  const brokerageAmt = round2(
    num(form.brokerageAmt) || (freightGross * brokeragePercent) / 100,
  );

  const hireRate = num(form.hireRate);
  const hireDays = seaDays || num(form.totalDays);
  const hireAmt = round2(num(form.hireAmt) || hireRate * hireDays);
  const cveAmt = num(form.cveAmt);
  const ballastBonus = num(form.ballastBonus);

  const revenue = round2(freightGross + lumpsum);
  const expenses = round2(
    totalBunkerCost + totalPortCost + brokerageAmt + hireAmt + cveAmt - ballastBonus,
  );
  const voyageEarnings = round2(revenue - expenses);
  const totalDays = round2(seaDays || num(form.totalDays) || 0);
  const dailyEarning = totalDays > 0 ? round2(voyageEarnings / totalDays) : 0;
  const profitLoss = voyageEarnings;

  return {
    portLegs: legsWithDays,
    cargoRows: cargos,
    bunkerRows: bunkers,
    totalDistance: String(totalDistance || ''),
    totalDays: String(totalDays || ''),
    totalPortCost: String(totalPortCost || ''),
    totalBunkerCost: String(totalBunkerCost || ''),
    cargoQuantity: String(cargoQuantity || ''),
    freightGross: String(freightGross || ''),
    brokerageAmt: String(brokerageAmt || ''),
    hireAmt: String(hireAmt || ''),
    revenue: String(revenue || ''),
    voyageEarnings: String(voyageEarnings || ''),
    dailyEarning: String(dailyEarning || ''),
    profitLoss: String(profitLoss || ''),
  };
}

/** Merge computed totals into form state. */
export function applyEstimateCalculations(form) {
  const totals = computeEstimateTotals(form);
  return {
    ...form,
    ...totals,
  };
}
