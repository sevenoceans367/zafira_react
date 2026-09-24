import { isDbConfigured } from '../config.js';
import { getPool } from '../db.js';

const EARTH_RADIUS_KM = 6371;

const MOCK_FLAGS = ['Panama', 'Liberia', 'Marshall Islands', 'Singapore', 'Malta', 'Hong Kong'];
const MOCK_NAV = [
  'Under way using engine',
  'At anchor',
  'Moored',
  'Restricted manoeuvrability',
  'Under way sailing',
];

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

const MOCK_VOYAGE_LEGS = [
  { origin: 'Singapore', destination: 'Rotterdam' },
  { origin: 'Fujairah', destination: 'Houston' },
  { origin: 'Shanghai', destination: 'Yokohama' },
  { origin: 'Rotterdam', destination: 'Gibraltar' },
  { origin: 'Houston', destination: 'Singapore' },
  { origin: 'Suez', destination: 'Fujairah' },
  { origin: 'Singapore', destination: 'Shanghai' },
];

let mockVesselSeq = 0;

function stripImo(value) {
  return String(value || '').replace(/^IMO/i, '').replace(/\D/g, '').trim();
}

function buildMockVessel(index, lat, lng) {
  const offsetLat = lat + (Math.random() - 0.5) * 0.8;
  const offsetLng = lng + (Math.random() - 0.5) * 0.8;
  const leg = MOCK_VOYAGE_LEGS[index % MOCK_VOYAGE_LEGS.length];
  const imoDigits = String(9310000 + index);

  return {
    DestDeclared: leg.destination,
    EtaDeclared: '2026-08-12',
    ImoNumber: imoDigits,
    MmsiNumber: `${636000000 + index}`,
    ShipName: MOCK_VESSEL_NAMES[index % MOCK_VESSEL_NAMES.length],
    OriginDeclared: leg.origin,
    PositionLastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' '),
    Latitude: Number(offsetLat.toFixed(5)),
    Longitude: Number(offsetLng.toFixed(5)),
    DraughtDeclared: `${(8 + Math.random() * 6).toFixed(1)} m`,
    ShipFlag: MOCK_FLAGS[index % MOCK_FLAGS.length],
    NavigationStatus: MOCK_NAV[index % MOCK_NAV.length],
    SpeedOverGround: Number((4 + Math.random() * 14).toFixed(1)),
  };
}

