const BASE = '/api/internal-user/sopf';

export async function fetchEstimateDetail(id) {
  const response = await fetch(`${BASE}/estimates/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error('Failed to load estimate.');
  }
  return response.json();
}

export async function fetchEstimateLookups(estimateType) {
  const params = new URLSearchParams({ estimateType: String(estimateType || 2) });
  const response = await fetch(`${BASE}/estimates/lookups?${params}`);
  if (!response.ok) {
    throw new Error('Failed to load estimate lookups.');
  }
  return response.json();
}

export async function fetchPeriodPrefill(periodId) {
  if (!periodId) return null;
  const response = await fetch(`${BASE}/estimates/period-prefill/${encodeURIComponent(periodId)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error('Failed to load period contract prefill.');
  }
  return response.json();
}

export async function searchVessels(query) {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${BASE}/vessels/search?${params}`);
  if (!response.ok) {
    throw new Error('Failed to search vessels.');
  }
  const data = await response.json();
  return data.rows ?? [];
}

export async function createEstimateDetail(payload, files = []) {
  const body = new FormData();
  body.append('payload', JSON.stringify(payload));
  for (const file of files) {
    body.append('attach_file', file);
  }
  const response = await fetch(`${BASE}/estimates`, {
    method: 'POST',
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to create estimate.');
  }
  return data;
}

export async function updateEstimateDetail(id, payload, files = []) {
  const body = new FormData();
  body.append('payload', JSON.stringify(payload));
  for (const file of files) {
    body.append('attach_file', file);
  }
  const response = await fetch(`${BASE}/estimates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update estimate.');
  }
  return data;
}
