const BASE = '/api/internal-user/masters/port-data';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchPortDataLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load Port Data lookups.');
}

export async function fetchPortDataList() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load Port Data list.');
}

export async function fetchPortData(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load Port Data record.');
}

export async function createPortData(payload, files = []) {
  const body = new FormData();
  body.append('portId', payload.portId || '');
  body.append('terminalId', payload.terminalId || '');
  body.append('remarks', payload.remarks || '');
  body.append('materialIds', JSON.stringify(payload.materialIds || []));
  for (const file of files) {
    body.append('mul_file', file);
  }
  const response = await fetch(BASE, {
    method: 'POST',
    body,
  });
  return parseJson(response, 'Failed to create Port Data record.');
}

export async function updatePortData(id, payload, files = []) {
  const body = new FormData();
  body.append('remarks', payload.remarks || '');
  body.append('keepUpload', payload.keepUpload || '');
  body.append('keepUploadName', payload.keepUploadName || '');
  for (const file of files) {
    body.append('mul_file', file);
  }
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  });
  return parseJson(response, 'Failed to update Port Data record.');
}

export async function deletePortData(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return parseJson(response, 'Failed to delete Port Data record.');
}
