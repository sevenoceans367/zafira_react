export const FIXTURE_TYPE_OPTIONS = [
  { value: '1', label: 'TCIN-VCOUT' },
  { value: '2', label: 'VCIN-VCOUT' },
  { value: '3', label: 'VCOUT' },
];

export const ESTIMATE_TYPE_LABELS = {
  1: 'Gas',
  2: 'Tanker',
  3: 'Dry Cargo',
};

export const PASSAGE_TYPE_OPTIONS = [
  { value: '1', label: 'Ballast' },
  { value: '2', label: 'Laden' },
];

export const SPEED_TYPE_OPTIONS = [
  { value: '1', label: 'Full' },
  { value: '2', label: 'Eco' },
];

export const BUNKER_IDENTIFY_OPTIONS = [
  { value: 'SUPPLY', label: 'Supply' },
  { value: 'CONSUMPTION', label: 'Consumption' },
];

export function getFixtureTypeLabel(fixtureTypeId) {
  return FIXTURE_TYPE_OPTIONS.find((option) => option.value === String(fixtureTypeId))?.label ?? '';
}

export function formatTodayDmy() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}-${m}-${y}`;
}

function newRowId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyCargoRow() {
  return {
    id: newRowId('cargo'),
    cargoId: '',
    cargoName: '',
    cargoCbm: '',
    cargoMt: '',
    rateUsdMt: '',
    amountUsd: '',
    charterer: '',
    status: 1,
  };
}

export function createEmptyPortLeg() {
  return {
    id: newRowId('leg'),
    fromPortId: '',
    fromPortName: '',
    toPortId: '',
    toPortName: '',
    passageType: '1',
    speedType: '1',
    distance: '',
    seaDays: '',
    loadQty: '',
    dischargeQty: '',
    loadPortCost: '',
    discPortCost: '',
    loadPortRate: '',
    discPortRate: '',
  };
}

export function createEmptyBunkerRow(identify = 'CONSUMPTION') {
  return {
    id: newRowId('bunker'),
    bunkerGradeId: '',
    qty: '',
    price: '',
    cost: '',
    identify,
  };
}

export function createEmptyDetail(estimateType = 2) {
  const type = Number(estimateType) || 2;
  return {
    estimateType: type,
    estimateTypeLabel: ESTIMATE_TYPE_LABELS[type] ?? '',
    portLegs: [],
    cargoRows: [],
    bunkerRows: [],
    totalDays: '',
    totalDistance: '',
    cargoQuantity: '',
    dailyEarning: '',
    profitLoss: '',
    freightGross: '',
  };
}

export function toFormState(detail = {}) {
  const cargoRows = Array.isArray(detail.cargoRows) && detail.cargoRows.length
    ? detail.cargoRows.map((row) => ({
      id: row.id || newRowId('cargo'),
      cargoId: row.cargoId != null ? String(row.cargoId) : '',
      cargoName: row.cargoName ?? '',
      cargoCbm: row.cargoCbm != null ? String(row.cargoCbm) : '',
      cargoMt: row.cargoMt != null ? String(row.cargoMt) : '',
      rateUsdMt: row.rateUsdMt != null ? String(row.rateUsdMt) : '',
      amountUsd: row.amountUsd != null ? String(row.amountUsd) : '',
      charterer: row.charterer ?? '',
      status: row.status ?? 1,
    }))
    : [createEmptyCargoRow()];

  const portLegs = Array.isArray(detail.portLegs) && detail.portLegs.length
    ? detail.portLegs.map((row) => ({
      id: row.id || newRowId('leg'),
      fromPortId: row.fromPortId != null ? String(row.fromPortId) : '',
      fromPortName: row.fromPortName ?? '',
      toPortId: row.toPortId != null ? String(row.toPortId) : '',
      toPortName: row.toPortName ?? '',
      passageType: row.passageType != null ? String(row.passageType) : '1',
      speedType: row.speedType != null ? String(row.speedType) : '1',
      distance: row.distance != null ? String(row.distance) : '',
      seaDays: row.seaDays != null ? String(row.seaDays) : '',
      loadQty: row.loadQty != null ? String(row.loadQty) : '',
      dischargeQty: row.dischargeQty != null ? String(row.dischargeQty) : '',
      loadPortCost: row.loadPortCost != null ? String(row.loadPortCost) : '',
      discPortCost: row.discPortCost != null ? String(row.discPortCost) : '',
      loadPortRate: row.loadPortRate != null ? String(row.loadPortRate) : '',
      discPortRate: row.discPortRate != null ? String(row.discPortRate) : '',
    }))
    : [createEmptyPortLeg()];

  const bunkerRows = Array.isArray(detail.bunkerRows) && detail.bunkerRows.length
    ? detail.bunkerRows.map((row) => ({
      id: row.id || newRowId('bunker'),
      bunkerGradeId: row.bunkerGradeId != null ? String(row.bunkerGradeId) : '',
      qty: row.qty != null ? String(row.qty) : '',
      price: row.price != null ? String(row.price) : '',
      cost: row.cost != null ? String(row.cost) : '',
      identify: row.identify || 'CONSUMPTION',
    }))
    : [createEmptyBunkerRow('CONSUMPTION'), createEmptyBunkerRow('SUPPLY')];

  return {
    fixtureTypeId: detail.fixtureTypeId ? String(detail.fixtureTypeId) : '',
    vesselImoId: detail.vesselImoId ? String(detail.vesselImoId) : '',
    vesselName: detail.vesselName ?? '',
    vesselType: detail.vesselType ?? '',
    flag: detail.flag ?? '',
    transDate: detail.transDate ?? formatTodayDmy(),
    voyageNo: detail.voyageNo ?? '',
    voyageName: detail.voyageName ?? '',
    dwtSummer: detail.dwtSummer != null ? String(detail.dwtSummer) : '',
    dwtTropical: detail.dwtTropical != null ? String(detail.dwtTropical) : '',
    gnrt: detail.gnrt != null ? String(detail.gnrt) : '',
    loa: detail.loa != null ? String(detail.loa) : '',
    tpc: detail.tpc != null ? String(detail.tpc) : '',
    gear: detail.gear != null ? String(detail.gear) : '',
    builtYear: detail.builtYear != null ? String(detail.builtYear) : '',
    beam: detail.beam != null ? String(detail.beam) : '',
    loadable: detail.loadable != null ? String(detail.loadable) : '',
    stowageFactor: detail.stowageFactor != null ? String(detail.stowageFactor) : '',
    grainCap: detail.grainCap != null ? String(detail.grainCap) : '',
    baleCap: detail.baleCap != null ? String(detail.baleCap) : '',

    bFullSpeed: detail.bFullSpeed != null ? String(detail.bFullSpeed) : '',
    bEcoSpeed1: detail.bEcoSpeed1 != null ? String(detail.bEcoSpeed1) : '',
    lFullSpeed: detail.lFullSpeed != null ? String(detail.lFullSpeed) : '',
    lEcoSpeed1: detail.lEcoSpeed1 != null ? String(detail.lEcoSpeed1) : '',
    bFoFullSpeed: detail.bFoFullSpeed != null ? String(detail.bFoFullSpeed) : '',
    lFoFullSpeed: detail.lFoFullSpeed != null ? String(detail.lFoFullSpeed) : '',
    bDoFullSpeed: detail.bDoFullSpeed != null ? String(detail.bDoFullSpeed) : '',
    lDoFullSpeed: detail.lDoFullSpeed != null ? String(detail.lDoFullSpeed) : '',
    pIfoFullSpeed: detail.pIfoFullSpeed != null ? String(detail.pIfoFullSpeed) : '',
    pWfoFullSpeed: detail.pWfoFullSpeed != null ? String(detail.pWfoFullSpeed) : '',
    pIdoFullSpeed: detail.pIdoFullSpeed != null ? String(detail.pIdoFullSpeed) : '',
    pWdoFullSpeed: detail.pWdoFullSpeed != null ? String(detail.pWdoFullSpeed) : '',

    cargoRows,
    portLegs,
    bunkerRows,

    lumpsumQty: detail.lumpsumQty != null ? String(detail.lumpsumQty) : '',
    lumpsum: detail.lumpsum != null ? String(detail.lumpsum) : '',
    marketRate: detail.marketRate != null ? String(detail.marketRate) : '',
    freightGross: detail.freightGross != null ? String(detail.freightGross) : '',
    brokeragePercent: detail.brokeragePercent != null ? String(detail.brokeragePercent) : '',
    brokerageAmt: detail.brokerageAmt != null ? String(detail.brokerageAmt) : '',
    hireRate: detail.hireRate != null ? String(detail.hireRate) : '',
    hireAmt: detail.hireAmt != null ? String(detail.hireAmt) : '',
    cveAmt: detail.cveAmt != null ? String(detail.cveAmt) : '',
    ballastBonus: detail.ballastBonus != null ? String(detail.ballastBonus) : '',
    addCommPercent: detail.addCommPercent != null ? String(detail.addCommPercent) : '',
    totalPortCost: detail.totalPortCost != null ? String(detail.totalPortCost) : '',
    totalBunkerCost: detail.totalBunkerCost != null ? String(detail.totalBunkerCost) : '',
    totalDays: detail.totalDays != null ? String(detail.totalDays) : '',
    totalDistance: detail.totalDistance != null ? String(detail.totalDistance) : '',
    cargoQuantity: detail.cargoQuantity != null ? String(detail.cargoQuantity) : '',
    revenue: detail.revenue != null ? String(detail.revenue) : '',
    voyageEarnings: detail.voyageEarnings != null ? String(detail.voyageEarnings) : '',
    dailyEarning: detail.dailyEarning != null ? String(detail.dailyEarning) : '',
    profitLoss: detail.profitLoss != null ? String(detail.profitLoss) : '',
  };
}
