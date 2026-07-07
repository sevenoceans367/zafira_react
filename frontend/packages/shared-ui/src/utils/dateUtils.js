/** Format a Date (or parseable value) as dd-mm-yyyy for legacy dryout APIs. */
export function formatDmyDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
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