function authHeaders() {
  const token = process.env.VESSEL_POSITION_TOKEN
    || process.env.NAVAPI_SHIP_DETAILS_TOKEN
    || '';
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function fetchVesselsWithinRange({ lat, lng, radius, navstatus }) {
  const apiUrl = process.env.VESSEL_WITHIN_RANGE_API_URL;

  if (apiUrl) {
    const url = new URL(apiUrl);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lng', String(lng));
    url.searchParams.set('radius', String(radius));
    if (navstatus) url.searchParams.set('navstatus', navstatus);

    const response = await fetch(url.toString(), { headers: authHeaders() });
    if (!response.ok) {
      throw new Error(`Vessel API returned ${response.status}`);
    }

    const text = await response.text();
    const payload = JSON.parse(text);
    return normalizeWithinRangePayload(payload);
  }

  const count = Math.min(7, Math.max(2, Math.floor(Number(radius) / 100) + 2));
  const vessels = Array.from({ length: count }, (_, slot) => {
    const index = mockVesselSeq;
    mockVesselSeq += 1;
    const bearing = (360 / count) * slot + Math.random() * 20;
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

function normalizeWithinRangePayload(payload) {
  const resultCode = Number(payload?.Metadata?.ResultCode ?? payload?.resultCode ?? 200);
  const vessels = payload?.ApiResults?.mvsl_WithinRange
    ?? payload?.vessels
    ?? [];

  return {
    resultCode,
    vessels: Array.isArray(vessels) ? vessels : [],
  };
}

function pickLastPositionRecord(payload) {
  const results = payload?.ApiResults || {};
  const candidates = [
    results.svsl_LastPosition,
    results.mvsl_LastPosition,
    results.LastPosition,
    payload?.vessels,
    payload?.vessel,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate[0];
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) return candidate;
  }
  return null;
}

async function resolveImoCandidates({ imo, mmsi, name }) {
  const direct = stripImo(imo);
  if (direct) return [{ imo: direct, shipName: '', mmsi: '' }];

  if (!isDbConfigured()) return [];

  const pool = getPool();
  const mmsiQ = String(mmsi || '').trim();
  const nameQ = String(name || '').trim();

  if (mmsiQ) {
    const [rows] = await pool.query(
      `SELECT IMO_NO, VESSEL_NAME, MMSI_NO
       FROM vessel_imo_master
       WHERE MMSI_NO = ? OR MMSI_NO LIKE ?
       ORDER BY VESSEL_NAME
       LIMIT 10`,
      [mmsiQ, `%${mmsiQ}%`],
    ).catch(() => [[]]);
    return (rows || [])
      .map((row) => ({
        imo: stripImo(row.IMO_NO),
        shipName: row.VESSEL_NAME || '',
        mmsi: row.MMSI_NO || mmsiQ,
      }))
      .filter((row) => row.imo);
  }

  if (nameQ.length >= 2) {
    const like = `%${nameQ}%`;
    const [rows] = await pool.query(
      `SELECT IMO_NO, VESSEL_NAME, MMSI_NO
       FROM vessel_imo_master
       WHERE VESSEL_NAME LIKE ? OR IMO_NO LIKE ?
       ORDER BY VESSEL_NAME
       LIMIT 10`,
      [like, like],
    ).catch(() => [[]]);
    return (rows || [])
      .map((row) => ({
        imo: stripImo(row.IMO_NO),
        shipName: row.VESSEL_NAME || '',
        mmsi: row.MMSI_NO || '',
      }))
      .filter((row) => row.imo);
  }

  return [];
}

async function callLastPositionApi(imo, { timeoutMs = 4000, signal } = {}) {
  const controller = new AbortController();
  const timer = timeoutMs > 0
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const proxyUrl = process.env.VESSEL_LAST_POSITION_API_URL;
    if (proxyUrl) {
      const url = new URL(proxyUrl);
      url.searchParams.set('imo', imo);
      const response = await fetch(url.toString(), {
        headers: authHeaders(),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Last position API returned ${response.status}`);
      return JSON.parse(await response.text());
    }

    const navUrl = process.env.NAVAPI_LAST_POSITION_URL
      || 'https://v1.navapi.pro/aisp/svsl/LastPosition';
    const token = process.env.VESSEL_POSITION_TOKEN || process.env.NAVAPI_SHIP_DETAILS_TOKEN;
    if (!token) return null;

    const url = new URL(navUrl);
    url.searchParams.set('IMO', imo);
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`NavAPI LastPosition returned ${response.status}`);
    return JSON.parse(await response.text());
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function mockLastPositionForCandidate(candidate, index = 0) {
  const hubs = [
    [1.26, 103.82],
    [51.95, 4.14],
    [25.27, 55.3],
    [29.45, -94.7],
  ];
  const [lat, lng] = hubs[index % hubs.length];
  const vessel = buildMockVessel(Number(candidate.imo.slice(-4)) || index, lat, lng);
  vessel.ImoNumber = candidate.imo;
  if (candidate.shipName) vessel.ShipName = candidate.shipName;
  if (candidate.mmsi) vessel.MmsiNumber = candidate.mmsi;
  return vessel;
}

/**
 * Resolve IMO / MMSI / name → last AIS position (NavAPI LastPosition, PHP getvesselpositionapi.php).
 */
export async function fetchVesselLastPosition({ imo = '', mmsi = '', name = '', q = '' } = {}) {
  let queryImo = imo;
  let queryMmsi = mmsi;
  let queryName = name;

  const free = String(q || '').trim();
  if (free && !queryImo && !queryMmsi && !queryName) {
    if (/^\d{7}$/.test(free) || /^IMO\d+$/i.test(free)) queryImo = free;
    else if (/^\d{9}$/.test(free)) queryMmsi = free;
    else queryName = free;
  }

  let candidates = await resolveImoCandidates({
    imo: queryImo,
    mmsi: queryMmsi,
    name: queryName,
  });

  if (!candidates.length && stripImo(queryImo)) {
    candidates = [{ imo: stripImo(queryImo), shipName: '', mmsi: '' }];
  }


  if (!candidates.length) {
    const error = new Error('No vessel matched that search.');
    error.status = 404;
    throw error;
  }

  const vessels = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      const payload = await callLastPositionApi(candidate.imo);
      if (payload) {
        const resultCode = Number(payload?.Metadata?.ResultCode ?? 200);
        const record = pickLastPositionRecord(payload);
        if (resultCode === 200 && record) {
          vessels.push({
            ...record,
            ImoNumber: record.ImoNumber || candidate.imo,
            ShipName: record.ShipName || candidate.shipName || record.ShipName,
            MmsiNumber: record.MmsiNumber || candidate.mmsi || record.MmsiNumber,
          });
          continue;
        }
      }
    } catch {
      // fall through to mock for local/dev
    }
    vessels.push(mockLastPositionForCandidate(candidate, i));
  }

  return {
    resultCode: 200,
    vessels,
    vessel: vessels[0] || null,
  };
}

/**
 * Batch AIS last positions for known IMOs.
 * Skips DB name/MMSI resolution (IMOs already known) and uses higher concurrency + timeouts.
 */
export async function fetchLastPositionsForImos(
  imoList = [],
  { concurrency = 12, timeoutMs = 4000 } = {},
) {
  const unique = [...new Set((imoList || []).map(stripImo).filter(Boolean))];
  const vessels = [];
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const index = cursor;
      cursor += 1;
      const imo = unique[index];
      try {
        const payload = await callLastPositionApi(imo, { timeoutMs });
        if (!payload) continue;
        const resultCode = Number(payload?.Metadata?.ResultCode ?? 200);
        const record = pickLastPositionRecord(payload);
        if (resultCode === 200 && record) {
          const lat = Number(record.Latitude ?? record.latitude ?? record.Lat ?? record.lat);
          const lng = Number(
            record.Longitude ?? record.longitude ?? record.Lon ?? record.lon ?? record.Lng,
          );
          vessels.push({
            ...record,
            ImoNumber: record.ImoNumber || imo,
            Latitude: Number.isFinite(lat) ? lat : record.Latitude,
            Longitude: Number.isFinite(lng) ? lng : record.Longitude,
          });
        }
      } catch {
        // skip failed / timed-out IMOs — map falls back to approx position
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), unique.length || 1) },
    () => worker(),
  );
  await Promise.all(workers);
  return vessels;
}
