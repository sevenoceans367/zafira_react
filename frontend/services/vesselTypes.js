const BASE = '/api/internal-user/masters/vessel-types';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchVesselTypeLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load Vessel Type lookups.');
}

export async function fetchVesselTypes() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load Vessel Type list.');
}

export async function fetchVesselType(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load Vessel Type.');
}

export async function createVesselType(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create Vessel Type.');
}

export async function updateVesselType(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update Vessel Type.');
}
