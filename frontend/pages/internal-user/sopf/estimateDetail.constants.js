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

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'United States Dollar (USD)' },
  { value: 'EURO', label: 'Euro (EUR)' },
  { value: 'AUD', label: 'Australian dollar (AUD)' },
  { value: 'GBP', label: 'United Kingdom Pound (GBP)' },
  { value: 'INR', label: 'Indian Rupee (INR)' },
  { value: 'AED', label: 'Emirati Dirham (AED)' },
  { value: 'JPY', label: 'Japanese Yen (JPY)' },
];

export const SECA_IDENTIFY_OPTIONS = [
  { value: 'SECA', label: 'SECA' },
  { value: 'NON_SECA', label: 'NON SECA' },
];

export const BUNKER_TYPE_OPTIONS = [
  { value: 'FO', label: 'FO' },
  { value: 'DO', label: 'DO' },
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

export function createEmptyCargoRow(status = 1) {
  return {
    id: newRowId('cargo'),
    cargoId: '',
    cargoName: '',
    cargoCbm: '',
    cargoMt: '',
    rateUsdMt: '',
    amountUsd: '',
    charterer: '',
    demAmt: '',
    vendorId: '',
    status,
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
    secaDistance: '',
    secaDays: '',
    transitPortCost: '',
    ddcLpEst: '',
    ddcDpEst: '',
    chkLpSeca: false,
    chkDpSeca: false,
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

export function createEmptyOrcRow() {
  return {
    id: newRowId('orc'),
    costId: '',
    costName: '',
    amount: '',
    amountMt: '',
    vendorId: '',
  };
}

export function createEmptyOtherIncomeRow() {
  return {
    id: newRowId('oi'),
    description: '',
    amount: '',
    addComm: '',
    netAmount: '',
    vendorId: '',
  };
}

export function createEmptyHireRow() {
  return {
    id: newRowId('hire'),
    hireFrom: '',
    hireTo: '',
    hireDays: '',
    hireRate: '',
    hireAmt: '',
  };
}

export function createEmptySecaBunkerRow(identify = 'SECA', bunkerType = 'FO') {
  return {
    id: newRowId('seca'),
    bunkerGradeId: '',
    qty: '',
    price: '',
    cost: '',
    identify,
    bunkerType,
    calc: true,
  };
}

export function createEmptyFreightQtyRow() {
  return {
    id: newRowId('fq'),
    vendorId: '',
    agreedGrossFreight: '',
    quantity: '',
    grossFreight: '',
    brokeragePercent: '',
    netBrokerage: '',
    netFreight: '',
    netFreightPerMt: '',
    currencyId: '',
    localAgreedFreight: '',
    exchangeRate: '',
    cargoId: '',
  };
}

export function createEmptyTankerWsRow() {
  return {
    id: newRowId('ws'),
    freightSpecs: '',
    customerId: '',
    minCargoQty: '',
    oveCargoQty: '',
    minFlatRate: '',
    oveFlatRate: '',
    minWs: '',
    oveWs: '',
    minDisLeg: '',
    oveDisLeg: '',
    minDistance: '',
    oveDistance: '',
    minAmount: '',
    oveAmount: '',
    totalQty: '',
    totalAmount: '',
    wsFromPortId: '',
    wsFromPortName: '',
    wsToPortId: '',
    wsToPortName: '',
  };
}

export function createEmptyOffHireRow() {
  return {
    id: newRowId('off'),
    reason: '',
    from: '',
    to: '',
    days: '',
    rate: '',
    amount: '',
    bunkers: [{
      id: newRowId('offb'),
      bunkerGradeId: '',
      qty: '',
      price: '',
      amount: '',
      calc: true,
    }],
  };
}

export function createEmptyPassageLocationRow() {
  return {
    id: newRowId('loc'),
    fromLocation: '',
    toLocation: '',
    passageType: '1',
    speedType: '1',
    distance: '',
  };
}

export function createEmptyConsumptionRow(identify = 'FO') {
  return {
    id: newRowId('cons'),
    identify,
    bunkerGradeId: '',
    balSecaFs: '',
    ladSecaFs: '',
    balNonSecaFs: '',
    ladNonSecaFs: '',
    balSecaSs: '',
    ladSecaSs: '',
    balNonSecaSs: '',
    ladNonSecaSs: '',
    inPortSecaWorking: '',
    inPortNonSecaWorking: '',
    inPortSecaIdle: '',
    inPortNonSecaIdle: '',
  };
}

export function createEmptyInvoiceRow() {
  return {
    id: newRowId('inv'),
    invoiceId: '',
  };
}

export function createEmptyDeliveryBunkerRow(identity = 'DEL') {
  return {
    id: newRowId('delb'),
    bunkerGradeId: '',
    qty: '',
    price: '',
    amount: '',
    bunkerDate: '',
    identity,
  };
}

export function createEmptyDisponentRow() {
  return {
    id: newRowId('disp'),
    name: '',
  };
}

export function createEmptyVoyageEventRow() {
  return {
    id: newRowId('evt'),
    details: '',
    eventDate: '',
  };
}

export function createEmptyDetail(estimateType = 2) {
  const type = Number(estimateType) || 2;
  return {
    estimateType: type,
    estimateTypeLabel: ESTIMATE_TYPE_LABELS[type] ?? '',
    portLegs: [],
    cargoRows: [],
    overageCargoRows: [],
    deadfreightCargoRows: [],
    bunkerRows: [],
    orcRows: [],
    otherIncomeRows: [],
    hireRows: [],
    secaBunkerRows: [],
    freightQtyRows: [],
    tankerWsRows: [],
    offHireRows: [],
    passageLocations: [],
    consumptionRows: [],
    invoiceRows: [],
    deliveryBunkerRows: [],
    redeliveryBunkerRows: [],
    disponentRows: [],
    voyageEventRows: [],
    totalDays: '',
    totalDistance: '',
    cargoQuantity: '',
    dailyEarning: '',
    profitLoss: '',
    freightGross: '',
  };
}

export function toFormState(detail = {}) {
  const mapCargo = (row) => ({
    id: row.id || newRowId('cargo'),
    cargoId: row.cargoId != null ? String(row.cargoId) : '',
    cargoName: row.cargoName ?? '',
    cargoCbm: row.cargoCbm != null ? String(row.cargoCbm) : '',
    cargoMt: row.cargoMt != null ? String(row.cargoMt) : '',
    rateUsdMt: row.rateUsdMt != null ? String(row.rateUsdMt) : '',
    amountUsd: row.amountUsd != null ? String(row.amountUsd) : '',
    charterer: row.charterer ?? '',
    demAmt: row.demAmt != null ? String(row.demAmt) : '',
    vendorId: row.vendorId != null ? String(row.vendorId) : '',
    status: row.status ?? 1,
  });

  const cargoRows = Array.isArray(detail.cargoRows) && detail.cargoRows.length
    ? detail.cargoRows.map(mapCargo)
    : [createEmptyCargoRow(1)];

  const overageCargoRows = Array.isArray(detail.overageCargoRows) && detail.overageCargoRows.length
    ? detail.overageCargoRows.map(mapCargo)
    : [createEmptyCargoRow(2)];

  const deadfreightCargoRows = Array.isArray(detail.deadfreightCargoRows) && detail.deadfreightCargoRows.length
    ? detail.deadfreightCargoRows.map(mapCargo)
    : [createEmptyCargoRow(3)];

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
      secaDistance: row.secaDistance != null ? String(row.secaDistance) : '',
      secaDays: row.secaDays != null ? String(row.secaDays) : '',
      transitPortCost: row.transitPortCost != null ? String(row.transitPortCost) : '',
      ddcLpEst: row.ddcLpEst != null ? String(row.ddcLpEst) : '',
      ddcDpEst: row.ddcDpEst != null ? String(row.ddcDpEst) : '',
      chkLpSeca: !!row.chkLpSeca,
      chkDpSeca: !!row.chkDpSeca,
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

  const orcRows = Array.isArray(detail.orcRows) && detail.orcRows.length
    ? detail.orcRows.map((row) => ({
      id: row.id || newRowId('orc'),
      costId: row.costId != null ? String(row.costId) : '',
      costName: row.costName ?? '',
      amount: row.amount != null ? String(row.amount) : '',
      amountMt: row.amountMt != null ? String(row.amountMt) : '',
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
    }))
    : [createEmptyOrcRow()];

  const otherIncomeRows = Array.isArray(detail.otherIncomeRows) && detail.otherIncomeRows.length
    ? detail.otherIncomeRows.map((row) => ({
      id: row.id || newRowId('oi'),
      description: row.description ?? '',
      amount: row.amount != null ? String(row.amount) : '',
      addComm: row.addComm != null ? String(row.addComm) : '',
      netAmount: row.netAmount != null ? String(row.netAmount) : '',
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
    }))
    : [createEmptyOtherIncomeRow()];

  const hireRows = Array.isArray(detail.hireRows) && detail.hireRows.length
    ? detail.hireRows.map((row) => ({
      id: row.id || newRowId('hire'),
      hireFrom: row.hireFrom ?? '',
      hireTo: row.hireTo ?? '',
      hireDays: row.hireDays != null ? String(row.hireDays) : '',
      hireRate: row.hireRate != null ? String(row.hireRate) : '',
      hireAmt: row.hireAmt != null ? String(row.hireAmt) : '',
    }))
    : [createEmptyHireRow()];

  const secaBunkerRows = Array.isArray(detail.secaBunkerRows) && detail.secaBunkerRows.length
    ? detail.secaBunkerRows.map((row) => ({
      id: row.id || newRowId('seca'),
      bunkerGradeId: row.bunkerGradeId != null ? String(row.bunkerGradeId) : '',
      qty: row.qty != null ? String(row.qty) : '',
      price: row.price != null ? String(row.price) : '',
      cost: row.cost != null ? String(row.cost) : '',
      identify: row.identify || 'SECA',
      bunkerType: row.bunkerType || 'FO',
      calc: row.calc !== false,
    }))
    : [
      createEmptySecaBunkerRow('SECA', 'FO'),
      createEmptySecaBunkerRow('NON_SECA', 'FO'),
    ];

  const freightQtyRows = Array.isArray(detail.freightQtyRows) && detail.freightQtyRows.length
    ? detail.freightQtyRows.map((row) => ({
      id: row.id || newRowId('fq'),
      vendorId: row.vendorId != null ? String(row.vendorId) : '',
      agreedGrossFreight: row.agreedGrossFreight != null ? String(row.agreedGrossFreight) : '',
      quantity: row.quantity != null ? String(row.quantity) : '',
      grossFreight: row.grossFreight != null ? String(row.grossFreight) : '',
      brokeragePercent: row.brokeragePercent != null ? String(row.brokeragePercent) : '',
      netBrokerage: row.netBrokerage != null ? String(row.netBrokerage) : '',
      netFreight: row.netFreight != null ? String(row.netFreight) : '',
      netFreightPerMt: row.netFreightPerMt != null ? String(row.netFreightPerMt) : '',
      currencyId: row.currencyId != null ? String(row.currencyId) : '',
      localAgreedFreight: row.localAgreedFreight != null ? String(row.localAgreedFreight) : '',
      exchangeRate: row.exchangeRate != null ? String(row.exchangeRate) : '',
      cargoId: row.cargoId != null ? String(row.cargoId) : '',
    }))
    : [createEmptyFreightQtyRow()];

  const tankerWsRows = Array.isArray(detail.tankerWsRows) && detail.tankerWsRows.length
    ? detail.tankerWsRows.map((row) => ({
      id: row.id || newRowId('ws'),
      freightSpecs: row.freightSpecs ?? '',
      customerId: row.customerId != null ? String(row.customerId) : '',
      minCargoQty: row.minCargoQty != null ? String(row.minCargoQty) : '',
      oveCargoQty: row.oveCargoQty != null ? String(row.oveCargoQty) : '',
      minFlatRate: row.minFlatRate != null ? String(row.minFlatRate) : '',
      oveFlatRate: row.oveFlatRate != null ? String(row.oveFlatRate) : '',
      minWs: row.minWs != null ? String(row.minWs) : '',
      oveWs: row.oveWs != null ? String(row.oveWs) : '',
      minDisLeg: row.minDisLeg != null ? String(row.minDisLeg) : '',
      oveDisLeg: row.oveDisLeg != null ? String(row.oveDisLeg) : '',
      minDistance: row.minDistance != null ? String(row.minDistance) : '',
      oveDistance: row.oveDistance != null ? String(row.oveDistance) : '',
      minAmount: row.minAmount != null ? String(row.minAmount) : '',
      oveAmount: row.oveAmount != null ? String(row.oveAmount) : '',
      totalQty: row.totalQty != null ? String(row.totalQty) : '',
      totalAmount: row.totalAmount != null ? String(row.totalAmount) : '',
      wsFromPortId: row.wsFromPortId != null ? String(row.wsFromPortId) : '',
      wsFromPortName: row.wsFromPortName ?? '',
      wsToPortId: row.wsToPortId != null ? String(row.wsToPortId) : '',
      wsToPortName: row.wsToPortName ?? '',
    }))
    : [createEmptyTankerWsRow()];

  const offHireRows = Array.isArray(detail.offHireRows) && detail.offHireRows.length
    ? detail.offHireRows.map((row) => ({
      id: row.id || newRowId('off'),
      reason: row.reason ?? '',
      from: row.from ?? '',
      to: row.to ?? '',
      days: row.days != null ? String(row.days) : '',
      rate: row.rate != null ? String(row.rate) : '',
      amount: row.amount != null ? String(row.amount) : '',
      bunkers: Array.isArray(row.bunkers) && row.bunkers.length
        ? row.bunkers.map((b) => ({
          id: b.id || newRowId('offb'),
          bunkerGradeId: b.bunkerGradeId != null ? String(b.bunkerGradeId) : '',
          qty: b.qty != null ? String(b.qty) : '',
          price: b.price != null ? String(b.price) : '',
          amount: b.amount != null ? String(b.amount) : '',
          calc: b.calc !== false,
        }))
        : [{
          id: newRowId('offb'),
          bunkerGradeId: '',
          qty: '',
          price: '',
          amount: '',
          calc: true,
        }],
    }))
    : [createEmptyOffHireRow()];

  const passageLocations = Array.isArray(detail.passageLocations) && detail.passageLocations.length
    ? detail.passageLocations.map((row) => ({
      id: row.id || newRowId('loc'),
      fromLocation: row.fromLocation ?? '',
      toLocation: row.toLocation ?? '',
      passageType: row.passageType != null ? String(row.passageType) : '1',
      speedType: row.speedType != null ? String(row.speedType) : '1',
      distance: row.distance != null ? String(row.distance) : '',
    }))
    : [createEmptyPassageLocationRow()];

  const consumptionRows = Array.isArray(detail.consumptionRows) && detail.consumptionRows.length
    ? detail.consumptionRows.map((row) => ({
      id: row.id || newRowId('cons'),
      identify: row.identify || 'FO',
      bunkerGradeId: row.bunkerGradeId != null ? String(row.bunkerGradeId) : '',
      balSecaFs: row.balSecaFs != null ? String(row.balSecaFs) : '',
      ladSecaFs: row.ladSecaFs != null ? String(row.ladSecaFs) : '',
      balNonSecaFs: row.balNonSecaFs != null ? String(row.balNonSecaFs) : '',
      ladNonSecaFs: row.ladNonSecaFs != null ? String(row.ladNonSecaFs) : '',
      balSecaSs: row.balSecaSs != null ? String(row.balSecaSs) : '',
      ladSecaSs: row.ladSecaSs != null ? String(row.ladSecaSs) : '',
      balNonSecaSs: row.balNonSecaSs != null ? String(row.balNonSecaSs) : '',
      ladNonSecaSs: row.ladNonSecaSs != null ? String(row.ladNonSecaSs) : '',
      inPortSecaWorking: row.inPortSecaWorking != null ? String(row.inPortSecaWorking) : '',
      inPortNonSecaWorking: row.inPortNonSecaWorking != null ? String(row.inPortNonSecaWorking) : '',
      inPortSecaIdle: row.inPortSecaIdle != null ? String(row.inPortSecaIdle) : '',
      inPortNonSecaIdle: row.inPortNonSecaIdle != null ? String(row.inPortNonSecaIdle) : '',
    }))
    : [createEmptyConsumptionRow('FO'), createEmptyConsumptionRow('DO')];

  const invoiceRows = Array.isArray(detail.invoiceRows) && detail.invoiceRows.length
    ? detail.invoiceRows.map((row) => ({
      id: row.id || newRowId('inv'),
      invoiceId: row.invoiceId != null ? String(row.invoiceId) : '',
    }))
    : [createEmptyInvoiceRow()];

  const deliveryBunkerRows = Array.isArray(detail.deliveryBunkerRows) && detail.deliveryBunkerRows.length
    ? detail.deliveryBunkerRows.map((row) => ({
      id: row.id || newRowId('delb'),
      bunkerGradeId: row.bunkerGradeId != null ? String(row.bunkerGradeId) : '',
      qty: row.qty != null ? String(row.qty) : '',
      price: row.price != null ? String(row.price) : '',
      amount: row.amount != null ? String(row.amount) : '',
      bunkerDate: row.bunkerDate ?? '',
      identity: row.identity || 'DEL',
    }))
    : [createEmptyDeliveryBunkerRow('DEL')];

  const redeliveryBunkerRows = Array.isArray(detail.redeliveryBunkerRows) && detail.redeliveryBunkerRows.length
    ? detail.redeliveryBunkerRows.map((row) => ({
      id: row.id || newRowId('delb'),
      bunkerGradeId: row.bunkerGradeId != null ? String(row.bunkerGradeId) : '',
      qty: row.qty != null ? String(row.qty) : '',
      price: row.price != null ? String(row.price) : '',
      amount: row.amount != null ? String(row.amount) : '',
      bunkerDate: row.bunkerDate ?? '',
      identity: row.identity || 'REDEL',
    }))
    : [createEmptyDeliveryBunkerRow('REDEL')];

  const disponentRows = Array.isArray(detail.disponentRows) && detail.disponentRows.length
    ? detail.disponentRows.map((row) => ({
      id: row.id || newRowId('disp'),
      name: row.name ?? '',
    }))
    : detail.disponentOwner
      ? [{ id: newRowId('disp'), name: detail.disponentOwner }]
      : [createEmptyDisponentRow()];

  const voyageEventRows = Array.isArray(detail.voyageEventRows) && detail.voyageEventRows.length
    ? detail.voyageEventRows.map((row) => ({
      id: row.id || newRowId('evt'),
      details: row.details ?? '',
      eventDate: row.eventDate ?? '',
    }))
    : [createEmptyVoyageEventRow()];

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
    overageCargoRows,
    deadfreightCargoRows,
    portLegs,
    bunkerRows,
    orcRows,
    otherIncomeRows,
    hireRows,
    secaBunkerRows,
    freightQtyRows,
    tankerWsRows,
    offHireRows,
    passageLocations,
    consumptionRows,
    invoiceRows,
    deliveryBunkerRows,
    redeliveryBunkerRows,
    disponentRows,
    voyageEventRows,

    notes: detail.notes ?? '',
    ownerId: detail.ownerId != null ? String(detail.ownerId) : '',
    disponentOwner: detail.disponentOwner ?? '',
    attachments: detail.attachments ?? [],

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
    gasBaltic: detail.gasBaltic != null ? String(detail.gasBaltic) : '',
    gasBaseRate: detail.gasBaseRate != null ? String(detail.gasBaseRate) : '',
    addnlPremium: detail.addnlPremium != null ? String(detail.addnlPremium) : '',
    co2Price: detail.co2Price != null ? String(detail.co2Price) : '',
    euaPrice: detail.euaPrice != null ? String(detail.euaPrice) : '',
    vesselDailyOps: detail.vesselDailyOps != null ? String(detail.vesselDailyOps) : '',
    euEtsAddToFreight: !!detail.euEtsAddToFreight,
    fuelEuAddToFreight: !!detail.fuelEuAddToFreight,
    baseRateFloat: detail.baseRateFloat != null ? String(detail.baseRateFloat) : '',
    baseRateFixed: detail.baseRateFixed != null ? String(detail.baseRateFixed) : '',
    baseRateAverage: detail.baseRateAverage != null ? String(detail.baseRateAverage) : '',
    grossFreightFloat: detail.grossFreightFloat != null ? String(detail.grossFreightFloat) : '',
    grossFreightFixed: detail.grossFreightFixed != null ? String(detail.grossFreightFixed) : '',
    grossFreightAverage: detail.grossFreightAverage != null ? String(detail.grossFreightAverage) : '',
    netFreightFloat: detail.netFreightFloat != null ? String(detail.netFreightFloat) : '',
    netFreightFixed: detail.netFreightFixed != null ? String(detail.netFreightFixed) : '',
    netFreightAverage: detail.netFreightAverage != null ? String(detail.netFreightAverage) : '',
    tceFloat: detail.tceFloat != null ? String(detail.tceFloat) : '',
    tceFixed: detail.tceFixed != null ? String(detail.tceFixed) : '',
    tceAverage: detail.tceAverage != null ? String(detail.tceAverage) : '',
    totalPortCost: detail.totalPortCost != null ? String(detail.totalPortCost) : '',
    totalBunkerCost: detail.totalBunkerCost != null ? String(detail.totalBunkerCost) : '',
    totalSecaBunkerCost: detail.totalSecaBunkerCost != null ? String(detail.totalSecaBunkerCost) : '',
    totalOrcCost: detail.totalOrcCost != null ? String(detail.totalOrcCost) : '',
    totalOtherIncome: detail.totalOtherIncome != null ? String(detail.totalOtherIncome) : '',
    totalHireAmt: detail.totalHireAmt != null ? String(detail.totalHireAmt) : '',
    totalOffHireAmt: detail.totalOffHireAmt != null ? String(detail.totalOffHireAmt) : '',
    totalFreightQty: detail.totalFreightQty != null ? String(detail.totalFreightQty) : '',
    totalDays: detail.totalDays != null ? String(detail.totalDays) : '',
    totalDistance: detail.totalDistance != null ? String(detail.totalDistance) : '',
    cargoQuantity: detail.cargoQuantity != null ? String(detail.cargoQuantity) : '',
    revenue: detail.revenue != null ? String(detail.revenue) : '',
    voyageEarnings: detail.voyageEarnings != null ? String(detail.voyageEarnings) : '',
    dailyEarning: detail.dailyEarning != null ? String(detail.dailyEarning) : '',
    profitLoss: detail.profitLoss != null ? String(detail.profitLoss) : '',
  };
}
