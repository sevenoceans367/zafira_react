export function createRowId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  vesselImoId: '',
  currency: '',
  owner: '',
  disOwner: '',
  manager: '',
  broker: '',
  brokerage: '',
  hire: '',
  addComm: '',
  hireRemarks: '',
  laycanStart: '',
  laycanEnd: '',
  delPort: '',
  delPortLabel: '',
  deliveryDate: '',
  periodType: '',
  periodMin: '',
  periodMax: '',
  aboutDaysMin: '',
  aboutDaysMax: '',
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

export function toCreatePayload(form, updateStatus) {
  return {
    contractId: form.contractId,
    contractNo: form.contractNo,
    contractDate: form.contractDate,
    ownBusinessAccount: form.ownBusinessAccount,
    businessType: form.businessType,
    vesselType: form.vesselType,
    vesselImoId: form.vesselImoId,
    currency: form.currency,
    owner: form.owner,
    disOwner: form.disOwner,
    manager: form.manager,
    broker: form.broker,
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
