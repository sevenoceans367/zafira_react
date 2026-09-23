export const NAVIGATION_STATUSES = [
  'Under way using engine',
  'At anchor',
  'Not under command',
  'Restricted manoeuvrability',
  'Constrained by her draught',
  'Moored',
  'Aground',
  'Engaged in Fishing',
  'Under way sailing',
];

/** Carto basemap key (same as PHP Voyager URL). */
export const CARTO_MAP_KEY = 'cb1_3pmi_1_40cb27ab8de5ac6f6c43e06c';

export const MAP_STYLES = {
  voyager: {
    id: 'voyager',
    label: 'Voyager',
    url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_MAP_KEY}`,
  },
  light: {
    id: 'light',
    label: 'Light',
    url: `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CARTO_MAP_KEY}`,
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    // Voyager (no labels) + CSS tint → navy ocean / muted-blue land (flat dashboard look)
    url: `https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key=${CARTO_MAP_KEY}`,
    tileClassName: 'tilesDarkNavy',
    theme: 'dark',
  },
};

export const DEFAULT_MAP_STYLE = 'voyager';
export const MAP_TILE_URL = MAP_STYLES.voyager.url;
export const MAP_ATTRIBUTION = 'Seven Oceans';
export const DEFAULT_MAP_CENTER = [20, 0];
export const DEFAULT_MAP_ZOOM = 3;
export const AUTO_LOAD_MAX_ZOOM = 4;
export const SEARCH_MAP_ZOOM = 8;
export const MAX_AUTO_ROUTES = 20;

/** Continent labels for Dark map style (visible at low zoom only). */
export const CONTINENT_LABELS = [
  { name: 'NORTH AMERICA', lat: 45, lng: -100 },
  { name: 'SOUTH AMERICA', lat: -15, lng: -58 },
  { name: 'EUROPE', lat: 50, lng: 15 },
  { name: 'AFRICA', lat: 5, lng: 20 },
  { name: 'ASIA', lat: 45, lng: 90 },
  { name: 'OCEANIA', lat: -25, lng: 135 },
  { name: 'ANTARCTICA', lat: -82, lng: 0 },
];
export const CONTINENT_LABEL_MAX_ZOOM = 5;

export const ROUTE_COLORS = [
  '#274670',
  '#f4652c',
  '#6c47ff',
  '#0fa836',
  '#8b5e3c',
  '#1a8a9a',
  '#c0392b',
  '#2c5282',
];

/** Shipping hubs used to auto-load vessels when the page opens. */
export const AUTO_LOAD_HUBS = [
  { lat: 1.26, lng: 103.82, radius: 900 },
  { lat: 51.95, lng: 4.14, radius: 700 },
  { lat: 31.23, lng: 121.47, radius: 700 },
  { lat: 25.27, lng: 55.3, radius: 800 },
  { lat: 29.45, lng: -94.7, radius: 800 },
  { lat: 35.45, lng: 139.65, radius: 600 },
  { lat: -33.92, lng: 18.42, radius: 900 },
  { lat: 36.14, lng: -5.35, radius: 600 },
  { lat: 12.0, lng: 43.5, radius: 700 },
  { lat: 1.0, lng: -48.5, radius: 800 },
];

export function vesselDisplayName(vessel) {
  return String(vessel?.ShipName || vessel?.ImoNumber || 'Vessel').trim() || 'Vessel';
}

export function vesselField(vessel, key) {
  const value = vessel?.[key];
  if (value == null || String(value).trim() === '') return '';
  return String(value).trim();
}

export function voyageLegKey(origin, destination) {
  return `${String(origin || '').trim().toLowerCase()}|${String(destination || '').trim().toLowerCase()}`;
}

export function vesselVoyageLeg(vessel) {
  const origin = vesselField(vessel, 'OriginDeclared');
  const destination = vesselField(vessel, 'DestDeclared');
  if (!origin || !destination) return null;
  return { origin, destination, key: voyageLegKey(origin, destination) };
}

export function parseDraughtMeters(vessel) {
  const raw = vesselField(vessel, 'DraughtDeclared') || vesselField(vessel, 'Draught');
  const match = String(raw).match(/[\d.]+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function parseSpeedKnots(vessel) {
  const raw = vessel?.SpeedOverGround
    ?? vessel?.Speed
    ?? vessel?.Sog
    ?? vessel?.SOG
    ?? vessel?.SpeedKnots;
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function vesselNavStatus(vessel) {
  return vesselField(vessel, 'NavigationStatus')
    || vesselField(vessel, 'NavStatus')
    || vesselField(vessel, 'NavigationalStatus');
}

export function vesselMatchesFilters(vessel, filters = {}) {
  const {
    navStatuses = [],
    flag = '',
    draughtMin = '',
    draughtMax = '',
    speedMin = '',
    speedMax = '',
  } = filters;

  if (navStatuses.length) {
    const nav = vesselNavStatus(vessel).toLowerCase();
    if (nav && !navStatuses.some((status) => nav.includes(String(status).toLowerCase()))) {
      return false;
    }
    if (!nav) return false;
  }

  if (flag) {
    const shipFlag = vesselField(vessel, 'ShipFlag').toLowerCase();
    if (!shipFlag.includes(String(flag).toLowerCase())) return false;
  }

  const draught = parseDraughtMeters(vessel);
  if (draughtMin !== '' && draughtMin != null) {
    if (draught == null || draught < Number(draughtMin)) return false;
  }
  if (draughtMax !== '' && draughtMax != null) {
    if (draught == null || draught > Number(draughtMax)) return false;
  }

  const speed = parseSpeedKnots(vessel);
  if (speedMin !== '' && speedMin != null) {
    if (speed == null || speed < Number(speedMin)) return false;
  }
  if (speedMax !== '' && speedMax != null) {
    if (speed == null || speed > Number(speedMax)) return false;
  }

  return true;
}

export function collectFlags(vessels = []) {
  const set = new Set();
  vessels.forEach((vessel) => {
    const flag = vesselField(vessel, 'ShipFlag');
    if (flag) set.add(flag);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}
