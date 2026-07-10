const BASE = '/api/internal-user/fleet';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchFleetList({
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
  const response = await fetch(`${BASE}${query ? `?${query}` : ''}`);
  return parseJson(response, 'Failed to load fleet list.');
}

export async function fetchFleetCompare(vesselIds) {
  const response = await fetch(`${BASE}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vesselIds }),
  });
  return parseJson(response, 'Failed to compare vessels.');
}

export async function fetchVesselPrimary(vesselId) {
  const response = await fetch(`${BASE}/vessel/${encodeURIComponent(vesselId)}/primary`);
  return parseJson(response, 'Failed to load vessel.');
}

export async function updateVesselPrimary(vesselId, formData) {
  const response = await fetch(`${BASE}/vessel/${encodeURIComponent(vesselId)}/primary`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update vessel.');
  }
  return data;
}

export async function fetchVesselPrimaryLookups() {
  const response = await fetch(`${BASE}/vessel/new`);
  return parseJson(response, 'Failed to load vessel form.');
}

export async function createVesselPrimary(formData) {
  const response = await fetch(`${BASE}/vessel`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to create vessel.');
  }
  return data;
}
