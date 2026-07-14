const BASE = '/api/internal-user/masters/other-misc-costs';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchOtherMiscCosts() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load other miscellaneous cost list.');
}

export async function fetchOtherMiscCost(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load other miscellaneous cost.');
}

export async function createOtherMiscCost(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create other miscellaneous cost.');
}

export async function updateOtherMiscCost(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update other miscellaneous cost.');
}

export async function updateOtherMiscCostStatus(id, status) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update other miscellaneous cost status.');
}
