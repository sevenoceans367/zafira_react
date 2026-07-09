const EARTH_RADIUS_KM = 6371;

function toRad(value) {
  return (value * Math.PI) / 180;
}

function toDeg(value) {
  return (value * 180) / Math.PI;
}

/** Destination point given start lat/lng, bearing (deg), distance (km). */
function destinationPoint(lat, lng, bearingDeg, distanceKm) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lng1 = toRad(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance)
      + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  );

  return [toDeg(lat2), toDeg(lng2)];
}

const MOCK_VESSEL_NAMES = [
  'Atlantic Pioneer',
  'Pacific Star',
  'Ocean Voyager',
  'Northern Spirit',
  'Southern Cross',
  'Eastern Horizon',
  'Western Wind',
];

function buildMockVessel(index, lat, lng) {
  const offsetLat = lat + (Math.random() - 0.5) * 0.8;
  const offsetLng = lng + (Math.random() - 0.5) * 0.8;

  return {
    DestDeclared: 'Rotterdam',
    EtaDeclared: '2026-08-12',
    ImoNumber: `IMO${9310000 + index}`,
    MmsiNumber: `${636000000 + index}`,
    ShipName: MOCK_VESSEL_NAMES[index % MOCK_VESSEL_NAMES.length],
    OriginDeclared: 'Singapore',
    PositionLastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' '),
    Latitude: Number(offsetLat.toFixed(5)),
    Longitude: Number(offsetLng.toFixed(5)),
    DraughtDeclared: `${(8 + Math.random() * 6).toFixed(1)} m`,
    ShipFlag: 'Panama',
  };
}

export async function fetchVesselsWithinRange({ lat, lng, radius, navstatus }) {
  const apiUrl = process.env.VESSEL_WITHIN_RANGE_API_URL;

  if (apiUrl) {
    const url = new URL(apiUrl);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lng', String(lng));
    url.searchParams.set('radius', String(radius));
    if (navstatus) url.searchParams.set('navstatus', navstatus);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Vessel API returned ${response.status}`);
    }

    const text = await response.text();
    const payload = JSON.parse(text);
    return normalizeApiPayload(payload);
  }

  const count = Math.min(7, Math.max(2, Math.floor(Number(radius) / 100) + 2));
  const vessels = Array.from({ length: count }, (_, index) => {
    const bearing = (360 / count) * index + Math.random() * 20;
    const distanceKm = Math.random() * Number(radius);
    const [vLat, vLng] = destinationPoint(Number(lat), Number(lng), bearing, distanceKm);
    const vessel = buildMockVessel(index, vLat, vLng);
    vessel.Latitude = Number(vLat.toFixed(5));
    vessel.Longitude = Number(vLng.toFixed(5));
    return vessel;
  });

  return {
    resultCode: 200,
    vessels,
  };
}

function normalizeApiPayload(payload) {
  const resultCode = Number(payload?.Metadata?.ResultCode ?? payload?.resultCode ?? 200);
  const vessels = payload?.ApiResults?.mvsl_WithinRange
    ?? payload?.vessels
    ?? [];

  return {
    resultCode,
    vessels: Array.isArray(vessels) ? vessels : [],
  };
}
