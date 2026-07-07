export const FIXTURE_TYPE_OPTIONS = [
  { value: '1', label: 'TCIN-VCOUT' },
  { value: '2', label: 'VCIN-VCOUT' },
  { value: '3', label: 'VCOUT' },
];

export function getFixtureTypeLabel(fixtureTypeId) {
  return FIXTURE_TYPE_OPTIONS.find((option) => option.value === String(fixtureTypeId))?.label ?? '';
}

export function toFormState(detail) {
  return {
    fixtureTypeId: detail.fixtureTypeId ? String(detail.fixtureTypeId) : '',
    vesselName: detail.vesselName ?? '',
    vesselType: detail.vesselType ?? '',
    flag: detail.flag ?? '',
    transDate: detail.transDate ?? '',
    voyageNo: detail.voyageNo ?? '',
    voyageName: detail.voyageName ?? '',
    dwtSummer: detail.dwtSummer ?? '',
    gnrt: detail.gnrt ?? '',
    loa: detail.loa ?? '',
    tpc: detail.tpc ?? '',
  };
}
