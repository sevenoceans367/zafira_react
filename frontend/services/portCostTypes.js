const BASE = '/api/internal-user/masters/port-cost-types';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchPortCostTypeLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load port cost type lookups.');
}

export async function fetchPortCostTypes() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load port cost type list.');
}

export async function fetchPortCostType(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load port cost type.');
}

export async function createPortCostTypes(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create port cost type.');
}

export async function updatePortCostType(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update port cost type.');
}

export async function updatePortCostTypeStatus(id, status) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update port cost type status.');
}
