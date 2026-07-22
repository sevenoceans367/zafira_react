import { appContext, isMgmtUser } from '../config.js';
import { getPool } from '../db.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

/** Canonical vessel-type series shown on the chart (matches PHP amCharts fields). */
export const VESSEL_TYPE_SERIES = [
  { key: 'Handymax', match: ['HANDYMAX'] },
  { key: 'Kamsarmax', match: ['KAMSARMAX'] },
  { key: 'Panamax', match: ['PANAMAX'] },
  { key: 'Supramax', match: ['SUPRAMAX'] },
  { key: 'Ultramax', match: ['ULTRAMAX'] },
  { key: 'Handysize', match: ['HANDYSIZE'] },
  { key: 'Capesize', match: ['CAPESIZE'] },
  { key: 'Chemical_Oil', match: ['CHEMICAL/OIL', 'CHEMICAL OIL', 'CHEMICAL'], label: 'Chemical/Oil' },
  { key: 'Oil', match: ['OIL'] },
  { key: 'SDBC', match: ['SDBC'] },
];

function normalizeTypeLabel(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function mapToSeriesKey(rawType) {
  const normalized = normalizeTypeLabel(rawType);
  if (!normalized) return null;
  for (const series of VESSEL_TYPE_SERIES) {
    if (series.match.some((m) => normalized === m || normalized.endsWith(m))) {
      return series.key;
    }
  }
  // Fallback: keep unknown types as their own series key
  return normalized.replace(/[^A-Za-z0-9]+/g, '_');
}

function estimateTypeFilter(selBType, alias = 'm') {
  const value = String(selBType || '').trim();
  if (!value) return { sql: '', params: [] };
  return { sql: ` AND ${alias}.ESTIMATE_TYPE = ? `, params: [value] };
}

/**
 * Vessel Yearly Performance — voyage counts by vessel type per financial year (F_YEAR).
 * Mirrors php/reports/vessel_yearly_performance.php.
 */
export async function dbVesselYearlyPerformance(filters = {}) {
  const pool = getPool();
  const typeFilter = estimateTypeFilter(filters.selBType);

  const [rows] = await pool.query(
    `SELECT m.F_YEAR AS year,
            m.COMID,
            COALESCE(
              NULLIF(TRIM(SUBSTRING_INDEX(vt.VesselType, '-', -1)), ''),
              NULLIF(TRIM(vt.VesselType), ''),
              'Unknown'
            ) AS vesselType
     FROM freight_cost_estimete_master m
     INNER JOIN freight_cost_estimate_compare c ON c.FCAID = m.FCAID
     INNER JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN vessel_type_master vt ON vt.VesselTypeId = v.VESSEL_TYPE
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND m.COMID IS NOT NULL
       AND m.COMID != ''
       AND m.F_YEAR IS NOT NULL
       AND m.F_YEAR != ''
       ${typeFilter.sql}
     GROUP BY m.COMID
     ORDER BY m.F_YEAR ASC`,
    [MODULE_ID, COMPANY_ID, ...typeFilter.params],
  );

  const byYear = new Map();
  const dynamicKeys = new Set(VESSEL_TYPE_SERIES.map((s) => s.key));

  for (const row of rows) {
    const year = String(row.year || '').trim();
    if (!year) continue;
    const seriesKey = mapToSeriesKey(row.vesselType) || 'Unknown';
    dynamicKeys.add(seriesKey);
    if (!byYear.has(year)) byYear.set(year, {});
    const bucket = byYear.get(year);
    bucket[seriesKey] = (bucket[seriesKey] || 0) + 1;
  }

  const years = [...byYear.keys()].sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b)));
  const seriesKeys = [
    ...VESSEL_TYPE_SERIES.map((s) => s.key),
    ...[...dynamicKeys].filter((k) => !VESSEL_TYPE_SERIES.some((s) => s.key === k)).sort(),
  ];

  const currentYear = String(new Date().getFullYear());
  const chart = years.map((year) => {
    const counts = byYear.get(year) || {};
    const point = { year, toDate: year === currentYear };
    let total = 0;
    for (const key of seriesKeys) {
      const value = Number(counts[key]) || 0;
      point[key] = value;
      total += value;
    }
    point.Total = total;
    return point;
  });

  const records = chart.map((point, index) => {
    const row = {
      id: point.year,
      srNo: index + 1,
      year: point.toDate ? `${point.year} (to date)` : point.year,
      total: point.Total,
    };
    for (const key of seriesKeys) {
      row[key] = point[key] || 0;
    }
    return row;
  });

  const series = seriesKeys
    .filter((key) => chart.some((p) => Number(p[key]) > 0))
    .map((key) => {
      const known = VESSEL_TYPE_SERIES.find((s) => s.key === key);
      return {
        key,
        label: known?.label || key.replace(/_/g, '/'),
      };
    });

  return {
    records,
    recordsTotal: records.length,
    chart,
    series,
    isMgmtUser: isMgmtUser(),
  };
}
