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
  const bunkerRows = form.bunkerRows || [];
  const orcRows = form.orcRows || [];
  const otherIncomeRows = form.otherIncomeRows || [];
  const hireRows = form.hireRows || [];
  const secaBunkerRows = form.secaBunkerRows || [];
  const freightQtyRows = form.freightQtyRows || [];
  const tankerWsRows = form.tankerWsRows || [];
  const offHireRows = form.offHireRows || [];
  const deliveryBunkerRows = form.deliveryBunkerRows || [];
  const redeliveryBunkerRows = form.redeliveryBunkerRows || [];

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
      (sum, leg) => sum + num(leg.loadPortCost) + num(leg.discPortCost) + num(leg.transitPortCost)
        + num(leg.ddcLpEst) + num(leg.ddcDpEst),
      0,
    ),
  );

  const bunkers = bunkerRows.map((row) => {
    const cost = calcBunkerCost(row.qty, row.price);
    return { ...row, cost: cost ? String(cost) : row.cost };
  });
  const totalBunkerCost = round2(bunkers.reduce((sum, row) => sum + num(row.cost), 0));

  const secaBunkers = secaBunkerRows.map((row) => {
    const cost = calcBunkerCost(row.qty, row.price);
    return { ...row, cost: cost ? String(cost) : row.cost };
  });
  const totalSecaBunkerCost = round2(
    secaBunkers.reduce((sum, row) => (row.calc === false ? sum : sum + num(row.cost)), 0),
  );

  const mapAmount = (rows) => (rows || []).map((row) => {
    const amount = num(row.amountUsd) || calcCargoAmount(row.cargoMt, row.rateUsdMt);
    return { ...row, amountUsd: amount ? String(amount) : row.amountUsd };
  });
  const cargoRows = mapAmount(form.cargoRows);
  const overageCargoRows = mapAmount(form.overageCargoRows);
  const deadfreightCargoRows = mapAmount(form.deadfreightCargoRows);
  const allCargos = [...cargoRows, ...overageCargoRows, ...deadfreightCargoRows];
  const cargoQuantity = round2(allCargos.reduce((sum, row) => sum + num(row.cargoMt), 0));

  const orcs = orcRows.map((row) => {
    const amountMt = cargoQuantity > 0
      ? round2(num(row.amount) / cargoQuantity)
      : num(row.amountMt);
    return {
      ...row,
      amountMt: amountMt ? String(amountMt) : row.amountMt,
    };
  });
  const totalOrcCost = round2(orcs.reduce((sum, row) => sum + num(row.amount), 0));

  const otherIncomes = otherIncomeRows.map((row) => {
    const net = num(row.netAmount) || round2(num(row.amount) - num(row.addComm));
    return { ...row, netAmount: net ? String(net) : row.netAmount };
  });
  const totalOtherIncome = round2(
    otherIncomes.reduce((sum, row) => sum + num(row.netAmount || row.amount), 0),
  );

  const hires = hireRows.map((row) => {
    const amt = num(row.hireAmt) || round2(num(row.hireDays) * num(row.hireRate));
    return { ...row, hireAmt: amt ? String(amt) : row.hireAmt };
  });
  const totalHireFromRows = round2(hires.reduce((sum, row) => sum + num(row.hireAmt), 0));

  const freightQtys = freightQtyRows.map((row) => {
    const quantity = num(row.quantity);
    const agreed = num(row.agreedGrossFreight);
    const grossFreight = num(row.grossFreight) || round2(agreed * quantity);
    const brokeragePercent = num(row.brokeragePercent);
    const netBrokerage = num(row.netBrokerage) || round2((grossFreight * brokeragePercent) / 100);
    const netFreight = num(row.netFreight) || round2(grossFreight - netBrokerage);
    const netFreightPerMt = quantity > 0
      ? (num(row.netFreightPerMt) || round2(netFreight / quantity))
      : num(row.netFreightPerMt);
    return {
      ...row,
      grossFreight: grossFreight ? String(grossFreight) : row.grossFreight,
      netBrokerage: netBrokerage ? String(netBrokerage) : row.netBrokerage,
      netFreight: netFreight ? String(netFreight) : row.netFreight,
      netFreightPerMt: netFreightPerMt ? String(netFreightPerMt) : row.netFreightPerMt,
    };
  });
  const totalFreightQty = round2(
    freightQtys.reduce((sum, row) => sum + num(row.netFreight), 0),
  );

  const tankerWs = tankerWsRows.map((row) => {
    const minAmount = num(row.minAmount) || round2(
      num(row.minCargoQty) * num(row.minFlatRate) * (num(row.minWs) / 100),
    );
    const oveAmount = num(row.oveAmount) || round2(
      num(row.oveCargoQty) * num(row.oveFlatRate) * (num(row.oveWs) / 100),
    );
    const totalQty = num(row.totalQty) || round2(num(row.minCargoQty) + num(row.oveCargoQty));
    const totalAmount = num(row.totalAmount) || round2(minAmount + oveAmount);
    return {
      ...row,
      minAmount: minAmount ? String(minAmount) : row.minAmount,
      oveAmount: oveAmount ? String(oveAmount) : row.oveAmount,
      totalQty: totalQty ? String(totalQty) : row.totalQty,
      totalAmount: totalAmount ? String(totalAmount) : row.totalAmount,
    };
  });
  const totalTankerWs = round2(
    tankerWs.reduce((sum, row) => sum + num(row.totalAmount), 0),
  );

  const offHires = offHireRows.map((row) => {
    const amount = num(row.amount) || round2(num(row.days) * num(row.rate));
    const bunkersMapped = (row.bunkers || []).map((b) => {
      const bunkerAmt = num(b.amount) || calcBunkerCost(b.qty, b.price);
      return { ...b, amount: bunkerAmt ? String(bunkerAmt) : b.amount };
    });
    const bunkerTotal = bunkersMapped.reduce(
      (sum, b) => (b.calc === false ? sum : sum + num(b.amount)),
      0,
    );
    return {
      ...row,
      amount: amount ? String(amount) : row.amount,
      bunkers: bunkersMapped,
      bunkerTotal,
    };
  });
  const totalOffHireAmt = round2(
    offHires.reduce((sum, row) => sum + num(row.amount) + num(row.bunkerTotal), 0),
  );

  const deliveryBunkers = deliveryBunkerRows.map((row) => {
    const amount = num(row.amount) || calcBunkerCost(row.qty, row.price);
    return { ...row, amount: amount ? String(amount) : row.amount };
  });
  const redeliveryBunkers = redeliveryBunkerRows.map((row) => {
    const amount = num(row.amount) || calcBunkerCost(row.qty, row.price);
    return { ...row, amount: amount ? String(amount) : row.amount };
  });

  const freightFromCargo = round2(allCargos.reduce((sum, row) => sum + num(row.amountUsd), 0));
  const lumpsum = num(form.lumpsum);
  const freightGross = round2(
    num(form.freightGross)
    || totalFreightQty
    || totalTankerWs
    || freightFromCargo
    || lumpsum,
  );

  const brokeragePercent = num(form.brokeragePercent);
  const brokerageAmt = round2(
    num(form.brokerageAmt) || (freightGross * brokeragePercent) / 100,
  );

  const hireRate = num(form.hireRate);
  const hireDays = seaDays || num(form.totalDays);
  const hireAmt = round2(
    totalHireFromRows || num(form.hireAmt) || hireRate * hireDays,
  );
  const cveAmt = num(form.cveAmt);
  const ballastBonus = num(form.ballastBonus);

  let ladenDist = 0;
  let ballastDist = 0;
  let ladenDays = 0;
  let ballastDays = 0;
  for (const leg of legsWithDays) {
    const dist = num(leg.distance);
    const days = num(leg.seaDays) || calcSeaDays(leg.distance, String(leg.passageType) === '2' ? ladenSpeed : ballastSpeed);
    if (String(leg.passageType) === '2') {
      ladenDist += dist;
      ladenDays += days;
    } else {
      ballastDist += dist;
      ballastDays += days;
    }
  }
  ladenDist = round2(ladenDist);
  ballastDist = round2(ballastDist);
  ladenDays = round2(ladenDays);
  ballastDays = round2(ballastDays);
  const totalSeaDays = round2(ladenDays + ballastDays);
  const portIdleDays = round2(portLegs.reduce((sum, leg) => sum + num(leg.portIdleDays), 0));
  const portStayDays = round2(portLegs.reduce((sum, leg) => sum + num(leg.portStayDays), 0));

  const demurrageRevenue = round2(
    portLegs.reduce((sum, leg) => sum + num(leg.ddcLpEst) + num(leg.ddcDpEst), 0)
    + allCargos.reduce((sum, row) => sum + num(row.demAmt), 0),
  );

  const deliveryTotal = round2(deliveryBunkers.reduce((sum, row) => sum + num(row.amount), 0));
  const redeliveryTotal = round2(redeliveryBunkers.reduce((sum, row) => sum + num(row.amount), 0));
  const netHireage = round2(hireAmt + deliveryTotal + cveAmt - redeliveryTotal - totalOffHireAmt);

  const vesselDailyOps = num(form.vesselDailyOps);
  const totalDays = round2(totalSeaDays + portIdleDays + portStayDays || num(form.totalDays) || 0);
  const vesselDailyOpsAmt = round2(vesselDailyOps * (totalDays || 0));

  const gradeById = {};
  for (const g of (form._bunkerGrades || [])) {
    gradeById[String(g.id)] = g;
  }
  const classify = (gradeId) => {
    const name = String(gradeById[String(gradeId)]?.name || '').toUpperCase();
    if (name.includes('HSFO')) return 'HSFO';
    if (name.includes('VLSFO') || name.includes('VLFO')) return 'VLSFO';
    if (name.includes('LSMGO') || name.includes('MGO') || name.includes('MDO')) return 'LSMGO';
    return null;
  };

  const bunkerMt = { HSFO: 0, VLSFO: 0, LSMGO: 0 };
  const etsMt = { HSFO: 0, VLSFO: 0, LSMGO: 0 };
  for (const row of bunkers) {
    if (String(row.identify).toUpperCase() === 'SUPPLY') continue;
    const key = classify(row.bunkerGradeId);
    if (key) bunkerMt[key] += num(row.qty);
  }
  for (const row of secaBunkers) {
    const key = classify(row.bunkerGradeId) || (String(row.bunkerType).toUpperCase() === 'DO' ? 'LSMGO' : 'VLSFO');
    bunkerMt[key] = (bunkerMt[key] || 0) + num(row.qty);
    if (String(row.identify) === 'SECA') {
      etsMt[key] = (etsMt[key] || 0) + num(row.qty);
    } else {
      etsMt[key] = (etsMt[key] || 0) + num(row.qty);
    }
  }
  for (const k of Object.keys(bunkerMt)) bunkerMt[k] = round2(bunkerMt[k]);
  for (const k of Object.keys(etsMt)) etsMt[k] = round2(etsMt[k]);

  const factors = form._complianceFactors || {};
  const fac = (key) => factors[key] || { co2Fac: 0, penalty: 0, intensity: 0, ghgRate: 0, euaCo2Rate: 0 };
  const hsfoPenal = round2(bunkerMt.HSFO * fac('HSFO').penalty);
  const vlsfoPenal = round2(bunkerMt.VLSFO * fac('VLSFO').penalty);
  const lsmgoPenal = round2(bunkerMt.LSMGO * fac('LSMGO').penalty);

  const co2mt = round2(
    bunkerMt.HSFO * fac('HSFO').co2Fac
    + bunkerMt.VLSFO * fac('VLSFO').co2Fac
    + bunkerMt.LSMGO * fac('LSMGO').co2Fac,
  );
  const co2Price = num(form.co2Price);
  const co2Cost = round2(co2mt * co2Price);
  const eeoiCo2 = round2(
    etsMt.HSFO * fac('HSFO').co2Fac
    + etsMt.VLSFO * fac('VLSFO').co2Fac
    + etsMt.LSMGO * fac('LSMGO').co2Fac,
  );
  const euaCo2mt = round2(
    etsMt.HSFO * fac('HSFO').co2Fac * (fac('HSFO').euaCo2Rate / 100)
    + etsMt.VLSFO * fac('VLSFO').co2Fac * (fac('VLSFO').euaCo2Rate / 100)
    + etsMt.LSMGO * fac('LSMGO').co2Fac * (fac('LSMGO').euaCo2Rate / 100),
  );
  const euaPrice = num(form.euaPrice);
  const euaCo2Usd = euaCo2mt > 0 && euaPrice > 0 ? Math.ceil(euaCo2mt * euaPrice) : 0;
  const sailedDist = totalDistance;
  const dwtQty = num(form.dwtSummer);
  let eeoi = 0;
  let cii = 0;
  if (eeoiCo2 > 0 && cargoQuantity > 0 && sailedDist > 0) {
    eeoi = round2((eeoiCo2 * 1e6) / (cargoQuantity * sailedDist));
  }
  if (eeoiCo2 > 0 && dwtQty > 0 && sailedDist > 0) {
    cii = round2((eeoiCo2 * 1e6) / (dwtQty * sailedDist));
  }

  const totalCarbonCost = round2(euaCo2Usd + hsfoPenal + vlsfoPenal + lsmgoPenal);

  let operationalExpenses = round2(totalOrcCost + brokerageAmt + vesselDailyOpsAmt);
  if (form.euEtsAddToFreight) operationalExpenses = round2(operationalExpenses + euaCo2Usd);
  if (form.fuelEuAddToFreight) {
    operationalExpenses = round2(operationalExpenses + hsfoPenal + vlsfoPenal + lsmgoPenal);
  }

  const bunkerExpenseTotal = round2(totalBunkerCost + totalSecaBunkerCost);
  const revenue = round2(freightGross + lumpsum + totalOtherIncome);
  const totalExpenses = round2(operationalExpenses + totalPortCost + bunkerExpenseTotal);
  const voyageEarnings = round2(revenue - totalExpenses - cveAmt + demurrageRevenue);
  const gTotalVoyageEarnings = round2(revenue - totalExpenses - netHireage);
  const daysForTce = totalDays > 0 ? totalDays : 1;
  const nettDailyTce = round2((gTotalVoyageEarnings + demurrageRevenue) / daysForTce);
  const profitLoss = round2(gTotalVoyageEarnings + demurrageRevenue);
  const dailyEarning = nettDailyTce;

  return {
    portLegs: legsWithDays,
    cargoRows,
    overageCargoRows,
    deadfreightCargoRows,
    bunkerRows: bunkers,
    orcRows: orcs,
    otherIncomeRows: otherIncomes,
    hireRows: hires,
    secaBunkerRows: secaBunkers,
    freightQtyRows: freightQtys,
    tankerWsRows: tankerWs,
    offHireRows: offHires.map(({ bunkerTotal, ...row }) => row),
    deliveryBunkerRows: deliveryBunkers,
    redeliveryBunkerRows: redeliveryBunkers,
    totalDistance: String(totalDistance || ''),
    ladenDist: String(ladenDist || ''),
    ballastDist: String(ballastDist || ''),
    ladenDays: String(ladenDays || ''),
    ballastDays: String(ballastDays || ''),
    totalSeaDays: String(totalSeaDays || ''),
    portIdleDays: String(portIdleDays || ''),
    portStayDays: String(portStayDays || ''),
    totalDays: String(totalDays || ''),
    totalPortCost: String(totalPortCost || ''),
    totalBunkerCost: String(bunkerExpenseTotal || ''),
    totalSecaBunkerCost: String(totalSecaBunkerCost || ''),
    totalOrcCost: String(totalOrcCost || ''),
    totalOtherIncome: String(totalOtherIncome || ''),
    totalHireAmt: String(hireAmt || ''),
    totalOffHireAmt: String(totalOffHireAmt || ''),
    totalFreightQty: String(totalFreightQty || ''),
    cargoQuantity: String(cargoQuantity || ''),
    freightGross: String(freightGross || ''),
    brokerageAmt: String(brokerageAmt || ''),
    hireAmt: String(hireAmt || ''),
    demurrageRevenue: String(demurrageRevenue || ''),
    operationalExpenses: String(operationalExpenses || ''),
    netHireage: String(netHireage || ''),
    vesselDailyOpsAmt: String(vesselDailyOpsAmt || ''),
    hsfoMt: String(bunkerMt.HSFO || ''),
    vlsfoMt: String(bunkerMt.VLSFO || ''),
    lsmgoMt: String(bunkerMt.LSMGO || ''),
    etsHsfoMt: String(etsMt.HSFO || ''),
    etsVlsfoMt: String(etsMt.VLSFO || ''),
    etsLsmgoMt: String(etsMt.LSMGO || ''),
    bunkerResultsCost: String(bunkerExpenseTotal || ''),
    eeoi: String(eeoi || ''),
    cii: String(cii || ''),
    eeoiCo2: String(eeoiCo2 || ''),
    co2mt: String(co2mt || ''),
    co2Cost: String(co2Cost || ''),
    euaCo2mt: String(euaCo2mt || ''),
    euaCo2Usd: String(euaCo2Usd || ''),
    hsfoIntensity: String(fac('HSFO').intensity || ''),
    hsfoTarget: String(fac('HSFO').ghgRate || ''),
    vlsfoIntensity: String(fac('VLSFO').intensity || ''),
    vlsfoTarget: String(fac('VLSFO').ghgRate || ''),
    lsmgoIntensity: String(fac('LSMGO').intensity || ''),
    lsmgoTarget: String(fac('LSMGO').ghgRate || ''),
    hsfoPenalty: String(hsfoPenal || ''),
    vlsfoPenalty: String(vlsfoPenal || ''),
    lsmgoPenalty: String(lsmgoPenal || ''),
    hsfoPenaltyPerMt: String(fac('HSFO').penalty || ''),
    vlsfoPenaltyPerMt: String(fac('VLSFO').penalty || ''),
    lsmgoPenaltyPerMt: String(fac('LSMGO').penalty || ''),
    totalCarbonCost: String(totalCarbonCost || ''),
    revenue: String(revenue || ''),
    voyageEarnings: String(voyageEarnings || ''),
    nettDailyTce: String(nettDailyTce || ''),
    dailyEarning: String(dailyEarning || ''),
    profitLoss: String(profitLoss || ''),
  };
}

/** Merge computed totals into form state. */
export function applyEstimateCalculations(form, lookups = null) {
  const next = {
    ...form,
    _bunkerGrades: lookups?.bunkerGrades || form._bunkerGrades || [],
    _complianceFactors: lookups?.complianceFactors || form._complianceFactors || {},
  };
  const totals = computeEstimateTotals(next);
  return {
    ...next,
    ...totals,
  };
}
