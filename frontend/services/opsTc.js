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

export async function fetchOpsTcOperators() {
  const response = await fetch(`${BASE}/ops-tc/operators`);
  return parseJson(response, 'Failed to load operators.');
}

export async function fetchOpsTcYears() {
  const response = await fetch(`${BASE}/ops-tc/years`);
  return parseJson(response, 'Failed to load years.');
}

export async function fetchInOpsAtGlanceTc(params = {}) {
  const response = await fetch(`${BASE}/ops-tc/in-ops-glance${toQuery(params)}`);
  return parseJson(response, 'Failed to load In Ops at a glance TC.');
}

export async function fetchPostOpsAtGlanceTc(params = {}) {
  const response = await fetch(`${BASE}/ops-tc/post-ops${toQuery(params)}`);
  return parseJson(response, 'Failed to load Vessels in Post Ops TC.');
}

export async function fetchHistoryAtGlanceTc(params = {}) {
  const response = await fetch(`${BASE}/ops-tc/history${toQuery(params)}`);
  return parseJson(response, 'Failed to load Vessels in History TC.');
}

export async function fetchYearUpdationTc(params = {}) {
  const response = await fetch(`${BASE}/ops-tc/year-updation${toQuery(params)}`);
  return parseJson(response, 'Failed to load Year Updation TC.');
}

export async function updateTcUpdateOnDate(comId, updateYear) {
  const response = await fetch(`${BASE}/ops-tc/year-updation/${encodeURIComponent(comId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updateYear }),
  });
  return parseJson(response, 'Failed to update TC year.');
}

export async function updateOpsTcOperator(comId, operatorId) {
  const response = await fetch(`${BASE}/ops-tc/${encodeURIComponent(comId)}/operator`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorId }),
  });
  return parseJson(response, 'Failed to update operator.');
}

export async function moveOpsTcToPostOps(comId) {
  const response = await fetch(`${BASE}/ops-tc/${encodeURIComponent(comId)}/post-ops`, {
    method: 'POST',
  });
  return parseJson(response, 'Failed to move nomination to Post Ops.');
}

export async function moveOpsTcToHistory(comId) {
  const response = await fetch(`${BASE}/ops-tc/${encodeURIComponent(comId)}/history`, {
    method: 'POST',
  });
  return parseJson(response, 'Failed to move nomination to History.');
}

export async function deactivateOpsTcEntry(comId) {
  const response = await fetch(`${BASE}/ops-tc/${encodeURIComponent(comId)}/deactivate`, {
    method: 'POST',
  });
  return parseJson(response, 'Failed to deactivate nomination.');
}

export async function createOpsTcCostSheet(comId, sheetName) {
  const response = await fetch(`${BASE}/ops-tc/${encodeURIComponent(comId)}/cost-sheets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetName }),
  });
  return parseJson(response, 'Failed to create TC cost sheet.');
}

export async function fetchOpsTcCostSheet(comId, costSheetId) {
  const response = await fetch(
    `${BASE}/ops-tc/${encodeURIComponent(comId)}/cost-sheets/${encodeURIComponent(costSheetId)}`,
  );
  return parseJson(response, 'Failed to load TC Cost Sheet.');
}

export async function saveOpsTcCostSheet(comId, costSheetId, payload) {
  const response = await fetch(
    `${BASE}/ops-tc/${encodeURIComponent(comId)}/cost-sheets/${encodeURIComponent(costSheetId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return parseJson(response, 'Failed to save TC Cost Sheet.');
}

export async function fetchFinalisedVoyageFixturesTc(params = {}) {
  const response = await fetch(`${BASE}/ops-tc/finalised-fixtures${toQuery(params)}`);
  return parseJson(response, 'Failed to load Finalised Voyage Fixtures TC.');
}

export async function finaliseVoyageFixturesTc(fixtures) {
  const response = await fetch(`${BASE}/ops-tc/finalised-fixtures/finalise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fixtures }),
  });
  return parseJson(response, 'Failed to finalise fixtures.');
}

export async function fetchOpsTcFixtureNote(comId) {
  const response = await fetch(`${BASE}/ops-tc/fixture-note${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load TC Fixture Note.');
}

export async function fetchTcChecklist(comId) {
  const response = await fetch(`${BASE}/ops-tc/checklist${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load TC Checklist.');
}

export async function saveTcChecklist(comId, payload) {
  const response = await fetch(`${BASE}/ops-tc/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comId, ...payload }),
  });
  return parseJson(response, 'Failed to save TC Checklist.');
}

export async function fetchAgencyLetterTcForm(comId) {
  const response = await fetch(`${BASE}/ops-tc/agency-letter${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load TC Agency Letter.');
}

export async function saveAgencyLetterTc(payload) {
  const response = await fetch(`${BASE}/ops-tc/agency-letter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to save TC Agency Letter.');
}

export async function deleteAgencyLetterTc(genAgencyTcId) {
  const response = await fetch(
    `${BASE}/ops-tc/agency-letter/${encodeURIComponent(genAgencyTcId)}`,
    { method: 'DELETE' },
  );
  return parseJson(response, 'Failed to delete TC Agency Letter.');
}

export async function fetchOpsTcDocuments(comId) {
  const response = await fetch(`${BASE}/ops-tc/documents${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load documents.');
}

export async function createOpsTcDocument(comId, payload = {}, files = []) {
  const formData = new FormData();
  formData.append('payload', JSON.stringify({
    fileName: payload.fileName || '',
  }));
  (files || []).forEach((file) => {
    formData.append('mul_file', file);
  });
  const response = await fetch(`${BASE}/ops-tc/documents${toQuery({ comId })}`, {
    method: 'POST',
    body: formData,
  });
  return parseJson(response, 'Failed to upload document.');
}

export async function deleteOpsTcDocument(comId, storedFiles) {
  const response = await fetch(`${BASE}/ops-tc/documents${toQuery({ comId, fileName: storedFiles })}`, {
    method: 'DELETE',
  });
  return parseJson(response, 'Failed to delete document.');
}

export async function fetchPaymentGridTc(comId) {
  const response = await fetch(`${BASE}/ops-tc/payment-grid${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load Payment / Invoice Grid.');
}

export async function fetchCompareSheetsTc(comId) {
  const response = await fetch(`${BASE}/ops-tc/compare-sheets${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load Compare Sheets.');
}

export async function downloadCompareSheetsTcPdf(comId) {
  const response = await fetch(`${BASE}/ops-tc/compare-sheets/pdf${toQuery({ comId })}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to generate Compare Sheet PDF.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="?([^"]+)"?/i)?.[1] || 'Compare-Sheet-Tc.pdf';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
