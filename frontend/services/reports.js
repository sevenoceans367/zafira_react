const BASE = '/api/internal-user/reports';

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

export async function fetchReportFilterOptions() {
  const response = await fetch(`${BASE}/meta/filter-options`);
  return parseJson(response, 'Failed to load report filter options.');
}

export async function fetchReport(reportId, filters = {}) {
  const response = await fetch(`${BASE}/${encodeURIComponent(reportId)}${toQuery(filters)}`);
  return parseJson(response, 'Failed to load report.');
}

export async function fetchComparisonSheets(comId) {
  const response = await fetch(`${BASE}/meta/comparison-sheets${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load compare sheets.');
}

export async function updateReportTrackerField(reportId, { comId, iden, value }) {
  const response = await fetch(`${BASE}/${encodeURIComponent(reportId)}/tracker`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comId, iden, value }),
  });
  return parseJson(response, 'Failed to save tracker field.');
}
