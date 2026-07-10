const BASE = '/api/internal-user/masters/elibrary-reference-types';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchElibraryReferenceTypes() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load E-Library reference type list.');
}

export async function fetchElibraryReferenceType(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load E-Library reference type.');
}

export async function createElibraryReferenceType(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create E-Library reference type.');
}

export async function updateElibraryReferenceType(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update E-Library reference type.');
}

export async function updateElibraryReferenceTypeStatus(id, status) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update E-Library reference type status.');
}
