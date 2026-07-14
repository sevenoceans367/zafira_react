import { appContext, isDbConfigured } from '../config.js';
import { getPool } from '../db.js';

export const CANAL_ORC_IDS = {
  suez: '73',
  turkish: '74',
  panama: '75',
};

export const CANAL_ORC_NAMES = {
  suez: 'Nominal Suez Canal Dues',
  turkish: 'Turkish Straits Levy',
  panama: 'Panama Canal Toll',
};

const CANAL_CHECKPOINTS = {
  turkish: [
    { lat: 40.019348, lng: 26.15383 },
    { lat: 41.241772, lng: 29.146912 },
  ],
  suez: [
    { lat: 29.921511, lng: 32.547523 },
    { lat: 31.27833, lng: 32.327744 },
  ],
  panama: [
    { lat: 9.2979, lng: -79.919098 },
    { lat: 8.887149, lng: -79.519516 },
  ],
};

function nearPoint(a, b, tolerance = 0.08) {
  return Math.abs(Number(a.lat) - Number(b.lat)) <= tolerance
    && Math.abs(Number(a.lng) - Number(b.lng)) <= tolerance;
}

export function detectCanalsFromWaypoints(waypoints = []) {
  const points = (waypoints || []).map((wp) => ({
    lat: Number(wp.lat),
    lng: Number(wp.lng ?? wp.lon),
  })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const hit = (key) => CANAL_CHECKPOINTS[key].some((cp) => (
    points.some((p) => nearPoint(p, cp))
  ));

  return {
    turkish: hit('turkish'),
    suez: hit('suez'),
    panama: hit('panama'),
  };
}

async function getTurkishRate(businessType) {
  if (!isDbConfigured()) return 0;
  const pool = getPool();
  const type = Number(businessType) || 2;
  const [rows] = await pool.query(
    `SELECT RATE
     FROM rate_net_ton_master
     WHERE STATUS = 1
       AND BUSINESS_TYPE = ?
       AND MODULEID = ?
       AND MCOMPANYID = ?
       AND (FROM_PERIOD IS NULL OR FROM_PERIOD <= CURDATE())
       AND (TO_PERIOD IS NULL OR TO_PERIOD >= CURDATE())
     ORDER BY FROM_PERIOD DESC
     LIMIT 1`,
    [type, appContext.moduleId, appContext.companyId],
  );
  if (rows[0]?.RATE != null) return Number(rows[0].RATE) || 0;

  const [fallback] = await pool.query(
    `SELECT RATE FROM rate_net_ton_master
     WHERE STATUS = 1 AND BUSINESS_TYPE = ?
     ORDER BY ID DESC LIMIT 1`,
    [type],
  );
  return Number(fallback[0]?.RATE) || 0;
}

async function getSuezScnt({ businessType, dwt, passageType, vesselType }) {
  if (!isDbConfigured()) return 0;
  const pool = getPool();
  const type = Number(businessType) || 2;
  const [rows] = await pool.query(
    `SELECT SCNT_BRACKET, SDR_TO_USE, SDR_RATE_BALLAST, SDR_RATE_LADEN_CRUDE, SDR_RATE_LADEN_PRODUCTS
     FROM sdr_rate_master
     WHERE STATUS = 1 AND BUISNESS_TYPE = ?
     ORDER BY ID ASC`,
    [type],
  );
  if (!rows.length) return 0;

  const isBallast = String(passageType) !== '2';
  const isProduct = /product|chemical|tanker/i.test(String(vesselType || ''));
  let remaining = Math.max(0, Number(dwt) || 0);
  let scnt = 0;

  for (const row of rows) {
    if (remaining <= 0) break;
    const bracket = Math.max(0, Number(row.SDR_TO_USE) || 0);
    const take = Math.min(remaining, bracket || remaining);
    let rate = Number(row.SDR_RATE_BALLAST) || 0;
    if (!isBallast) {
      rate = isProduct
        ? (Number(row.SDR_RATE_LADEN_PRODUCTS) || Number(row.SDR_RATE_LADEN_CRUDE) || 0)
        : (Number(row.SDR_RATE_LADEN_CRUDE) || 0);
    }
    scnt += take * rate;
    remaining -= take;
  }
  return scnt;
}

/**
 * Build canal ORC amounts (PHP useDistance + getratenetton/getsdrrates/getpanamarates).
 */
export async function getCanalOrcRates({
  turkish = false,
  suez = false,
  panama = false,
  businessType = 2,
  nrt = 0,
  dwt = 0,
  passageType = '1',
  vesselType = '',
  sdrToUsd = null,
}) {
  const sdr = Number(sdrToUsd) || Number(process.env.SDR_TO_USD) || 1.35;
  const rows = [];

  if (turkish) {
    const rate = await getTurkishRate(businessType);
    const amount = Math.round((Number(nrt) || 0) * rate * 100) / 100;
    rows.push({
      canal: 'turkish',
      costId: CANAL_ORC_IDS.turkish,
      costName: CANAL_ORC_NAMES.turkish,
      amount: String(amount),
      rate: String(rate),
    });
  }

  if (suez) {
    const scnt = await getSuezScnt({ businessType, dwt, passageType, vesselType });
    const amount = Math.round(scnt * sdr * 100) / 100;
    rows.push({
      canal: 'suez',
      costId: CANAL_ORC_IDS.suez,
      costName: CANAL_ORC_NAMES.suez,
      amount: String(amount),
      scnt: String(Math.round(scnt * 100) / 100),
      sdrToUsd: String(sdr),
    });
  }

  if (panama) {
    // Panama rate table/API not in this DB dump; create the ORC row for manual fill.
    rows.push({
      canal: 'panama',
      costId: CANAL_ORC_IDS.panama,
      costName: CANAL_ORC_NAMES.panama,
      amount: '0',
    });
  }

  return { sdrToUsd: String(sdr), rows };
}

export function getDefaultMarketPrices() {
  const vlsfo = Number(process.env.OIL_PRICE_VLSFO) || 0;
  const mgo = Number(process.env.OIL_PRICE_MGO) || 0;
  const euCarbon = Number(process.env.EUA_CARBON_EUR) || 0;
  const euToUsd = Number(process.env.EUA_TO_USD) || Number(process.env.EUR_USD) || 0;
  const euaPrice = euCarbon && euToUsd
    ? Math.round(euCarbon * euToUsd * 100) / 100
    : (Number(process.env.EUA_PRICE_USD) || 0);
  const sdrToUsd = Number(process.env.SDR_TO_USD) || 1.35;
  return {
    vlsfo: vlsfo ? String(vlsfo) : '',
    marineGasOil: mgo ? String(mgo) : '',
    euaPrice: euaPrice ? String(euaPrice) : '',
    sdrToUsd: String(sdrToUsd),
  };
}
