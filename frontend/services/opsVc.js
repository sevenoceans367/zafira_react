const BASE = '/api/internal-user/vc';

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

export async function fetchOpsVcYears() {
  const response = await fetch(`${BASE}/ops/years`);
  return parseJson(response, 'Failed to load years.');
}

export async function fetchOpsVcOperators() {
  const response = await fetch(`${BASE}/ops/operators`);
  return parseJson(response, 'Failed to load operators.');
}

export async function fetchInOpsAtGlance(params = {}) {
  const response = await fetch(`${BASE}/ops/in-ops-glance${toQuery(params)}`);
  return parseJson(response, 'Failed to load In Ops at a glance.');
}

export async function fetchPostOpsAtGlance(params = {}) {
  const response = await fetch(`${BASE}/ops/post-ops${toQuery(params)}`);
  return parseJson(response, 'Failed to load Post Ops at a glance.');
}

export async function fetchHistoryAtGlance(params = {}) {
  const response = await fetch(`${BASE}/ops/history${toQuery(params)}`);
  return parseJson(response, 'Failed to load Vessels in History.');
}

export async function fetchYearUpdation(params = {}) {
  const response = await fetch(`${BASE}/ops/year-updation${toQuery(params)}`);
  return parseJson(response, 'Failed to load Year Updation.');
}

export async function updateYearAddOnDate(comId, addOnDate) {
  const response = await fetch(`${BASE}/ops/year-updation/${encodeURIComponent(comId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addOnDate }),
  });
  return parseJson(response, 'Failed to update Add On Date.');
}

export async function fetchVoyageReports(params = {}) {
  const response = await fetch(`${BASE}/ops/voyage-report${toQuery(params)}`);
  return parseJson(response, 'Failed to load voyage reports.');
}

export async function fetchAgencyLetterForm(comId) {
  const response = await fetch(`${BASE}/ops/agency-letter${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load port related letters.');
}

export async function saveAgencyLetter(payload) {
  const response = await fetch(`${BASE}/ops/agency-letter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to save agency letter.');
}

export async function deleteAgencyLetter(genAgencyId) {
  const response = await fetch(`${BASE}/ops/agency-letter/${encodeURIComponent(genAgencyId)}`, {
    method: 'DELETE',
  });
  return parseJson(response, 'Failed to delete agency letter.');
}

export async function updateOpsVcOperator(comId, operatorId) {
  const response = await fetch(`${BASE}/ops/${encodeURIComponent(comId)}/operator`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorId }),
  });
  return parseJson(response, 'Failed to update operator.');
}

export async function moveOpsVcToPostOps(comId) {
  const response = await fetch(`${BASE}/ops/${encodeURIComponent(comId)}/post-ops`, {
    method: 'POST',
  });
  return parseJson(response, 'Failed to move voyage to Post Ops.');
}

export async function moveOpsVcToHistory(comId) {
  const response = await fetch(`${BASE}/ops/${encodeURIComponent(comId)}/history`, {
    method: 'POST',
  });
  return parseJson(response, 'Failed to move voyage to History.');
}

export async function deactivateOpsVcEntry(comId) {
  const response = await fetch(`${BASE}/ops/${encodeURIComponent(comId)}/deactivate`, {
    method: 'POST',
  });
  return parseJson(response, 'Failed to deactivate voyage.');
}
