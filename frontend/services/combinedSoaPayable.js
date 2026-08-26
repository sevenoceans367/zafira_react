const BASE = '/api/internal-user/combined-soa-payable';

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

export async function fetchCombinedSoaPayableList(params = {}) {
  const response = await fetch(`${BASE}${toQuery(params)}`);
  return parseJson(response, 'Failed to load Combined SOA Payable list.');
}

export async function fetchCombinedSoaPayableTcList(params = {}) {
  const response = await fetch(`${BASE}/tc${toQuery(params)}`);
  return parseJson(response, 'Failed to load Combined SOA Payable TC list.');
}

export async function fetchGroupPaymentLookups() {
  const response = await fetch(`${BASE}/new`);
  return parseJson(response, 'Failed to load Group Payment form.');
}

export async function fetchGroupPaymentCostLines(params = {}) {
  const response = await fetch(`${BASE}/cost-lines${toQuery(params)}`);
  return parseJson(response, 'Failed to load voyage cost lines.');
}

export async function createGroupPayment(formData) {
  const response = await fetch(BASE, {
    method: 'POST',
    body: formData,
  });
  return parseJson(response, 'Failed to create group payment.');
}

export async function createGroupPaymentTc(formData) {
  const response = await fetch(`${BASE}/tc`, {
    method: 'POST',
    body: formData,
  });
  return parseJson(response, 'Failed to create TC group payment.');
}
