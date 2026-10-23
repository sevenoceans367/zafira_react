const STATUS_KEY = 'zafira.periodContract.status';

export function parsePeriodListStatus(value) {
  if (value === 'closed' || value === 'completed' || value === '2') return 'closed';
  if (value === 'open' || value === 'active' || value === '1') return 'open';
  return '';
}

export function periodListStatusQuery(status) {
  return parsePeriodListStatus(status) === 'closed' ? 'completed' : 'active';
}

export function rememberPeriodListStatus(status) {
  const next = parsePeriodListStatus(status) || 'open';
  try {
    sessionStorage.setItem(STATUS_KEY, next);
  } catch {
    // Ignore private-mode storage failures.
  }
  return next;
}

export function readPeriodListStatus(searchParams) {
  const fromUrl = parsePeriodListStatus(searchParams?.get?.('status'));
  if (fromUrl) {
    rememberPeriodListStatus(fromUrl);
    return fromUrl;
  }
  try {
    return parsePeriodListStatus(sessionStorage.getItem(STATUS_KEY)) || 'open';
  } catch {
    return 'open';
  }
}

export function periodListReturnPath(listPath, extra = {}) {
  const params = new URLSearchParams();
  params.set('status', periodListStatusQuery(readPeriodListStatus()));
  Object.entries(extra).forEach(([key, value]) => {
    if (value == null || value === '') return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${listPath}?${query}` : listPath;
}
