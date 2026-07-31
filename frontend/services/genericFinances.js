const BASE = '/api/internal-user/generic-finances';

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

export async function fetchGenericFinancesList(params = {}) {
  const response = await fetch(`${BASE}${toQuery(params)}`);
  return parseJson(response, 'Failed to load Generic Finances list.');
}

export async function fetchGenericFinanceBusinessTypes(selBType = '2') {
  const response = await fetch(`${BASE}/business-types${toQuery({ selBType })}`);
  return parseJson(response, 'Failed to load business types.');
}

export async function fetchGenericFinanceYears() {
  const response = await fetch(`${BASE}/years`);
  return parseJson(response, 'Failed to load years.');
}

export async function fetchGenericInvoiceLookups() {
  const response = await fetch(`${BASE}/new`);
  return parseJson(response, 'Failed to load invoice form.');
}

export async function fetchBankingDetail(bdId) {
  const response = await fetch(`${BASE}/banking/${encodeURIComponent(bdId)}`);
  return parseJson(response, 'Failed to load banking details.');
}

export async function fetchVendorBanking(vendorId) {
  const response = await fetch(`${BASE}/vendors/${encodeURIComponent(vendorId)}/banking`);
  return parseJson(response, 'Failed to load vendor banking.');
}

export async function createGenericInvoice(formData) {
  const response = await fetch(BASE, {
    method: 'POST',
    body: formData,
  });
  return parseJson(response, 'Failed to create invoice.');
}

export async function cancelGenericFinanceInvoice(invoiceId) {
  const response = await fetch(`${BASE}/${encodeURIComponent(invoiceId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return parseJson(response, 'Failed to cancel invoice.');
}

export async function receiveGenericFinancePayment(invoiceId, body = {}) {
  const response = await fetch(`${BASE}/${encodeURIComponent(invoiceId)}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(response, 'Failed to record payment.');
}
