const BASE = '/api/internal-user/coa';

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

export async function fetchCoaLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load COA lookups.');
}

export async function fetchRunningCoas(params = {}) {
  const response = await fetch(`${BASE}/running${toQuery(params)}`);
  return parseJson(response, 'Failed to load running COAs.');
}

export async function fetchCoa(coaId) {
  const response = await fetch(`${BASE}/running/${encodeURIComponent(coaId)}`);
  return parseJson(response, 'Failed to load COA.');
}

export async function createCoa(payload) {
  const response = await fetch(`${BASE}/running`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create COA.');
}

export async function updateCoa(coaId, payload) {
  const response = await fetch(`${BASE}/running/${encodeURIComponent(coaId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update COA.');
}

export async function cancelCoa(coaId, remarks) {
  const response = await fetch(`${BASE}/running/${encodeURIComponent(coaId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remarks }),
  });
  return parseJson(response, 'Failed to cancel COA.');
}

export async function saveCoaMonthlyRemarks(coaId, remarks) {
  const response = await fetch(`${BASE}/running/${encodeURIComponent(coaId)}/monthly-remarks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remarks }),
  });
  return parseJson(response, 'Failed to save monthly remarks.');
}

export async function fetchCoaNominations(coaId) {
  const response = await fetch(`${BASE}/running/${encodeURIComponent(coaId)}/nominations`);
  return parseJson(response, 'Failed to load COA nominations.');
}

export async function fetchCargoRelets(params = {}) {
  const response = await fetch(`${BASE}/cargo-relets${toQuery(params)}`);
  return parseJson(response, 'Failed to load cargo relets.');
}

export async function fetchCargoRelet(fcaId) {
  const response = await fetch(`${BASE}/cargo-relets/${encodeURIComponent(fcaId)}`);
  return parseJson(response, 'Failed to load cargo relet.');
}

export async function createCargoRelet(payload) {
  const response = await fetch(`${BASE}/cargo-relets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create cargo relet.');
}

export async function updateCargoRelet(fcaId, payload) {
  const response = await fetch(`${BASE}/cargo-relets/${encodeURIComponent(fcaId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update cargo relet.');
}

export async function deleteCargoRelet(fcaId) {
  const response = await fetch(`${BASE}/cargo-relets/${encodeURIComponent(fcaId)}`, {
    method: 'DELETE',
  });
  return parseJson(response, 'Failed to delete cargo relet.');
}

export async function fetchCoaOpsVoyages(params = {}) {
  const response = await fetch(`${BASE}/ops${toQuery(params)}`);
  return parseJson(response, 'Failed to load COA operations.');
}

export async function moveVoyageToPostOps(comId) {
  const response = await fetch(`${BASE}/ops/${encodeURIComponent(comId)}/post-ops`, {
    method: 'POST',
  });
  return parseJson(response, 'Failed to move voyage to Post Ops.');
}

export async function fetchDirectFixtures(params = {}) {
  const response = await fetch(`${BASE}/direct-fixtures${toQuery(params)}`);
  return parseJson(response, 'Failed to load direct fixtures.');
}

export async function fetchDirectFixture(fcaId) {
  const response = await fetch(`${BASE}/direct-fixtures/${encodeURIComponent(fcaId)}`);
  return parseJson(response, 'Failed to load direct fixture.');
}

export async function createDirectFixture(payload) {
  const response = await fetch(`${BASE}/direct-fixtures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create direct fixture.');
}

export async function updateDirectFixture(fcaId, payload) {
  const response = await fetch(`${BASE}/direct-fixtures/${encodeURIComponent(fcaId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update direct fixture.');
}

export async function completeDirectFixture(fcaId) {
  const response = await fetch(`${BASE}/direct-fixtures/${encodeURIComponent(fcaId)}/complete`, {
    method: 'POST',
  });
  return parseJson(response, 'Failed to complete direct fixture.');
}
