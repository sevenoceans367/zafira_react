const BASE = '/api/internal-user/masters/sdr-rates';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchSdrRateLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load SDR Rate lookups.');
}

export async function fetchSdrRates() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load SDR Rate list.');
}

export async function fetchSdrRate(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load SDR Rate.');
}

export async function createSdrRate(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create SDR Rate.');
}

export async function updateSdrRate(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update SDR Rate.');
}

export async function updateSdrRateStatus(id, status) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update SDR Rate status.');
}
