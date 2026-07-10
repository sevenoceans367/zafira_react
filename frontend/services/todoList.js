const BASE = '/api/internal-user/todo-list';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchTodoList({ tab, accountType, search } = {}) {
  const params = new URLSearchParams();
  if (tab) params.set('tab', tab);
  if (accountType) params.set('accountType', accountType);
  if (search) params.set('search', search);
  const query = params.toString();
  const response = await fetch(`${BASE}${query ? `?${query}` : ''}`);
  return parseJson(response, 'Failed to load to-do list.');
}

export async function inactiveTodoAlert(alertId) {
  const response = await fetch(`${BASE}/inactive/${encodeURIComponent(alertId)}`, {
    method: 'POST',
  });
  return parseJson(response, 'Failed to inactive alert.');
}

export async function updateTodoAlRem({ identify, identifyId, value }) {
  const response = await fetch(`${BASE}/al-rem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identify, identifyId, value }),
  });
  return parseJson(response, 'Failed to update accruals.');
}

export async function holdTodoPayment({ identify, identifyId }) {
  const response = await fetch(`${BASE}/hold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identify, identifyId }),
  });
  return parseJson(response, 'Failed to hold payment.');
}

export async function unholdTodoPayment({ identify, identifyId }) {
  const response = await fetch(`${BASE}/unhold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identify, identifyId }),
  });
  return parseJson(response, 'Failed to unhold payment.');
}
