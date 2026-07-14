const BASE = '/api/internal-user/masters/port-information';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchPortInformationLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load Port Information lookups.');
}

export async function fetchPortInformationTerminals(portId) {
  const params = new URLSearchParams();
  if (portId) params.set('portId', portId);
  const response = await fetch(`${BASE}/terminals?${params}`);
  return parseJson(response, 'Failed to load terminals.');
}

export async function fetchPortInformationList() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load Port Information list.');
}

export async function fetchPortInformation(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load Port Information record.');
}

export async function createPortInformation(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create Port Information record.');
}

export async function updatePortInformation(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update Port Information record.');
}

export async function updatePortInformationStatus(id, status) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update status.');
}
