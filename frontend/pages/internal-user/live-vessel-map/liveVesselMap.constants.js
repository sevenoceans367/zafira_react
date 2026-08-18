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

export const MAP_TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
export const MAP_ATTRIBUTION = 'Seven Oceans';
export const DEFAULT_MAP_CENTER = [20, 0];
export const DEFAULT_MAP_ZOOM = 3;
export const AUTO_LOAD_MAX_ZOOM = 4;
export const MAX_AUTO_ROUTES = 20;

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
