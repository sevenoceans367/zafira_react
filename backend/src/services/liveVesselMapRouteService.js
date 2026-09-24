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
  sikka: { lat: 22.43, lng: 69.83, portName: 'Sikka', portCode: 'INSIK' },
  venice: { lat: 45.438, lng: 12.336, portName: 'Venice', portCode: 'ITVCE' },
  venezia: { lat: 45.438, lng: 12.336, portName: 'Venice', portCode: 'ITVCE' },
};

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

/**
 * Best-effort lat/lng for a worksheet port label without calling Seametrix.
 * Used when AIS last-position is missing so pins are near the voyage ports
 * instead of unrelated hub cities.
 */
export function approxCoordsForPortLabel(rawLabel) {
  const candidates = portSearchCandidates(rawLabel);
  for (const candidate of candidates) {
    const hit = fallbackPort(candidate);
    if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) {
      return { lat: hit.lat, lng: hit.lng, portName: hit.portName || candidate };
    }
  }
  return null;
}

/**
 * Worksheet labels look like: "Sikka / Valupir / Reliance-Sikka (IND)".
 * Seametrix needs a short searchable name — try primary segments first.
 */
function portSearchCandidates(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  const withoutCountry = text.replace(/\s*\([^)]*\)\s*$/g, '').trim();
  const slashParts = withoutCountry
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates = [];
  const push = (value) => {
    const next = String(value || '').trim();
    if (!next) return;
    if (!candidates.some((item) => item.toLowerCase() === next.toLowerCase())) {
      candidates.push(next);
    }
  };

  // Prefer first slash segment (usual PortName before aliases).
  for (const part of slashParts) push(part);
  for (const part of slashParts) {
    for (const token of part.split(/[-–—]/).map((t) => t.trim()).filter(Boolean)) {
      push(token);
    }
  }
  push(withoutCountry);
  push(text);

  // Shorter queries match Seametrix better.
  return candidates.sort((a, b) => a.length - b.length || a.localeCompare(b));
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
  const candidates = portSearchCandidates(name);
  for (const candidate of candidates) {
    try {
      const hits = await searchSeametrixPorts(candidate);
      const match = hits[0];
      if (match?.portCode) {
        const coords = portCoords(match) || fallbackPort(candidate) || fallbackPort(match.portName);
        return {
          portCode: match.portCode,
          portName: match.portName || candidate,
          country: match.country || '',
          lat: coords?.lat,
          lng: coords?.lng,
        };
      }
    } catch {
      // try next candidate
    }
    const fallback = fallbackPort(candidate);
    if (fallback) return fallback;
  }
  return null;
}

async function fetchSeametrixRoute(startPort, endPort) {
  const payload = [{
    StartLon: Number(startPort.lng) || 0,
    StartLat: Number(startPort.lat) || 0,
    StartPortCode: startPort.portCode || '',
    EndLon: Number(endPort.lng) || 0,
    EndLat: Number(endPort.lat) || 0,
    EndPortCode: endPort.portCode || '',
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

  const hasCoords = Number.isFinite(startPort.lat) && Number.isFinite(endPort.lat)
    && Number.isFinite(startPort.lng) && Number.isFinite(endPort.lng);
  const hasCodes = Boolean(startPort.portCode && endPort.portCode);
  // Sea routes only — never fall back to great-circle (crosses land).
  const route = (hasCodes || hasCoords)
    ? await fetchSeametrixRoute(startPort, endPort)
    : null;

  if (!route?.waypoints?.length) {
    const err = new Error('No sea-route waypoints returned from Seametrix.');
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
