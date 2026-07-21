/** Format a Date (or parseable value) as dd-mm-yyyy for legacy dryout APIs. */
export function formatDmyDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/** Convert YYYY-MM-DD (or Date) to dd-mm-yyyy for DmyDateInput. */
export function isoToDmy(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return formatDmyDate(value);
  const str = String(value).trim();
  if (/^\d{1,2}-\d{1,2}-\d{4}/.test(str)) {
    const [d, m, y] = str.split(/[-/]/);
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Convert dd-mm-yyyy to YYYY-MM-DD for APIs / SQL. */
export function dmyToIso(value) {
  if (value == null || value === '') return '';
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!match) return '';
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

/** Default dashboard from date — last 90 days (matches backend resolveDateRange). */
export function defaultDashboardFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return formatDmyDate(d);
}

/** Default dashboard to date — today. */
export function defaultDashboardToDate() {
  return formatDmyDate(new Date());
}
