const BASE = '/api/internal-user/masters/msds';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchMsdsLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load MSDS lookups.');
}

export async function fetchMsdsList() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load MSDS list.');
}

export async function fetchMsds(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load MSDS record.');
}

export async function createMsds(payload, files = []) {
  const body = new FormData();
  body.append('materialId', payload.materialId || '');
  body.append('portId', payload.portId || '');
  body.append('vendorId', payload.vendorId || '');
  body.append('remarks', payload.remarks || '');
  for (const file of files) {
    body.append('mul_file', file);
  }
  const response = await fetch(BASE, {
    method: 'POST',
    body,
  });
  return parseJson(response, 'Failed to create MSDS record.');
}

export async function updateMsds(id, payload, files = []) {
  const body = new FormData();
  body.append('materialId', payload.materialId || '');
  body.append('portId', payload.portId || '');
  body.append('vendorId', payload.vendorId || '');
  body.append('remarks', payload.remarks || '');
  for (const file of files) {
    body.append('mul_file', file);
  }
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  });
  return parseJson(response, 'Failed to update MSDS record.');
}

export async function deleteMsds(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return parseJson(response, 'Failed to delete MSDS record.');
}
