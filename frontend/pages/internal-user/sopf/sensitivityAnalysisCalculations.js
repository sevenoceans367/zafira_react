export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAmount(value, digits = 2) {
  if (!value) return '';
  return toNumber(value).toFixed(digits);
}

export function formatAddComm(per, amount) {
  if (!per) return '';
  return `${per}% (-)${formatAmount(amount)}`;
}

export function calculateFreightAdjustmentAmount(qty, flatRate, wsRate) {
  return (toNumber(qty) * toNumber(flatRate) * toNumber(wsRate)) / 100;
}

export function calculateRatesFromFlatRate(flatRate) {
  return toNumber(flatRate) / 2;
}

export function calculateColumnMetrics(column, businessType) {
  const isTanker = String(businessType) === '2';
  const adjustments = (column.freightAdjustments ?? []).map((item) => {
    const minAmt = calculateFreightAdjustmentAmount(item.minCargoQty, item.minFlatRate, item.minWSRate);
    const overageAmt = calculateFreightAdjustmentAmount(
      item.overageQty,
      item.overageFlatRate,
      item.overageWSRate,
    );
    return {
      ...item,
      minAmt,
      overageAmt,
    };
  });

  let grossFreight = 0;
  if (column.chkLumpSum) {
    grossFreight = toNumber(column.lumpsumAmt);
  } else if (isTanker) {
    grossFreight = adjustments.reduce(
      (sum, item) => sum + toNumber(item.minAmt) + toNumber(item.overageAmt),
      0,
    );
  } else {
    grossFreight = toNumber(column.freight) * toNumber(column.qty);
  }

  const brokerageAmt = column.brokeragePer
    ? (grossFreight * toNumber(column.brokeragePer)) / 100
    : toNumber(column.brokerageAmt);

  const addressCommAmt = column.addCommPer
    ? (grossFreight * toNumber(column.addCommPer)) / 100
    : toNumber(column.addressCommAmt);

  const otherIncome = toNumber(column.otherIncome);
  const netReceivable = grossFreight + otherIncome - addressCommAmt - brokerageAmt;

  const loadPortCost = (column.loadPorts ?? []).reduce((sum, port) => sum + toNumber(port.cost), 0);
  const discPortCost = (column.discPorts ?? []).reduce((sum, port) => sum + toNumber(port.cost), 0);
  const transitPortCost = (column.transitPorts ?? []).reduce((sum, port) => sum + toNumber(port.cost), 0);
  const bunkeringPortCost = (column.bunkeringPorts ?? []).reduce((sum, port) => sum + toNumber(port.cost), 0);
  const operationalCost = toNumber(column.operationalCost);
  const totalExpense = loadPortCost + discPortCost + transitPortCost + bunkeringPortCost + operationalCost;

  const bunkerExpenses = (column.bunkerExpenses ?? []).map((item) => {
    const estMt = toNumber(item.estMt);
    const estPrice = toNumber(item.estPrice);
    const estCost = estMt * estPrice;
    return { ...item, estCost };
  });
  const totalBunkerExpense = bunkerExpenses.reduce((sum, item) => sum + toNumber(item.estCost), 0);

  const hire = column.hire ?? {};
  const totalDays = toNumber(hire.totalDays);
  const hireAmt = toNumber(hire.rate) * totalDays;
  const grossHire = toNumber(hire.ballastBonus) + hireAmt;
  const hireAddComm = (grossHire * toNumber(hire.hierageAddCommPercent)) / 100;
  const hireBrokerage = (hireAmt * toNumber(hire.hierageBrokeragePercent)) / 100;
  const nettHire = grossHire - hireAddComm - hireBrokerage;
  const cveAmt = ((toNumber(hire.cvePerMonth) * 12) / 365) * totalDays;
  const estimatedHire = nettHire + cveAmt;

  const ilohcCost = toNumber(hire.ilohcCost);
  const profitLoss = netReceivable + ilohcCost - totalExpense - totalBunkerExpense - estimatedHire;
  const nettDailyProfit = totalDays > 0 ? profitLoss / totalDays : 0;

  return {
    adjustments,
    grossFreight,
    brokerageAmt,
    addressCommAmt,
    otherIncome,
    netReceivable,
    loadPortCost,
    discPortCost,
    transitPortCost,
    bunkeringPortCost,
    operationalCost,
    totalExpense,
    bunkerExpenses,
    totalBunkerExpense,
    estimatedHire,
    profitLoss,
    nettDailyProfit,
  };
}

export function buildColumnState(column) {
  return {
    ...column,
    freightAdjustments: (column.freightAdjustments ?? []).map((item) => ({ ...item })),
    loadPorts: (column.loadPorts ?? []).map((item) => ({ ...item })),
    discPorts: (column.discPorts ?? []).map((item) => ({ ...item })),
    transitPorts: (column.transitPorts ?? []).map((item) => ({ ...item })),
    bunkeringPorts: (column.bunkeringPorts ?? []).map((item) => ({ ...item })),
    bunkerExpenses: (column.bunkerExpenses ?? []).map((item) => ({ ...item })),
    hire: { ...(column.hire ?? {}) },
  };
}

export function buildUpdatePayload(column, metrics) {
  return {
    freight: column.freight,
    qty: column.qty,
    lumpsumAmt: column.lumpsumAmt,
    chkLumpSum: column.chkLumpSum,
    freightAdjustments: metrics.adjustments,
    loadPorts: column.loadPorts,
    discPorts: column.discPorts,
    transitPorts: column.transitPorts,
    bunkeringPorts: column.bunkeringPorts,
    bunkerExpenses: metrics.bunkerExpenses,
    hire: column.hire,
    computed: {
      grossFreight: metrics.grossFreight,
      estimatedHire: metrics.estimatedHire,
      profitLoss: metrics.profitLoss,
      nettDailyProfit: metrics.nettDailyProfit,
    },
  };
}
