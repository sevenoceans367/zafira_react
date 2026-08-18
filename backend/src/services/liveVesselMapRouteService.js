/**
 * Isolated Live Vessel Map sea-route lookup.
 * Uses Seametrix GetPorts + GetRoutes from AIS origin/destination names.
 * Does not write to port_master or change SOPF estimate distance code.
 */
const SEAMETRIX_ROUTES_URL =
  process.env.SEAMETRIX_ROUTES_URL
  || 'https://apipro.seametrix.net/api/GetRoutes?AccessKey=7oc3y5h2w2f';

const SEAMETRIX_PORTS_URL =
  process.env.SEAMETRIX_PORTS_URL
  || 'https://api-stolt.seametrix.net/api/GetPorts?AccessKey=7oc3y5h2w2f';

const FALLBACK_PORTS = {
  singapore: { lat: 1.2644, lng: 103.82, portName: 'Singapore', portCode: 'SGSIN' },
  rotterdam: { lat: 51.95, lng: 4.14, portName: 'Rotterdam', portCode: 'NLRTM' },
  fujairah: { lat: 25.12, lng: 56.35, portName: 'Fujairah', portCode: 'AEFJR' },
  houston: { lat: 29.73, lng: -95.27, portName: 'Houston', portCode: 'USHOU' },
  shanghai: { lat: 31.23, lng: 121.5, portName: 'Shanghai', portCode: 'CNSHA' },
  yokohama: { lat: 35.45, lng: 139.65, portName: 'Yokohama', portCode: 'JPTYO' },
  gibraltar: { lat: 36.14, lng: -5.35, portName: 'Gibraltar', portCode: 'GIGIB' },
  suez: { lat: 29.97, lng: 32.55, portName: 'Suez', portCode: 'EGSUZ' },
};

function toRad(value) {
  return (value * Math.PI) / 180;
}

function toDeg(value) {
  return (value * 180) / Math.PI;
}

function portCoords(port) {
  if (!port) return null;
  const lat = Number(port.lat ?? port.latitude ?? port.Lat ?? port.Latitude);
  const lng = Number(port.lon ?? port.lng ?? port.longitude ?? port.Lon ?? port.Longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function fallbackPort(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  const hit = Object.entries(FALLBACK_PORTS).find(([label]) => key.includes(label));
  return hit ? { ...hit[1] } : null;
}

function interpolateGreatCircle(start, end, steps = 36) {
  const lat1 = toRad(start.lat);
  const lng1 = toRad(start.lng);
  const lat2 = toRad(end.lat);
  const lng2 = toRad(end.lng);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2,
  ));
  if (!Number.isFinite(d) || d < 0.0001) {
    return [start, end];
  }

  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2);
    const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    points.push({
      lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
      lng: toDeg(Math.atan2(y, x)),
    });
  }
  return points;
}

function nmBetween(start, end) {
  const earthNm = 3440.065;
  const lat1 = toRad(start.lat);
  const lat2 = toRad(end.lat);
  const dLat = toRad(end.lat - start.lat);
  const dLng = toRad(end.lng - start.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthNm * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function searchSeametrixPorts(query) {
  const term = String(query || '').trim();
  if (!term) return [];
  const url = `${SEAMETRIX_PORTS_URL}&inText=${encodeURIComponent(term)}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  if (String(data.resultText || '').toLowerCase() !== 'success' || !Array.isArray(data.ports)) {
    return [];
  }
  return data.ports;
}

async function resolvePort(name) {
  const hits = await searchSeametrixPorts(name);
  const match = hits[0];
  if (match?.portCode) {
    const coords = portCoords(match) || fallbackPort(name) || fallbackPort(match.portName);
    return {
      portCode: match.portCode,
      portName: match.portName || name,
      country: match.country || '',
      lat: coords?.lat,
      lng: coords?.lng,
    };
  }
  const fallback = fallbackPort(name);
  if (!fallback) return null;
  return fallback;
}

async function fetchSeametrixRoute(startPort, endPort) {
  const payload = [{
    StartLon: Number(startPort.lng) || 0,
    StartLat: Number(startPort.lat) || 0,
    StartPortCode: startPort.portCode,
    EndLon: Number(endPort.lng) || 0,
    EndLat: Number(endPort.lat) || 0,
    EndPortCode: endPort.portCode,
    GreatCircleInterval: 0,
    AllowedAreas: [],
    SecaAvoidance: 0,
    AslCompliance: 0,
  }];

  const response = await fetch(SEAMETRIX_ROUTES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return null;

  const data = await response.json();
  const first = (Array.isArray(data) ? data[0] : data) || {};
  const waypoints = Array.isArray(first.waypoints)
    ? first.waypoints.map((wp) => ({
      lat: Number(wp.lat),
      lng: Number(wp.lon ?? wp.lng),
    })).filter((wp) => Number.isFinite(wp.lat) && Number.isFinite(wp.lng))
    : [];

  if (!waypoints.length) return null;

  return {
    waypoints,
    totalDistance: Number(first.totalDistance ?? first.TotalDistance ?? 0),
    source: 'seametrix',
  };
}

function buildFallbackRoute(startPort, endPort) {
  if (!Number.isFinite(startPort?.lat) || !Number.isFinite(endPort?.lat)) {
    return null;
  }
  const start = { lat: startPort.lat, lng: startPort.lng };
  const end = { lat: endPort.lat, lng: endPort.lng };
  return {
    waypoints: interpolateGreatCircle(start, end),
    totalDistance: Number(nmBetween(start, end).toFixed(1)),
    source: 'great-circle',
  };
}

export async function fetchDeclaredVoyageRoute({ origin, destination }) {
  const fromName = String(origin || '').trim();
  const toName = String(destination || '').trim();
  if (!fromName || !toName) {
    const err = new Error('Origin and destination are required to load a route.');
    err.status = 400;
    throw err;
  }

  const [startPort, endPort] = await Promise.all([
    resolvePort(fromName),
    resolvePort(toName),
  ]);

  if (!startPort || !endPort) {
    const err = new Error('Could not resolve origin or destination ports.');
    err.status = 404;
    throw err;
  }

  const seametrix = startPort.portCode && endPort.portCode
    ? await fetchSeametrixRoute(startPort, endPort)
    : null;
  const route = seametrix || buildFallbackRoute(startPort, endPort);

  if (!route?.waypoints?.length) {
    const err = new Error('No route waypoints returned.');
    err.status = 404;
    throw err;
  }

  return {
    origin: startPort.portName || fromName,
    destination: endPort.portName || toName,
    originCode: startPort.portCode || '',
    destinationCode: endPort.portCode || '',
    totalDistanceNm: route.totalDistance,
    source: route.source,
    waypoints: route.waypoints,
  };
}
