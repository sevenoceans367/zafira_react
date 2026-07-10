const BASE = '/api/internal-user/masters';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchAgencyFeeLookups() {
  const response = await fetch(`${BASE}/agency-fee-records/lookups`);
  return parseJson(response, 'Failed to load agency fee lookups.');
}

export async function fetchAgencyFeeRecords() {
  const response = await fetch(`${BASE}/agency-fee-records`);
  return parseJson(response, 'Failed to load agency fee records.');
}

export async function fetchAgencyFeeRecord(id) {
  const response = await fetch(`${BASE}/agency-fee-records/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load agency fee record.');
}

export async function createAgencyFeeRecord(payload) {
  const response = await fetch(`${BASE}/agency-fee-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create agency fee record.');
}

export async function updateAgencyFeeRecord(id, payload) {
  const response = await fetch(`${BASE}/agency-fee-records/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update agency fee record.');
}

export async function updateAgencyFeeRecordStatus(id, status) {
  const response = await fetch(`${BASE}/agency-fee-records/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update agency fee status.');
}

export async function searchMasterPorts(query) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  const response = await fetch(`${BASE}/ports?${params}`);
  return parseJson(response, 'Failed to search ports.');
}
