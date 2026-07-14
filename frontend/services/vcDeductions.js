const BASE = '/api/internal-user/masters/vc-deductions';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchVcDeductions() {
  const response = await fetch(BASE);
  return parseJson(response, 'Failed to load VC Deduction list.');
}

export async function fetchVcDeduction(id) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return parseJson(response, 'Failed to load VC Deduction.');
}

export async function createVcDeduction(payload) {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to create VC Deduction.');
}

export async function updateVcDeduction(id, payload) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to update VC Deduction.');
}

export async function updateVcDeductionStatus(id, status) {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson(response, 'Failed to update VC Deduction status.');
}
