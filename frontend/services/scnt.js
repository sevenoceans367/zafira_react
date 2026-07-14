const BASE = '/api/internal-user/masters/scnt';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchScntLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load SCNT lookups.');
}

export async function fetchScntList() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load SCNT list.');
}

export async function fetchScnt(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load SCNT.');
}

export async function createScnt(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create SCNT.');
}

export async function updateScnt(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update SCNT.');
}

export async function updateScntStatus(id, status) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update SCNT status.');
}
