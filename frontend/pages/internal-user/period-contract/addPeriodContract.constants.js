export const RECAP_STATUS_OPTIONS = [
  { id: 'Draft', name: 'Draft' },
  { id: 'On Subs', name: 'On Subs' },
  { id: 'Fixed', name: 'Fixed' },
];

export function createRowId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const ADDRESS_NOT_FOUND = 'address not found';

export function resolveChartererAddress(lookups, chartererCode) {
  const code = String(chartererCode || '').trim();
  if (!code) return '';
  const match = (lookups?.charterers || []).find((opt) => String(opt.id) === code);
  const address = String(match?.address || '').trim();
  return address || ADDRESS_NOT_FOUND;
}

function todayDmy() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${now.getFullYear()}`;
}

export const EMPTY_DELIVERY_NOTICE = () => ({
  id: createRowId(),
  notice: '',
  dateTime: '',
});

export const EMPTY_HIRE_RATE = () => ({
  id: createRowId(),
  hireFrom: '',
  hireTo: '',
  hireDays: '',
  hireRate: '',
  remarks: '',
});

export const EMPTY_BUNKER_ROW = () => ({
  id: createRowId(),
  gradeId: '',
  qty: '',
  date: '',
  price: '',
  amount: '',
});

export const EMPTY_OFF_HIRE_BUNKER = () => ({
  id: createRowId(),
  gradeId: '',
  qty: '',
  price: '',
  amount: '',
  ownerAccount: false,
});

export const EMPTY_OFF_HIRE = () => ({
  id: createRowId(),
  reason: '',
  from: '',
  to: '',
  days: '',
  rate: '',
  amount: '',
  bunkers: [EMPTY_OFF_HIRE_BUNKER()],
});

export const EMPTY_FORM = {
  contractId: '',
  contractNo: '',
  contractDate: '',
  ownBusinessAccount: '',
  businessType: '2',
  vesselType: '',
  vesselTypeId: '',
  vesselImoId: '',
  vesselName: '',
  currency: 'USD',
  owner: '',
  disOwner: '',
  charterer: '',
  manager: '',
  broker: '',
  charteringTeam: '',
  charteringPic: '',
  opsPic: '',
  recapStatus: 'Draft',
  cpType: '',
  lawArbit: '',
  charterersAddress: '',
  brokerage: '',
  hire: '',
  addComm: '',
  hireRemarks: '',
  laycanStart: '',
  laycanEnd: '',
  delPort: '',
  delPortLabel: '',
  deliveryDate: '',
  periodType: '1',
  periodMin: '',
  periodMax: '',
  aboutDaysMin: '0',
  aboutDaysMax: '0',
  reDelMinDate: '',
  reDelMaxDate: '',
  reDelPort: '',
  reDelPortLabel: '',
  redelRange: '',
  voyageDaysPerformed: '',
  tradeExclusions: '',
  cargoExclusions: '',
  intermediateHoldCleaning: '',
  remarks: '',
  dirtiesAllowed: '',
  dirtiesDone: '',
  dirtiesRemaining: '',
  holdCleaningMaterial: '',
  addnlPremiumHra: '',
  ilohc: '',
  legDetails: '',
  monthDays: '',
  deliveryNotices: [EMPTY_DELIVERY_NOTICE()],
  hireRates: [EMPTY_HIRE_RATE()],
  deliveryBunkers: [EMPTY_BUNKER_ROW()],
  redeliveryBunkers: [EMPTY_BUNKER_ROW()],
  offHires: [EMPTY_OFF_HIRE()],
};

function withAtLeastOne(rows, emptyFactory) {
  if (!rows?.length) return [emptyFactory()];
  return rows;
}

export function formFromPeriodContract(record) {
  return {
    ...EMPTY_FORM,
    contractId: record.contractId || '',
    contractNo: record.contractNo || '',
    contractDate: record.contractDate || '',
    ownBusinessAccount: record.ownBusinessAccount || '',
    businessType: record.businessType || '2',
    vesselType: record.vesselType || '',
    vesselTypeId: record.vesselTypeId || '',
    vesselImoId: record.vesselImoId || '',
    vesselName: record.vesselName || '',
    currency: record.currency || '',
    owner: record.owner || '',
    disOwner: record.disOwner || '',
    charterer: record.charterer || '',
    manager: record.manager || '',
    broker: record.broker || '',
    charteringTeam: record.charteringTeam || '',
    charteringPic: record.charteringPic || '',
    opsPic: record.opsPic || '',
    recapStatus: record.recapStatus || (Number(record.updateStatus) > 1 ? 'Fixed' : 'Draft'),
    cpType: record.cpType || '',
    lawArbit: record.lawArbit || '',
    charterersAddress: record.charterersAddress || '',
    brokerage: record.brokerage || '',
    hire: record.hire || '',
    addComm: record.addComm || '',
    hireRemarks: record.hireRemarks || '',
    laycanStart: record.laycanStart || '',
    laycanEnd: record.laycanEnd || '',
    delPort: record.delPort || '',
    delPortLabel: record.delPortLabel || '',
    deliveryDate: record.deliveryDate || '',
    periodType: record.periodType || '',
    periodMin: record.periodMin || '',
    periodMax: record.periodMax || '',
    aboutDaysMin: record.aboutDaysMin || '',
    aboutDaysMax: record.aboutDaysMax || '',
    reDelMinDate: record.reDelMinDate || '',
    reDelMaxDate: record.reDelMaxDate || '',
    reDelPort: record.reDelPort || '',
    reDelPortLabel: record.reDelPortLabel || '',
    redelRange: record.redelRange || '',
    voyageDaysPerformed: record.voyageDaysPerformed || '',
    tradeExclusions: record.tradeExclusions || '',
    cargoExclusions: record.cargoExclusions || '',
    intermediateHoldCleaning: record.intermediateHoldCleaning || '',
    remarks: record.remarks || '',
    dirtiesAllowed: record.dirtiesAllowed || '',
    dirtiesDone: record.dirtiesDone || '',
    dirtiesRemaining: record.dirtiesRemaining || '',
    holdCleaningMaterial: record.holdCleaningMaterial || '',
    addnlPremiumHra: record.addnlPremiumHra || '',
    ilohc: record.ilohc || '',
    legDetails: record.legDetails || '',
    monthDays: record.monthDays || '',
    deliveryNotices: withAtLeastOne(
      (record.deliveryNotices || []).map((row) => ({
        ...EMPTY_DELIVERY_NOTICE(),
        notice: row.notice || '',
        dateTime: row.dateTime || '',
      })),
      EMPTY_DELIVERY_NOTICE,
    ),
    hireRates: withAtLeastOne(
      (record.hireRates || []).map((row) => ({
        ...EMPTY_HIRE_RATE(),
        hireFrom: row.hireFrom || '',
        hireTo: row.hireTo || '',
        hireDays: row.hireDays || '',
        hireRate: row.hireRate || '',
        remarks: row.remarks || '',
      })),
      EMPTY_HIRE_RATE,
    ),
    deliveryBunkers: withAtLeastOne(
      (record.deliveryBunkers || []).map((row) => ({
        ...EMPTY_BUNKER_ROW(),
        gradeId: row.gradeId || '',
        qty: row.qty || '',
        date: row.date || '',
        price: row.price || '',
        amount: row.amount || '',
      })),
      EMPTY_BUNKER_ROW,
    ),
    redeliveryBunkers: withAtLeastOne(
      (record.redeliveryBunkers || []).map((row) => ({
        ...EMPTY_BUNKER_ROW(),
        gradeId: row.gradeId || '',
        qty: row.qty || '',
        date: row.date || '',
        price: row.price || '',
        amount: row.amount || '',
      })),
      EMPTY_BUNKER_ROW,
    ),
    offHires: withAtLeastOne(
      (record.offHires || []).map((row) => ({
        ...EMPTY_OFF_HIRE(),
        reason: row.reason || '',
        from: row.from || '',
        to: row.to || '',
        days: row.days || '',
        rate: row.rate || '',
        amount: row.amount || '',
        bunkers: withAtLeastOne(
          (row.bunkers || []).map((bunker) => ({
            ...EMPTY_OFF_HIRE_BUNKER(),
            gradeId: bunker.gradeId || '',
            qty: bunker.qty || '',
            price: bunker.price || '',
            amount: bunker.amount || '',
            ownerAccount: Boolean(bunker.ownerAccount),
          })),
          EMPTY_OFF_HIRE_BUNKER,
        ),
      })),
      EMPTY_OFF_HIRE,
    ),
  };
}

export function toCreatePayload(form, updateStatus) {
  return {
    contractId: form.contractId,
    contractNo: form.contractNo || form.contractId,
    contractDate: form.contractDate || todayDmy(),
    ownBusinessAccount: form.ownBusinessAccount || '',
    businessType: form.businessType || '2',
    vesselType: form.vesselTypeId || form.vesselType || '',
    vesselImoId: form.vesselImoId,
    vesselName: form.vesselName || '',
    currency: form.currency || 'USD',
    owner: form.owner,
    disOwner: form.disOwner,
    charterer: form.charterer,
    manager: form.manager,
    broker: form.broker,
    charteringTeam: form.charteringTeam,
    charteringPic: form.charteringPic,
    opsPic: form.opsPic,
    recapStatus: form.recapStatus,
    cpType: form.cpType,
    lawArbit: form.lawArbit,
    charterersAddress: form.charterersAddress,
    brokerage: form.brokerage,
    hire: form.hire,
    addComm: form.addComm,
    hireRemarks: form.hireRemarks,
    laycanStart: form.laycanStart,
    laycanEnd: form.laycanEnd,
    delPort: form.delPort,
    deliveryDate: form.deliveryDate,
    periodType: form.periodType,
    periodMin: form.periodMin,
    periodMax: form.periodMax,
    aboutDaysMin: form.aboutDaysMin,
    aboutDaysMax: form.aboutDaysMax,
    reDelMinDate: form.reDelMinDate,
    reDelMaxDate: form.reDelMaxDate,
    reDelPort: form.reDelPort,
    redelRange: form.redelRange,
    voyageDaysPerformed: form.voyageDaysPerformed,
    tradeExclusions: form.tradeExclusions,
    cargoExclusions: form.cargoExclusions,
    intermediateHoldCleaning: form.intermediateHoldCleaning,
    remarks: form.remarks,
    dirtiesAllowed: form.dirtiesAllowed,
    dirtiesDone: form.dirtiesDone,
    dirtiesRemaining: form.dirtiesRemaining,
    holdCleaningMaterial: form.holdCleaningMaterial,
    addnlPremiumHra: form.addnlPremiumHra,
    ilohc: form.ilohc,
    legDetails: form.legDetails,
    monthDays: form.monthDays,
    updateStatus,
    deliveryNotices: form.deliveryNotices
      .filter((row) => row.notice && row.dateTime)
      .map((row) => ({ notice: row.notice, dateTime: row.dateTime })),
    hireRates: form.hireRates
      .filter((row) => row.hireFrom && row.hireTo)
      .map((row) => ({
        hireFrom: row.hireFrom,
        hireTo: row.hireTo,
        hireDays: row.hireDays,
        hireRate: row.hireRate,
        remarks: row.remarks,
      })),
    deliveryBunkers: form.deliveryBunkers
      .filter((row) => row.gradeId && row.qty)
      .map((row) => ({
        gradeId: row.gradeId,
        qty: row.qty,
        date: row.date,
        price: row.price,
        amount: row.amount,
      })),
    redeliveryBunkers: form.redeliveryBunkers
      .filter((row) => row.gradeId && row.qty)
      .map((row) => ({
        gradeId: row.gradeId,
        qty: row.qty,
        date: row.date,
        price: row.price,
        amount: row.amount,
      })),
    offHires: form.offHires
      .filter((row) => row.reason)
      .map((row) => ({
        reason: row.reason,
        from: row.from,
        to: row.to,
        days: row.days,
        rate: row.rate,
        amount: row.amount,
        bunkers: row.bunkers
          .filter((bunker) => bunker.gradeId && bunker.amount !== '')
          .map((bunker) => ({
            gradeId: bunker.gradeId,
            qty: bunker.qty,
            price: bunker.price,
            amount: bunker.amount,
            ownerAccount: bunker.ownerAccount,
          })),
      })),
  };
}
