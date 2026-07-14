const BASE = '/api/internal-user/masters/pcftf';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchPcftfLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load Panama Canal Fixed Transit Fee lookups.');
}

export async function fetchPcftfList() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load Panama Canal Fixed Transit Fee list.');
}

export async function fetchPcftf(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load Panama Canal Fixed Transit Fee.');
}

export async function createPcftf(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create Panama Canal Fixed Transit Fee.');
}

export async function updatePcftf(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update Panama Canal Fixed Transit Fee.');
}

export async function updatePcftfStatus(id, status) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update Panama Canal Fixed Transit Fee status.');
}
