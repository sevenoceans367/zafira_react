import { isDbConfigured } from '../config.js';
import { getPool } from '../db.js';
import { detectCanalsFromWaypoints } from './canalOrcService.js';

const SEAMETRIX_ROUTES_URL =
  process.env.SEAMETRIX_ROUTES_URL
  || 'https://apipro.seametrix.net/api/GetRoutes?AccessKey=7oc3y5h2w2f';

const SEAMETRIX_PORTS_URL =
  process.env.SEAMETRIX_PORTS_URL
  || 'https://api-stolt.seametrix.net/api/GetPorts?AccessKey=7oc3y5h2w2f';

async function getPortRow(portId) {
  if (!portId || !isDbConfigured()) return null;
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT PortId, PortName, PortCode, COUNTRY_KEY FROM port_master WHERE PortId = ? LIMIT 1',
    [portId],
  );
  return rows[0] || null;
}

async function callSeametrixPorts(query) {
  const term = String(query || '').trim();
  if (!term) return [];

  const url = `${SEAMETRIX_PORTS_URL}&inText=${encodeURIComponent(term)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const err = new Error(`Port search API failed (${response.status}).`);
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  if (String(data.resultText || '').toLowerCase() !== 'success' || !Array.isArray(data.ports)) {
    return [];
  }
  return data.ports;
}

/**
 * Find/create local port_master rows from Seametrix GetPorts (PHP getportapi.php / options case 83).
 */
export async function searchEstimatePorts(query, limit = 25) {
  const ports = await callSeametrixPorts(query);
  if (!ports.length) return [];

  if (!isDbConfigured()) {
    return ports.slice(0, limit).map((p, index) => ({
      id: String(p.portCode || index),
      name: `${p.portName}(${p.country || ''})`,
      portCode: p.portCode || '',
    }));
  }

  const pool = getPool();
  const results = [];

  for (const port of ports.slice(0, limit)) {
    const portName = port.portName || '';
    const portCode = port.portCode || '';
    const country = port.country || '';
    if (!portCode) continue;

    const [byNameCode] = await pool.query(
      'SELECT PortId FROM port_master WHERE PortName = ? AND PortCode = ? LIMIT 1',
      [portName, portCode],
    );

    let portId = byNameCode[0]?.PortId;
    if (!portId) {
      const [byCode] = await pool.query(
        'SELECT PortId FROM port_master WHERE PortCode = ? LIMIT 1',
        [portCode],
      );
      portId = byCode[0]?.PortId;
    }

    if (!portId) {
      const [insert] = await pool.query(
        `INSERT INTO port_master (PortName, COUNTRY_KEY, PortCode, STATUS)
         VALUES (?, ?, ?, 1)`,
        [portName, country, portCode],
      );
      portId = insert.insertId;
    }

    results.push({
      id: String(portId),
      name: `${portName}(${country})`,
      portCode,
    });
  }

  return results;
}

/**
 * Resolve a Seametrix-valid port code for a local PortId.
 * Local catalog often has legacy codes (SG16) that Seametrix rejects.
 */
async function resolveSeametrixPortCode(portId) {
  const row = await getPortRow(portId);
  if (!row) return null;

  const candidates = await callSeametrixPorts(row.PortName || row.PortCode || '');
  if (!candidates.length && row.PortCode) {
    return row.PortCode;
  }

  let match = candidates.find((p) => String(p.portCode) === String(row.PortCode));
  if (!match) {
    match = candidates.find((p) => String(p.portName) === String(row.PortName));
  }
  if (!match && candidates.length) {
    // Prefer UN/LOCODE-like codes (e.g. SGSIN) over short legacy ones
    match = candidates.find((p) => /^[A-Z]{2}[A-Z0-9]{3}$/i.test(String(p.portCode || '')))
      || candidates[0];
  }

  const code = match?.portCode || row.PortCode || null;
  if (match?.portCode && isDbConfigured() && String(match.portCode) !== String(row.PortCode)) {
    // Keep the selected PortId stable but refresh code when Seametrix provides a better one
    // only for rows that still use legacy-style codes.
    const legacy = !/^[A-Z]{2}[A-Z0-9]{3}$/i.test(String(row.PortCode || ''));
    if (legacy) {
      const pool = getPool();
      await pool.query(
        'UPDATE port_master SET PortCode = ?, COUNTRY_KEY = COALESCE(NULLIF(?, ""), COUNTRY_KEY) WHERE PortId = ?',
        [match.portCode, match.country || '', portId],
      );
    }
  }

  return code;
}

function isPortNotFoundResult(text) {
  return /portcode not found/i.test(String(text || ''));
}

/**
 * Proxies Seametrix GetRoutes (PHP options.php case 82 / getdistanceapi.php).
 */
export async function fetchPortToPortDistance({
  startPortId,
  endPortId,
  startLon = 0,
  startLat = 0,
  endLon = 0,
  endLat = 0,
  greatCircleInterval = 0,
  secaAvoidance = 0,
  aslCompliance = 0,
  allowedAreas = [],
}) {
  if (!startPortId || !endPortId) {
    const err = new Error('Please select From Port and To Port');
    err.status = 400;
    throw err;
  }

  let [startPortCode, endPortCode] = await Promise.all([
    resolveSeametrixPortCode(startPortId),
    resolveSeametrixPortCode(endPortId),
  ]);

  if (!startPortCode || !endPortCode) {
    const err = new Error(
      'Seametrix port code not found. Re-select From/To ports using the port search.',
    );
    err.status = 400;
    throw err;
  }

  const areas = (Array.isArray(allowedAreas) ? allowedAreas : String(allowedAreas || '').split(','))
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  const callRoutes = async (startCode, endCode) => {
    const payload = [{
      StartLon: Number(startLon) || 0,
      StartLat: Number(startLat) || 0,
      StartPortCode: startCode,
      EndLon: Number(endLon) || 0,
      EndLat: Number(endLat) || 0,
      EndPortCode: endCode,
      GreatCircleInterval: Number(greatCircleInterval) || 0,
      AllowedAreas: areas,
      SecaAvoidance: Number(secaAvoidance) || 0,
      AslCompliance: Number(aslCompliance) || 0,
    }];

    const response = await fetch(SEAMETRIX_ROUTES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = new Error(`Distance API failed (${response.status}).`);
      err.status = 502;
      throw err;
    }

    const data = await response.json();
    const rows = Array.isArray(data) ? data : [data];
    return rows[0] || {};
  };

  let first = await callRoutes(startPortCode, endPortCode);

  // Fallback: if stored codes still rejected, re-resolve strictly from Seametrix first matches.
  if (isPortNotFoundResult(first.resultText) || !first.waypoints) {
    const [startRow, endRow] = await Promise.all([
      getPortRow(startPortId),
      getPortRow(endPortId),
    ]);
    const [startHits, endHits] = await Promise.all([
      callSeametrixPorts(startRow?.PortName || ''),
      callSeametrixPorts(endRow?.PortName || ''),
    ]);
    const nextStart = startHits[0]?.portCode;
    const nextEnd = endHits[0]?.portCode;
    if (nextStart && nextEnd && (nextStart !== startPortCode || nextEnd !== endPortCode)) {
      startPortCode = nextStart;
      endPortCode = nextEnd;
      first = await callRoutes(startPortCode, endPortCode);
    }
  }

  const waypoints = Array.isArray(first.waypoints)
    ? first.waypoints.map((wp) => ({
      lat: Number(wp.lat),
      lng: Number(wp.lon ?? wp.lng),
    })).filter((wp) => Number.isFinite(wp.lat) && Number.isFinite(wp.lng))
    : [];

  const resultText = first.resultText ?? first.ResultText ?? '';
  if (!waypoints.length || isPortNotFoundResult(resultText)) {
    const err = new Error(
      resultText.trim()
      || 'Route not found. Re-select From/To ports (use Seametrix port search).',
    );
    err.status = 400;
    throw err;
  }

  return {
    totalDistance: first.totalDistance ?? first.TotalDistance ?? 0,
    secaDistance: first.secaDistance ?? first.SecaDistance ?? 0,
    resultCode: first.resultCode ?? first.ResultCode ?? 0,
    resultText,
    waypoints,
    startPortCode,
    endPortCode,
    canals: detectCanalsFromWaypoints(waypoints),
  };
}
