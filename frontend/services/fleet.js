const BASE = '/api/internal-user/fleet';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchFleetList({
  selBType,
  page,
  pageSize,
  search,
  sortColumn,
  sortDir,
} = {}) {
  const params = new URLSearchParams();
  if (selBType) params.set('selBType', selBType);
  if (page) params.set('page', String(page));
  if (pageSize) params.set('pageSize', String(pageSize));
  if (search) params.set('search', search);
  if (sortColumn != null) params.set('sortColumn', String(sortColumn));
  if (sortDir) params.set('sortDir', sortDir);
  const query = params.toString();
  const response = await fetch(`${BASE}${query ? `?${query}` : ''}`);
  return parseJson(response, 'Failed to load fleet list.');
}

export async function fetchFleetCompare(vesselIds) {
  const response = await fetch(`${BASE}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vesselIds }),
  });
  return parseJson(response, 'Failed to compare vessels.');
}

function parseFilenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

export async function downloadFleetComparePdf(vesselIds) {
  const response = await fetch(`${BASE}/compare/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vesselIds }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to generate compare vessels PDF.');
  }
  const blob = await response.blob();
  const filename = parseFilenameFromDisposition(
    response.headers.get('Content-Disposition'),
    'Compare-Vessels.pdf',
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function fetchVesselPrimary(vesselId) {
  const response = await fetch(`${BASE}/vessel/${encodeURIComponent(vesselId)}/primary`);
  return parseJson(response, 'Failed to load vessel.');
}

export async function updateVesselPrimary(vesselId, formData) {
  const response = await fetch(`${BASE}/vessel/${encodeURIComponent(vesselId)}/primary`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update vessel.');
  }
  return data;
}

export async function fetchVesselPrimaryLookups() {
  const response = await fetch(`${BASE}/vessel/new`);
  return parseJson(response, 'Failed to load vessel form.');
}

export async function createVesselPrimary(formData) {
  const response = await fetch(`${BASE}/vessel`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to create vessel.');
  }
  return data;
}
