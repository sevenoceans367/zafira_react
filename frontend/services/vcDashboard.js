const BASE = '/api/internal-user/vc';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchVcDashboardMeta() {
  const response = await fetch(`${BASE}/meta`);
  return parseJson(response, 'Failed to load dashboard settings.');
}

export async function fetchVcBusinessTypes(selectedId = '2') {
  const params = selectedId ? `?selBType=${encodeURIComponent(selectedId)}` : '';
  const response = await fetch(`${BASE}/business_types${params}`);
  return parseJson(response, 'Failed to load business types.');
}

export async function fetchVcBusinessDashboard({ selBType, fromDate, toDate } = {}) {
  const params = new URLSearchParams();
  if (selBType) params.set('selBType', selBType);
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  const query = params.toString();
  const response = await fetch(`${BASE}/vc_dashboard${query ? `?${query}` : ''}`);
  return parseJson(response, 'Failed to load VC dashboard.');
}

export async function fetchTcBusinessDashboard({ selBType, fromDate, toDate } = {}) {
  const params = new URLSearchParams();
  if (selBType) params.set('selBType', selBType);
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  const query = params.toString();
  const response = await fetch(`${BASE}/tc_dashboard${query ? `?${query}` : ''}`);
  return parseJson(response, 'Failed to load TC dashboard.');
}

export async function fetchCoaList({
  selBType,
  fromDate,
  toDate,
  page,
  pageSize,
  search,
  sortColumn,
  sortDir,
} = {}) {
  const params = new URLSearchParams();
  if (selBType) params.set('selBType', selBType);
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  if (page) params.set('page', String(page));
  if (pageSize) params.set('pageSize', String(pageSize));
  if (search) params.set('search', search);
  if (sortColumn != null) params.set('sortColumn', String(sortColumn));
  if (sortDir) params.set('sortDir', sortDir);
  const query = params.toString();
  const response = await fetch(`${BASE}/coas${query ? `?${query}` : ''}`);
  return parseJson(response, 'Failed to load COA list.');
}

export async function fetchPeriodList({
  selBType,
  page,
  pageSize,
  search,
  sortColumn,
  sortDir,
} = {}) {
  const params = new URLSearchParams();
  if (selBType) params.set('selBType', selBType);
  if (page) params.set('page', String(page));
  if (pageSize) params.set('pageSize', String(pageSize));
  if (search) params.set('search', search);
  if (sortColumn != null) params.set('sortColumn', String(sortColumn));
  if (sortDir) params.set('sortDir', sortDir);
  const query = params.toString();
  const response = await fetch(`${BASE}/periods${query ? `?${query}` : ''}`);
  return parseJson(response, 'Failed to load period list.');
}

export async function fetchCoaShipments(coaId) {
  const response = await fetch(`${BASE}/coas/${encodeURIComponent(coaId)}/shipments`);
  return parseJson(response, 'Failed to load COA shipments.');
}

export async function fetchPerformingVessels({ kind = 'all', selBType } = {}) {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (selBType) params.set('selBType', selBType);
  const query = params.toString();
  const response = await fetch(`${BASE}/performing-vessels${query ? `?${query}` : ''}`);
  return parseJson(response, 'Failed to load performing vessels.');
}
