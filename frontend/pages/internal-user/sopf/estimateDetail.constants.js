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

export function createEmptyDetail(estimateType = 2) {
  const type = Number(estimateType) || 2;
  return {
    estimateType: type,
    estimateTypeLabel: ESTIMATE_TYPE_LABELS[type] ?? '',
    portLegs: [],
    totalDays: '',
    cargoQuantity: '',
    dailyEarning: '',
    profitLoss: '',
  };
}

export function toFormState(detail) {
  return {
    fixtureTypeId: detail.fixtureTypeId ? String(detail.fixtureTypeId) : '',
    vesselImoId: detail.vesselImoId ? String(detail.vesselImoId) : '',
    vesselName: detail.vesselName ?? '',
    vesselType: detail.vesselType ?? '',
    flag: detail.flag ?? '',
    transDate: detail.transDate ?? formatTodayDmy(),
    voyageNo: detail.voyageNo ?? '',
    voyageName: detail.voyageName ?? '',
    dwtSummer: detail.dwtSummer ?? '',
    gnrt: detail.gnrt ?? '',
    loa: detail.loa ?? '',
    tpc: detail.tpc ?? '',
  };
}
