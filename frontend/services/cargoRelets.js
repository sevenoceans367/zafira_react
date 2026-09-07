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
  const response = await fetch(`${BASE}${toQuery({
    ...params,
    standaloneOnly: params.standaloneOnly == null ? '1' : params.standaloneOnly,
  })}`);
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

export async function advanceStandaloneCargoReletOps(fcaId) {
  const response = await fetch(`${BASE}/${encodeURIComponent(fcaId)}/advance-ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return parseJson(response, 'Failed to advance cargo relet ops stage.');
}

export async function sendStandaloneCargoReletToOps(fcaId) {
  const response = await fetch(`${BASE}/${encodeURIComponent(fcaId)}/send-to-ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return parseJson(response, 'Failed to send cargo relet to Ops.');
}
