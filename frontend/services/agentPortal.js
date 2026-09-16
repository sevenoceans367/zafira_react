const BASE = '/api/agent';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchAgentDashboard() {
  const response = await fetch(`${BASE}/dashboard`);
  return parseJson(response, 'Failed to load agent dashboard.');
}

export async function fetchAgentPortCost(mode = 'pda') {
  const params = new URLSearchParams({ mode });
  const response = await fetch(`${BASE}/port-cost?${params}`);
  return parseJson(response, 'Failed to load port costs.');
}

export async function saveAgentPortCost(payload) {
  const response = await fetch(`${BASE}/port-cost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to save port costs.');
}

export async function fetchAgentSof() {
  const response = await fetch(`${BASE}/sof`);
  return parseJson(response, 'Failed to load SOF.');
}

export async function saveAgentPreArrival(payload) {
  const response = await fetch(`${BASE}/sof/pre-arrival`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to save Pre Arrival.');
}

/** POST multipart FormData when files are present. */
export async function saveAgentSof(payload, files = []) {
  const pending = Array.isArray(files) ? files.filter(Boolean) : [];
  if (pending.length) {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    pending.forEach((file) => formData.append('mul_file', file));
    const response = await fetch(`${BASE}/sof`, {
      method: 'POST',
      body: formData,
    });
    return parseJson(response, 'Failed to save SOF.');
  }

  const response = await fetch(`${BASE}/sof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to save SOF.');
}
