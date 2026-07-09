/** Navigation status options — matches vessel_positions.php */
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
export const RESULT_MAP_ZOOM = 6;

export const VESSEL_POPUP_FIELDS = [
  { key: 'DestDeclared', label: 'Destination' },
  { key: 'EtaDeclared', label: 'ETA' },
  { key: 'ImoNumber', label: 'IMO No.' },
  { key: 'MmsiNumber', label: 'MMSI No.' },
  { key: 'ShipName', label: 'Name' },
  { key: 'OriginDeclared', label: 'Origin' },
  { key: 'PositionLastUpdated', label: 'Last Position' },
  { key: 'Latitude', label: 'Latitude' },
  { key: 'Longitude', label: 'Longitude' },
  { key: 'DraughtDeclared', label: 'Draught' },
  { key: 'ShipFlag', label: 'Flag' },
];
