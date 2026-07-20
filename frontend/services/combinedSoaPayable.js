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
