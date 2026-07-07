const BASE = '/api/internal-user/sopf';

export async function fetchBusinessTypes(selectedId = '') {
  const params = selectedId ? `?selBType=${encodeURIComponent(selectedId)}` : '';
  const response = await fetch(`${BASE}/business_types${params}`);
  if (!response.ok) throw new Error('Failed to fetch business types.');
  return response.json();
}

export async function fetchEstimateList({ estimateType, businessType } = {}) {
  const params = new URLSearchParams();
  if (estimateType) params.set('estimatetype', String(estimateType));
  if (businessType) params.set('selBType', businessType);

  const query = params.toString();
  const response = await fetch(`${BASE}/estimate_list${query ? `?${query}` : ''}`);
  if (!response.ok) throw new Error('Failed to fetch estimate list.');
  return response.json();
}

export async function deleteEstimate(id) {
  const response = await fetch(`${BASE}/estimate_list/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete estimate.');
  return response.json();
}

export async function replicateEstimate(id) {
  const response = await fetch(`${BASE}/estimate_list/${id}/replicate`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to replicate estimate.');
  return response.json();
}

export async function fetchDecisionChart(estimateIds) {
  const response = await fetch(`${BASE}/decision_chart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: estimateIds }),
  });
  if (!response.ok) throw new Error('Failed to load decision chart.');
  return response.json();
}

export async function submitDecisionChart(payload) {
  const response = await fetch(`${BASE}/decision_chart/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to submit decision chart.');
  return response.json();
}
