const BASE = '/api/internal-user/elibrary';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchElibraryLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load E-Library lookups.');
}

export async function fetchElibraryReferences({
  selCategory = '',
  selRefType = '',
  txtName = '',
} = {}) {
  const params = new URLSearchParams();
  if (selCategory) params.set('selCategory', selCategory);
  if (selRefType) params.set('selRefType', selRefType);
  if (txtName) params.set('txtName', txtName);
  const query = params.toString();
  const response = await fetch(`${BASE}${query ? `?${query}` : ''}`);
  return parseJson(response, 'Failed to load E-Library list.');
}

export async function fetchElibraryReference(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load E-Library reference.');
}

export async function createElibraryReference(payload, files = []) {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  for (const file of files) {
    formData.append('mul_file', file);
  }
  const response = await fetch(BASE, {
    method: 'POST',
    body: formData,
  });
  return parseJson(response, 'Failed to create E-Library reference.');
}

export async function updateElibraryReference(id, payload, {
  files = [],
  existingFiles = '',
  existingNames = '',
} = {}) {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  formData.append('existingFiles', existingFiles);
  formData.append('existingNames', existingNames);
  for (const file of files) {
    formData.append('mul_file', file);
  }
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: formData,
  });
  return parseJson(response, 'Failed to update E-Library reference.');
}

export async function deleteElibraryReference(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return parseJson(response, 'Failed to delete E-Library reference.');
}
