export const PASSAGE_AREA_OPTIONS = [
  { id: 1, label: 'Bahamas Canal' },
  { id: 2, label: 'Magellan Strait' },
  { id: 3, label: 'Kiel Canal' },
  { id: 4, label: 'Oresund strait' },
  { id: 5, label: 'Panama Canal' },
  { id: 6, label: 'Corinth Canal' },
  { id: 7, label: 'Suez Canal' },
  { id: 8, label: 'Bonifacio Strait' },
  { id: 9, label: 'Providence Channel' },
  { id: 10, label: 'Messina Strait' },
  { id: 11, label: 'Spratly Passage' },
  { id: 12, label: 'Kanmon Strait' },
  { id: 13, label: 'La Perouse Strait' },
  { id: 14, label: 'Unimak Pass' },
  { id: 15, label: 'Hainan Strait' },
];

export const PIRACY_ZONE_OPTIONS = [
  { value: '', label: 'Somalia Zone 1 (farthest from Somalian coast, following the 65th meridian)' },
  { value: '10001', label: 'Somalia Zone 2 (Closer to Somalian coast, following the 60th meridian)' },
  { value: '10002', label: 'Somalia Zone 3 (Even closer to Somalian coast, 400-500n.m off coast)' },
  { value: '10003', label: 'Somalia Zone 4 (Very close to coast, 250-300n.m off coast)' },
  { value: '10004', label: 'NO Somalia Avoidance' },
];

export const NAVIGATION_METHOD_OPTIONS = [
  { value: '', label: '---Select From List---' },
  { value: '1', label: 'Great-Circle' },
  { value: '2', label: 'Rhumb-Line' },
];

export function defaultAllowedPassages() {
  return PASSAGE_AREA_OPTIONS.map((p) => p.id);
}
