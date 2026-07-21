export const PASSAGE_AREA_OPTIONS = [
  { id: 1, label: 'Bahamas Canal', region: 'Americas' },
  { id: 2, label: 'Magellan Strait', region: 'Americas' },
  { id: 3, label: 'Kiel Canal', region: 'Europe' },
  { id: 4, label: 'Oresund strait', region: 'Europe' },
  { id: 5, label: 'Panama Canal', region: 'Americas' },
  { id: 6, label: 'Corinth Canal', region: 'Europe' },
  { id: 7, label: 'Suez Canal', region: 'Middle East / Africa' },
  { id: 8, label: 'Bonifacio Strait', region: 'Europe' },
  { id: 9, label: 'Providence Channel', region: 'Americas' },
  { id: 10, label: 'Messina Strait', region: 'Europe' },
  { id: 11, label: 'Spratly Passage', region: 'Asia-Pacific' },
  { id: 12, label: 'Kanmon Strait', region: 'Asia-Pacific' },
  { id: 13, label: 'La Perouse Strait', region: 'Asia-Pacific' },
  { id: 14, label: 'Unimak Pass', region: 'Asia-Pacific' },
  { id: 15, label: 'Hainan Strait', region: 'Asia-Pacific' },
];

export const PASSAGE_REGION_ORDER = [
  'Asia-Pacific',
  'Europe',
  'Americas',
  'Middle East / Africa',
];

export const PIRACY_ZONE_OPTIONS = [
  { value: '', label: 'Somalia Zone 1 (farthest from Somalian coast, following the 65th meridian)' },
  { value: '10001', label: 'Somalia Zone 2 (Closer to Somalian coast, following the 60th meridian)' },
  { value: '10002', label: 'Somalia Zone 3 (Even closer to Somalian coast, 400-500n.m off coast)' },
  { value: '10003', label: 'Somalia Zone 4 (Very close to coast, 250-300n.m off coast)' },
  { value: '10004', label: 'NO Somalia Avoidance' },
];

export const NAVIGATION_METHOD_OPTIONS = [
  { value: '', label: '— Select from list —' },
  { value: '1', label: 'Great-Circle' },
  { value: '2', label: 'Rhumb-Line' },
];

export function defaultAllowedPassages() {
  return PASSAGE_AREA_OPTIONS.map((p) => p.id);
}

export function groupPassagesByRegion(passages = PASSAGE_AREA_OPTIONS) {
  const byRegion = new Map();
  for (const region of PASSAGE_REGION_ORDER) {
    byRegion.set(region, []);
  }
  for (const passage of passages) {
    const region = passage.region || 'Other';
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push(passage);
  }
  return [...byRegion.entries()].filter(([, items]) => items.length > 0);
}
