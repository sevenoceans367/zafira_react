const BASE = '/api/internal-user/masters/rate-net-tons';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchRateNetTonLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load Rate Net Ton lookups.');
}

export async function fetchRateNetTons() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load Rate Net Ton list.');
}

export async function fetchRateNetTon(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load Rate Net Ton.');
}

export async function createRateNetTon(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create Rate Net Ton.');
}

export async function updateRateNetTon(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update Rate Net Ton.');
}

export async function updateRateNetTonStatus(id, status) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update Rate Net Ton status.');
}
