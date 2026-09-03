const BASE = '/api/internal-user/cargo-relets';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchStandaloneCargoRelets(params = {}) {
  const response = await fetch(`${BASE}${toQuery(params)}`);
  return parseJson(response, 'Failed to load cargo relets.');
}

export async function fetchStandaloneCargoRelet(fcaId) {
  const response = await fetch(`${BASE}/${encodeURIComponent(fcaId)}`);
  return parseJson(response, 'Failed to load cargo relet.');
}

export async function createStandaloneCargoRelet(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create cargo relet.');
}

export async function updateStandaloneCargoRelet(fcaId, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(fcaId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update cargo relet.');
}

export async function deleteStandaloneCargoRelet(fcaId) {
  const response = await fetch(`${BASE}/${encodeURIComponent(fcaId)}`, {
    method: 'DELETE',
  });
  return parseJson(response, 'Failed to delete cargo relet.');
}
