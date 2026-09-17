/** Group agent port-cost lines into mockup-style categories by name match. */

export const COST_CATEGORIES = [
  {
    key: 'dues',
    title: 'Port Dues & Statutory Charges',
    color: 'navy',
    keywords: [
      'anchorage', 'berth', 'levy', 'harbour', 'harbor', 'light dues', 'lighthouse',
      'pollution', 'port authority', 'port charge', 'port health', 'port registration',
      'quarantine', 'qua dues', 'sanitary', 'security', 'isps', 'wharfage', 'detention',
      'threshold', 'web anchorage', 'empty water', 'compulsory port',
    ],
  },
  {
    key: 'agency',
    title: 'Agency, Financial & Communication',
    color: 'orange',
    keywords: [
      'agency', 'bank charge', 'communication', 'custom duty', 'custom overtime',
      'duty stamp', 'financial', 'freight tax', 'mobile', 'sundry tax', 'stamp fee',
      'steamer agent',
    ],
  },
  {
    key: 'customs',
    title: 'Customs, Immigration & Documentation',
    color: 'teal',
    keywords: [
      'custom', 'consulate', 'crew cache', 'dangerous cargo', 'health insurance',
      'immigration', 'inward clearance', 'marine insurance', 'oil pollution',
      'msc', 'merchant shipping', 'pty form', 'city transportation',
    ],
  },
  {
    key: 'pilotage',
    title: 'Pilotage, Towage & Launch Services',
    color: 'blue',
    keywords: [
      'boat hire', 'safety marshal', 'launch', 'draft survey', 'mooring', 'pilot',
      'escort', 'shifting', 'towage', 'tug', 'vessel tracking',
    ],
  },
  {
    key: 'cargo',
    title: 'Cargo, Survey & Vessel Operations',
    color: 'amber',
    keywords: [
      'bunker survey', 'handling', 'demurrage', 'dock labour', 'expediting',
      'hold clean', 'off hire', 'rent', 'storage', 'shipping coach', 'shore station',
      'slop', 'spare part', 'survey', 'tanker handling', 'terminal', 'transportation',
      'tank clean', 'vdt', 'con handling',
    ],
  },
  {
    key: 'misc',
    title: 'Miscellaneous & Sundry',
    color: 'grey',
    keywords: [
      'recycle', 'refuse', 'sundries', 'watchman', 'waterway', 'waste', 'overtime', 'yard',
    ],
  },
];

export function categorizeLineName(name) {
  const n = String(name || '').toLowerCase();
  for (const cat of COST_CATEGORIES) {
    if (cat.key === 'misc') continue;
    if (cat.keywords.some((kw) => n.includes(kw))) return cat.key;
  }
  return 'misc';
}

export function groupLinesByCategory(lines = []) {
  const buckets = Object.fromEntries(COST_CATEGORIES.map((c) => [c.key, []]));
  (lines || []).forEach((line, index) => {
    const key = categorizeLineName(line.name);
    buckets[key].push({ ...line, _index: index });
  });
  return COST_CATEGORIES.map((cat) => ({
    ...cat,
    lines: buckets[cat.key] || [],
  })).filter((cat) => cat.lines.length > 0);
}

export const CURRENCY_OPTIONS = ['USD', 'EURO', 'SGD', 'CNY', 'AED', 'JPY'];
