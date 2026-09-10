export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAmount(value, digits = 2) {
  if (!value) return '';
  return formatComma(value, digits);
}

export function formatComma(value, digits) {
  if (value === undefined || value === null || value === '') return '';
  const raw = String(value).trim();
  if (raw === '') return '';
  const num = toNumber(value);
  if (!Number.isFinite(num)) return raw;
  const options = digits == null
    ? { maximumFractionDigits: 20 }
    : { minimumFractionDigits: digits, maximumFractionDigits: digits };
  return num.toLocaleString(undefined, options);
}

export function formatAddComm(per, amount) {
  if (amount === undefined || amount === null || amount === '' || !toNumber(amount)) return '';
  const pct = per === undefined || per === null || per === '' ? '' : String(per);
  const amountText = formatComma(amount, 2);
  return pct ? `${amountText} (${pct}%)` : amountText;
}

export function calculateFreightAdjustmentAmount(qty, flatRate, wsRate) {
  return (toNumber(qty) * toNumber(flatRate) * toNumber(wsRate)) / 100;
}

/** Tara: WS equivalent from lumpsum = (Lumpsum × 100) / (Qty × Flat Rate). */
export function calculateLumpsumWsEquivalent(lumpsumAmt, qty, flatRate) {
  const lump = toNumber(lumpsumAmt);
  const quantity = toNumber(qty);
  const flat = toNumber(flatRate);
  if (!lump || !quantity || !flat) return '';
  return (lump * 100) / (quantity * flat);
}

export function calculateRatesFromFlatRate(flatRate) {
  return toNumber(flatRate) / 2;
}

export const SENSI_BUNKER_GRADES = ['VLSFO', 'LSMGO'];

export function isSensiBunkerGrade(grade) {
  return SENSI_BUNKER_GRADES.some((allowed) => new RegExp(allowed, 'i').test(String(grade || '')));
}

export function displayOrDash(value) {
  if (value === undefined || value === null || value === '') return '—';
  const formatted = typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value).trim())
    ? formatAmount(value)
    : String(value);
  return formatted || '—';
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
    // Multiple / lumpsum: use lumpsum amount, fall back to stored estimate total.
    grossFreight = toNumber(column.lumpsumAmt) || toNumber(column.storedGrossFreight);
  } else if (isTanker) {
    grossFreight = adjustments.reduce(
      (sum, item) => sum + toNumber(item.minAmt) + toNumber(item.overageAmt),
      0,
    );
    if (!grossFreight) grossFreight = toNumber(column.storedGrossFreight);
  } else {
    // Dry Single: Freight/MT × Qty (from CARGO_RATE × QUANTITY).
    grossFreight = toNumber(column.freight) * toNumber(column.qty);
    if (!grossFreight) grossFreight = toNumber(column.storedGrossFreight);
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

  const bunkerExpenses = (column.bunkerExpenses ?? [])
    .filter((item) => isSensiBunkerGrade(item.grade))
    .map((item) => {
      const estMt = toNumber(item.estMt);
      const estPrice = toNumber(item.estPrice);
      const estCost = estMt * estPrice;
      return { ...item, estCost };
    });
  const totalBunkerExpense = bunkerExpenses.reduce((sum, item) => sum + toNumber(item.estCost), 0);

  const hire = column.hire ?? {};
  const totalDays = toNumber(hire.totalDays);
  // Match estimate sheet Net Hireage:
  // (Hire/Day × Hire Days + Ballast − Add Comm − Brokerage)
  // + Delivery bunkers + CVE − Redelivery bunkers − Less Off Hire
  const hireDays = toNumber(hire.hireDays) || totalDays;
  const hireAmt = toNumber(hire.rate) * hireDays;
  const grossHire = toNumber(hire.ballastBonus) + hireAmt;
  const hireAddComm = (grossHire * toNumber(hire.hierageAddCommPercent)) / 100;
  const hireBrokerage = (hireAmt * toNumber(hire.hierageBrokeragePercent)) / 100;
  const nettHire = grossHire - hireAddComm - hireBrokerage;
  const hireageCveAmt = ((toNumber(hire.cvePerMonth) * 12) / 365) * hireDays;
  const netHireage = (
    nettHire
    + toNumber(hire.deliveryTotal)
    + hireageCveAmt
    - toNumber(hire.redeliveryTotal)
    - toNumber(hire.lessOffHire)
  );
  const estimatedHire = netHireage;

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
    netHireage,
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
    lumpsumQty: column.lumpsumQty,
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
      netHireage: metrics.netHireage,
      profitLoss: metrics.profitLoss,
      nettDailyProfit: metrics.nettDailyProfit,
    },
  };
}
