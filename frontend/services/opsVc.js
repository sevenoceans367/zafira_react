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

export async function fetchPaymentGridVc(comId, options = {}) {
  const response = await fetch(`${BASE}/ops/payment-grid${toQuery({
    comId,
    page: options.page,
    voyageNo: options.voyageNo,
  })}`);
  return parseJson(response, 'Failed to load payment / invoice grid.');
}

export async function fetchFreightInvoiceForm(params = {}) {
  const response = await fetch(`${BASE}/ops/freight-invoice${toQuery(params)}`);
  return parseJson(response, 'Failed to load freight invoice form.');
}

/** POST multipart FormData — do not set Content-Type (browser sets boundary). */
export async function saveFreightInvoice(formData) {
  const response = await fetch(`${BASE}/ops/freight-invoice`, {
    method: 'POST',
    body: formData,
  });
  return parseJson(response, 'Failed to save freight invoice.');
}

export async function fetchFreightInvoiceBanking(bdId) {
  const response = await fetch(
    `${BASE}/ops/freight-invoice/banking/${encodeURIComponent(bdId)}`,
  );
  return parseJson(response, 'Failed to load banking details.');
}

export async function receiveFreightInvoicePayment(invoiceId, payload = {}) {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
  const response = await fetch(
    `${BASE}/ops/freight-invoice/${encodeURIComponent(invoiceId)}/payment`,
    {
      method: 'POST',
      ...(isFormData
        ? { body: payload }
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
    },
  );
  return parseJson(response, 'Failed to record payment.');
}

export async function cancelFreightInvoice(invoiceId) {
  const response = await fetch(
    `${BASE}/ops/freight-invoice/${encodeURIComponent(invoiceId)}/cancel`,
    { method: 'POST' },
  );
  return parseJson(response, 'Failed to cancel invoice.');
}

export async function reopenFreightInvoice(invoiceId) {
  const response = await fetch(
    `${BASE}/ops/freight-invoice/${encodeURIComponent(invoiceId)}/reopen`,
    { method: 'POST' },
  );
  return parseJson(response, 'Failed to reopen invoice.');
}

export async function deleteFreightInvoice(invoiceId) {
  const response = await fetch(
    `${BASE}/ops/freight-invoice/${encodeURIComponent(invoiceId)}`,
    { method: 'DELETE' },
  );
  return parseJson(response, 'Failed to delete invoice.');
}

export async function downloadFreightInvoicePdf(invoiceId, options = {}) {
  const query = options.aed ? '?aed=1' : '';
  const response = await fetch(
    `${BASE}/ops/freight-invoice/${encodeURIComponent(invoiceId)}/pdf${query}`,
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to download freight invoice PDF.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="?([^"]+)"?/i)?.[1]
    || `Freight-Invoice-${invoiceId}${options.aed ? '-AED' : ''}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function fetchRequestPortCostForm(params = {}) {
  const response = await fetch(`${BASE}/ops/request-port-cost${toQuery(params)}`);
  return parseJson(response, 'Failed to load operational costs payment form.');
}

/** POST multipart FormData — do not set Content-Type (browser sets boundary). */
export async function saveRequestPortCost(formData) {
  const response = await fetch(`${BASE}/ops/request-port-cost`, {
    method: 'POST',
    body: formData,
  });
  return parseJson(response, 'Failed to save operational costs payment.');
}

export async function fetchRequestPortCostVendorBanking(vendorId) {
  const response = await fetch(
    `${BASE}/ops/request-port-cost/vendor-banking/${encodeURIComponent(vendorId)}`,
  );
  return parseJson(response, 'Failed to load vendor banking details.');
}

export async function receiveRequestPortCostPayment(reqId, payload = {}) {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
  const response = await fetch(
    `${BASE}/ops/request-port-cost/${encodeURIComponent(reqId)}/payment`,
    {
      method: 'POST',
      ...(isFormData
        ? { body: payload }
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
    },
  );
  return parseJson(response, 'Failed to record payment.');
}

export async function reopenRequestPortCost(reqId) {
  const response = await fetch(
    `${BASE}/ops/request-port-cost/${encodeURIComponent(reqId)}/reopen`,
    { method: 'POST' },
  );
  return parseJson(response, 'Failed to reopen request.');
}

export async function deleteRequestPortCost(reqId) {
  const response = await fetch(
    `${BASE}/ops/request-port-cost/${encodeURIComponent(reqId)}`,
    { method: 'DELETE' },
  );
  return parseJson(response, 'Failed to delete request.');
}

async function downloadPdf(url, fallbackName, fallbackMessage) {
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || fallbackMessage);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="?([^"]+)"?/i)?.[1] || fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadRequestPortCostPdf(reqId) {
  return downloadPdf(
    `${BASE}/ops/request-port-cost/${encodeURIComponent(reqId)}/pdf`,
    `Payment-${reqId}.pdf`,
    'Failed to download payment PDF.',
  );
}

export async function fetchOtherInvoiceForm(params = {}) {
  const response = await fetch(`${BASE}/ops/other-invoice${toQuery(params)}`);
  return parseJson(response, 'Failed to load other invoice form.');
}

export async function saveOtherInvoice(formData) {
  const response = await fetch(`${BASE}/ops/other-invoice`, { method: 'POST', body: formData });
  return parseJson(response, 'Failed to save other invoice.');
}

export async function fetchOtherInvoiceBanking(bdId) {
  const response = await fetch(`${BASE}/ops/other-invoice/banking/${encodeURIComponent(bdId)}`);
  return parseJson(response, 'Failed to load banking details.');
}

export async function receiveOtherInvoicePayment(invoiceId, payload = {}) {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
  const response = await fetch(
    `${BASE}/ops/other-invoice/${encodeURIComponent(invoiceId)}/payment`,
    isFormData
      ? { method: 'POST', body: payload }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
  );
  return parseJson(response, 'Failed to record payment.');
}

export async function cancelOtherInvoice(invoiceId) {
  const response = await fetch(`${BASE}/ops/other-invoice/${encodeURIComponent(invoiceId)}/cancel`, { method: 'POST' });
  return parseJson(response, 'Failed to cancel invoice.');
}

export async function reopenOtherInvoice(invoiceId) {
  const response = await fetch(`${BASE}/ops/other-invoice/${encodeURIComponent(invoiceId)}/reopen`, { method: 'POST' });
  return parseJson(response, 'Failed to reopen invoice.');
}

export async function deleteOtherInvoice(invoiceId) {
  const response = await fetch(`${BASE}/ops/other-invoice/${encodeURIComponent(invoiceId)}`, { method: 'DELETE' });
  return parseJson(response, 'Failed to delete invoice.');
}

export async function downloadOtherInvoicePdf(invoiceId) {
  return downloadPdf(
    `${BASE}/ops/other-invoice/${encodeURIComponent(invoiceId)}/pdf`,
    `Other-Invoice-${invoiceId}.pdf`,
    'Failed to download other invoice PDF.',
  );
}

export async function fetchHireStatementForm(params = {}) {
  const response = await fetch(`${BASE}/ops/hire-statement${toQuery(params)}`);
  return parseJson(response, 'Failed to load hire statement.');
}

export async function saveHireStatement(formData) {
  const response = await fetch(`${BASE}/ops/hire-statement`, { method: 'POST', body: formData });
  return parseJson(response, 'Failed to save hire statement.');
}

export async function receiveHireStatementPayment(invoiceId, payload = {}) {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
  const response = await fetch(
    `${BASE}/ops/hire-statement/${encodeURIComponent(invoiceId)}/payment`,
    isFormData
      ? { method: 'POST', body: payload }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
  );
  return parseJson(response, 'Failed to record payment.');
}

export async function reopenHireStatement(invoiceId) {
  const response = await fetch(`${BASE}/ops/hire-statement/${encodeURIComponent(invoiceId)}/reopen`, { method: 'POST' });
  return parseJson(response, 'Failed to reopen hire statement.');
}

export async function deleteHireStatement(invoiceId) {
  const response = await fetch(`${BASE}/ops/hire-statement/${encodeURIComponent(invoiceId)}`, { method: 'DELETE' });
  return parseJson(response, 'Failed to delete hire statement.');
}

export async function downloadHireStatementPdf(invoiceId) {
  return downloadPdf(
    `${BASE}/ops/hire-statement/${encodeURIComponent(invoiceId)}/pdf`,
    `Hire-Statement-${invoiceId}.pdf`,
    'Failed to download hire statement PDF.',
  );
}

export async function fetchClubbedFreightInvoice(params = {}) {
  const response = await fetch(`${BASE}/ops/clubbed-invoice${toQuery(params)}`);
  return parseJson(response, 'Failed to load clubbed invoice.');
}

export async function reopenClubbedFreightInvoice(invoiceId) {
  const response = await fetch(`${BASE}/ops/clubbed-invoice/${encodeURIComponent(invoiceId)}/reopen`, { method: 'POST' });
  return parseJson(response, 'Failed to reopen clubbed invoice.');
}

export async function downloadClubbedFreightPdf(invoiceId) {
  return downloadPdf(
    `${BASE}/ops/clubbed-invoice/${encodeURIComponent(invoiceId)}/pdf`,
    `Clubbed-Invoice-${invoiceId}.pdf`,
    'Failed to download clubbed invoice PDF.',
  );
}

export async function fetchClubbedHireInvoice(params = {}) {
  const response = await fetch(`${BASE}/ops/clubbed-hire${toQuery(params)}`);
  return parseJson(response, 'Failed to load clubbed hire invoice.');
}

export async function reopenClubbedHireInvoice(invoiceId) {
  const response = await fetch(`${BASE}/ops/clubbed-hire/${encodeURIComponent(invoiceId)}/reopen`, { method: 'POST' });
  return parseJson(response, 'Failed to reopen clubbed hire invoice.');
}

export async function downloadClubbedHirePdf(invoiceId) {
  return downloadPdf(
    `${BASE}/ops/clubbed-hire/${encodeURIComponent(invoiceId)}/pdf`,
    `Clubbed-Hire-${invoiceId}.pdf`,
    'Failed to download clubbed hire PDF.',
  );
}

export async function fetchSofForm(comId) {
  const response = await fetch(`${BASE}/ops/sof${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load SOF.');
}

export async function fetchOpsChecklist(comId, kind = '') {
  const response = await fetch(`${BASE}/ops/checklist${toQuery({ comId, kind })}`);
  return parseJson(response, 'Failed to load Ops Checklist.');
}

export async function saveSof(payload) {
  const response = await fetch(`${BASE}/ops/sof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to save SOF.');
}

export async function fetchLaytimeForm(comId) {
  const response = await fetch(`${BASE}/ops/laytime${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load Laytime.');
}

export async function saveLaytime(payload) {
  const response = await fetch(`${BASE}/ops/laytime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to save Laytime.');
}

export async function openLaytime(payload) {
  const response = await fetch(`${BASE}/ops/laytime/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to open Laytime.');
}

export async function fetchBunkerForm(comId, prevComId) {
  const response = await fetch(`${BASE}/ops/bunker${toQuery({ comId, prevComId })}`);
  return parseJson(response, 'Failed to load Bunker Calculations.');
}

export async function saveBunker(payload) {
  const response = await fetch(`${BASE}/ops/bunker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Failed to save Bunker Calculations.');
}

export async function fetchSoaReport(comId) {
  const response = await fetch(`${BASE}/ops/soa-report${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load SOA report.');
}

export async function fetchOpsDocuments(comId) {
  const response = await fetch(`${BASE}/ops/documents${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load documents.');
}

export async function createOpsDocument(comId, payload = {}, files = []) {
  const formData = new FormData();
  formData.append('payload', JSON.stringify({
    fileName: payload.fileName || '',
  }));
  (files || []).forEach((file) => {
    formData.append('mul_file', file);
  });
  const response = await fetch(`${BASE}/ops/documents${toQuery({ comId })}`, {
    method: 'POST',
    body: formData,
  });
  return parseJson(response, 'Failed to upload document.');
}

export async function deleteOpsDocument(comId, storedFiles) {
  const response = await fetch(`${BASE}/ops/documents${toQuery({ comId, fileName: storedFiles })}`, {
    method: 'DELETE',
  });
  return parseJson(response, 'Failed to delete document.');
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

/** PHP cost_sheet_tci / updatecost_sheet_tci — resolve FCAID for Voyage Financials. */
export async function fetchOpsVcCostSheet(comId, costSheetId) {
  const response = await fetch(
    `${BASE}/ops/${encodeURIComponent(comId)}/cost-sheets/${encodeURIComponent(costSheetId)}`,
  );
  return parseJson(response, 'Failed to load Voyage Financials cost sheet.');
}

/** PHP insertActualCostSheetName — Voyage Financials "A" button. */
export async function createOpsVcCostSheet(comId, sheetName) {
  const response = await fetch(`${BASE}/ops/${encodeURIComponent(comId)}/cost-sheets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetName }),
  });
  return parseJson(response, 'Failed to create Voyage Financials sheet.');
}

export async function updateOpsVcCostSheetLayout(comId, sheets) {
  const response = await fetch(`${BASE}/ops/${encodeURIComponent(comId)}/cost-sheets/layout`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheets }),
  });
  return parseJson(response, 'Failed to update worksheet layout.');
}

/** PHP options.php?id=131 getCompareSheetData — VC Compare Sheets. */
export async function fetchCompareSheetsVc(comId) {
  const response = await fetch(`${BASE}/ops/compare-sheets${toQuery({ comId })}`);
  return parseJson(response, 'Failed to load compare sheets.');
}

export async function downloadCompareSheetsVcPdf(comId) {
  const response = await fetch(`${BASE}/ops/compare-sheets/pdf${toQuery({ comId })}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to generate Compare Sheet PDF.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="?([^"]+)"?/i)?.[1] || 'Compare-Sheet-Vc.pdf';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
