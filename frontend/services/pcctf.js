const BASE = '/api/internal-user/masters/pcctf';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchPcctfLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load Panama Canal Capacity Tariff Fee lookups.');
}

export async function fetchPcctfList() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load Panama Canal Capacity Tariff Fee list.');
}

export async function fetchPcctf(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load Panama Canal Capacity Tariff Fee.');
}

export async function createPcctf(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create Panama Canal Capacity Tariff Fee.');
}

export async function updatePcctf(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update Panama Canal Capacity Tariff Fee.');
}

export async function updatePcctfStatus(id, status) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update Panama Canal Capacity Tariff Fee status.');
}
