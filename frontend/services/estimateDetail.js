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

export async function fetchVesselEstimatePrefill(vesselId) {
  if (!vesselId) return null;
  const response = await fetch(
    `${BASE}/vessels/${encodeURIComponent(vesselId)}/estimate-prefill`,
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error('Failed to load vessel details.');
  }
  return response.json();
}

export async function fetchPortDistance(payload) {
  const response = await fetch(`${BASE}/port-distance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch port distance.');
  }
  return data;
}

/** Seametrix-backed port search (PHP getportapi.php). */
export async function searchEstimatePorts(query) {
  const params = new URLSearchParams({ q: query || '' });
  const response = await fetch(`${BASE}/ports/search?${params}`);
  if (!response.ok) {
    throw new Error('Failed to search ports.');
  }
  const data = await response.json();
  return Array.isArray(data) ? data : (data.rows ?? []);
}

export async function fetchCanalOrcRates(payload) {
  const response = await fetch(`${BASE}/canal-orc-rates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to load canal ORC rates.');
  }
  return data;
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
