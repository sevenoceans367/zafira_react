const BASE = '/api/internal-user/period-contracts';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchPeriodContractLookups() {
  const response = await fetch(`${BASE}/lookups`);
  return parseJson(response, 'Failed to load period contract form.');
}

export async function searchPeriodContractPorts(query) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  const response = await fetch(`${BASE}/ports?${params}`);
  return parseJson(response, 'Failed to search ports.');
}

export async function fetchPeriodContract(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load period contract.');
}

export async function fetchPeriodLinkedVoyage(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/voyage`);
  return parseJson(response, 'Failed to load period voyage.');
}

export async function fetchPeriodNominations(id, { selBType } = {}) {
  const params = new URLSearchParams();
  if (selBType) params.set('selBType', selBType);
  const query = params.toString();
  const response = await fetch(
    `${BASE}/${encodeURIComponent(id)}/nominations${query ? `?${query}` : ''}`,
  );
  return parseJson(response, 'Failed to load period nominations.');
}

export async function createPeriodContract(payload, files = []) {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  for (const file of files) {
    formData.append('attach_file', file);
  }

  const response = await fetch(BASE, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to create period contract.');
  }
  return data;
}

export async function updatePeriodContract(id, payload, {
  files = [],
  existingFiles = [],
  existingNames = [],
} = {}) {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  formData.append('existingFiles', existingFiles.join(','));
  formData.append('existingNames', existingNames.join(','));
  for (const file of files) {
    formData.append('attach_file', file);
  }

  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update period contract.');
  }
  return data;
}

export async function fetchPeriodContractList({
  selBType,
  status,
  page,
  pageSize,
  search,
  sortColumn,
  sortDir,
} = {}) {
  const params = new URLSearchParams();
  if (selBType) params.set('selBType', selBType);
  if (status) params.set('status', status);
  if (page) params.set('page', String(page));
  if (pageSize) params.set('pageSize', String(pageSize));
  if (search) params.set('search', search);
  if (sortColumn != null) params.set('sortColumn', String(sortColumn));
  if (sortDir) params.set('sortDir', sortDir);
  const query = params.toString();
  const response = await fetch(`${BASE}${query ? `?${query}` : ''}`);
  return parseJson(response, 'Failed to load period contract list.');
}
