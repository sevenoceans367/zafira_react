import { Router } from 'express';
import {
  getCoaList,
  getCoaShipments,
  getDashboardMeta,
  getPeriodList,
  getTcDashboard,
  getVcBusinessTypes,
  getVcDashboard,
} from '../services/vcDashboardService.js';
import {
  deactivateOpsVcEntry,
  listHistoryAtGlance,
  listInOpsAtGlance,
  listOpsVcOperators,
  listOpsVcYears,
  listPostOpsAtGlance,
  listVoyageReports,
  listYearUpdation,
  moveOpsVcToHistory,
  moveOpsVcToPostOps,
  updateOpsVcOperator,
  updateYearAddOnDate,
  getOpsVcCostSheet,
  createOpsVcCostSheet,
} from '../services/opsVcService.js';
import {
  deleteAgencyLetter,
  getAgencyLetterForm,
  saveAgencyLetter,
} from '../services/agencyLetterService.js';
import { generateAgencyLetterPdf } from '../services/agencyLetterPdfService.js';
import {
  createOpsDocument,
  deleteOpsDocument,
  getOpsDocuments,
} from '../services/opsDocumentsService.js';
import { mapUploadedFiles, ticketUpload } from '../utils/ticketAttachments.js';
import {
  deleteAgencyLetterTc,
  getAgencyLetterTcForm,
  saveAgencyLetterTc,
} from '../services/agencyLetterTcService.js';
import { getPaymentGridTc } from '../services/paymentGridTcService.js';
import { getPaymentGridVc } from '../services/paymentGridVcService.js';
import {
  cancelFreightInvoice,
  deleteFreightInvoice,
  generateFreightInvoicePdf,
  getFreightInvoiceBanking,
  getFreightInvoiceForm,
  receiveFreightInvoicePayment,
  reopenFreightInvoice,
  saveFreightInvoice,
} from '../services/freightInvoiceService.js';
import {
  deleteRequestPortCost,
  generateRequestPortCostPdf,
  getRequestPortCostForm,
  getRequestPortCostVendorBanking,
  receiveRequestPortCostPayment,
  reopenRequestPortCost,
  saveRequestPortCost,
} from '../services/requestPortCostService.js';
import {
  cancelOtherInvoice,
  deleteOtherInvoice,
  generateOtherInvoicePdf,
  getOtherInvoiceBanking,
  getOtherInvoiceForm,
  receiveOtherInvoicePayment,
  reopenOtherInvoice,
  saveOtherInvoice,
} from '../services/otherInvoiceService.js';
import {
  deleteHireStatement,
  generateHireStatementPdf,
  getHireStatementForm,
  receiveHireStatementPayment,
  reopenHireStatement,
  saveHireStatement,
} from '../services/hireStatementService.js';
import {
  generateClubbedFreightPdf,
  generateClubbedHirePdf,
  getClubbedFreightInvoice,
  getClubbedHireInvoice,
  reopenClubbedFreightInvoice,
  reopenClubbedHireInvoice,
} from '../services/clubbedInvoiceService.js';
import { getRequestUser, resolveRequestIsMgmtUser } from '../services/authService.js';
import { getSofForm, saveSof } from '../services/sofService.js';
import { getLaytimeForm, saveLaytime, openLaytime } from '../services/laytimeService.js';
import { getBunkerForm, saveBunker } from '../services/bunkerService.js';
import { getSoaReport } from '../services/soaReportService.js';
import { getCompareSheetsTc } from '../services/compareSheetsTcService.js';
import { generateCompareSheetsTcPdf } from '../services/compareSheetsTcPdfService.js';
import { getCompareSheetsVc } from '../services/compareSheetsVcService.js';
import {
  createOpsTcCostSheet,
  deactivateOpsTcEntry,
  finaliseVoyageFixturesTc,
  listFinalisedVoyageFixturesTc,
  listHistoryAtGlanceTc,
  listInOpsAtGlanceTc,
  listOpsTcOperators,
  listOpsTcYears,
  listPostOpsAtGlanceTc,
  listYearUpdationTc,
  moveOpsTcToHistory,
  moveOpsTcToPostOps,
  resolveOpsTcFixtureNote,
  updateOpsTcOperator,
  updateTcUpdateOnDate,
} from '../services/opsTcService.js';
import { getTcChecklist, saveTcChecklist } from '../services/tcChecklistService.js';
import { getTcCostSheet, saveTcCostSheet } from '../services/tcCostSheetService.js';
import { mergeVesselAttachments, vesselUpload } from '../utils/vesselAttachments.js';

const router = Router();

function parseBodyJsonField(body, key) {
  const value = body?.[key];
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseFreightInvoiceBody(body = {}) {
  const payload = { ...body };
  for (const key of [
    'addRows',
    'subRows',
    'adjAddRows',
    'adjSubRows',
    'clubCharterers',
    'demurrageRows',
    'daRows',
    'selApprovers',
    'paymentRows',
  ]) {
    const parsed = parseBodyJsonField(payload, key);
    if (parsed !== undefined) payload[key] = parsed;
  }
  if (typeof payload.selApprovers === 'string') {
    payload.selApprovers = payload.selApprovers.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return payload;
}

function parseRequestPortCostBody(body = {}) {
  const payload = { ...body };
  for (const key of ['addRows', 'subRows', 'adjAddRows', 'adjSubRows', 'selApprovers']) {
    const parsed = parseBodyJsonField(payload, key);
    if (parsed !== undefined) payload[key] = parsed;
  }
  if (typeof payload.selApprovers === 'string') {
    payload.selApprovers = payload.selApprovers.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return payload;
}

function parseOtherInvoiceBody(body = {}) {
  const payload = { ...body };
  for (const key of ['addRows', 'subRows', 'demurrageRows', 'otherIncomeRows', 'selApprovers', 'paymentRows']) {
    const parsed = parseBodyJsonField(payload, key);
    if (parsed !== undefined) payload[key] = parsed;
  }
  if (typeof payload.selApprovers === 'string') {
    payload.selApprovers = payload.selApprovers.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return payload;
}

function parseHireStatementBody(body = {}) {
  const payload = { ...body };
  for (const key of ['addRows', 'subRows', 'adjAddRows', 'adjSubRows', 'hireDayRows', 'offhireRows', 'selApprovers', 'paymentRows']) {
    const parsed = parseBodyJsonField(payload, key);
    if (parsed !== undefined) payload[key] = parsed;
  }
  if (typeof payload.selApprovers === 'string') {
    payload.selApprovers = payload.selApprovers.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return payload;
}

function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({
        message: error.message || 'Ops VC request failed.',
      });
    }
  };
}

router.get('/meta', (_req, res) => {
  res.json(getDashboardMeta());
});

router.get('/business_types', (req, res) => {
  res.json(getVcBusinessTypes(req.query.selBType || '2'));
});

router.get('/vc_dashboard', async (req, res) => {
  try {
    const data = await getVcDashboard({
      selBType: req.query.selBType,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load VC dashboard.' });
  }
});

router.get('/tc_dashboard', async (req, res) => {
  try {
    const data = await getTcDashboard({
      selBType: req.query.selBType,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load TC dashboard.' });
  }
});

router.get('/coas', async (req, res) => {
  try {
    const data = await getCoaList({
      selBType: req.query.selBType,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 10,
      search: req.query.search || '',
      sortColumn: Number(req.query.sortColumn) || 1,
      sortDir: req.query.sortDir || 'desc',
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load COA list.' });
  }
});

router.get('/periods', async (req, res) => {
  try {
    const data = await getPeriodList({
      selBType: req.query.selBType,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 10,
      search: req.query.search || '',
      sortColumn: Number(req.query.sortColumn) || 1,
      sortDir: req.query.sortDir || 'desc',
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load period list.' });
  }
});

router.get('/coas/:coaId/shipments', async (req, res) => {
  try {
    const data = await getCoaShipments(req.params.coaId);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load COA shipments.' });
  }
});

router.get('/ops/years', asyncHandler(async (_req, res) => {
  res.json(await listOpsVcYears());
}));

router.get('/ops/operators', asyncHandler(async (_req, res) => {
  res.json(await listOpsVcOperators());
}));

router.get('/ops/in-ops-glance', asyncHandler(async (req, res) => {
  res.json(await listInOpsAtGlance({
    selBType: req.query.selBType || '2',
    selYear: req.query.selYear || String(new Date().getFullYear()),
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
    // PHP in_ops_at_glance.php: dropdown only when $_SESSION['iutype'] == 'mgmt_user'
    canEditOperator: resolveRequestIsMgmtUser(req),
  }));
}));

router.get('/ops/post-ops', asyncHandler(async (req, res) => {
  res.json(await listPostOpsAtGlance({
    selBType: req.query.selBType || '2',
    selYear: req.query.selYear || String(new Date().getFullYear()),
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
    canEditOperator: resolveRequestIsMgmtUser(req),
  }));
}));

router.get('/ops/history', asyncHandler(async (req, res) => {
  res.json(await listHistoryAtGlance({
    selBType: req.query.selBType || '2',
    selYear: req.query.selYear || '',
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  }));
}));

router.get('/ops/year-updation', asyncHandler(async (req, res) => {
  res.json(await listYearUpdation({
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  }));
}));

router.patch('/ops/year-updation/:comId', asyncHandler(async (req, res) => {
  res.json(await updateYearAddOnDate(req.params.comId, req.body?.addOnDate || req.body?.f_year || ''));
}));

router.get('/ops/voyage-report', asyncHandler(async (req, res) => {
  res.json(await listVoyageReports({
    vesselImoNo: req.query.vesselImoNo || req.query.vesselimono || '',
    comId: req.query.comId || req.query.comid || '',
    selYear: req.query.selYear || '',
  }));
}));

router.get('/ops/payment-grid', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  const page = req.query.page || '1';
  const voyageNo = req.query.voyageNo || req.query.voyage_no || '';
  res.json(await getPaymentGridVc(comId, { page, voyageNo }));
}));

router.get('/ops/freight-invoice', asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  const data = await getFreightInvoiceForm({
    comId: req.query.comId || req.query.comid,
    id: req.query.id,
    name: req.query.name,
    invType: req.query.invType || req.query.invtype,
    voyageNo: req.query.voyageNo || req.query.voyage_no || '',
    vcIn: req.query.vcIn || req.query.vcin || req.query.mode === 'vc-in',
    invoiceId: req.query.invoiceId || req.query.invoiceid || '',
    userId: user?.id,
    mgmtUser: resolveRequestIsMgmtUser(req),
  });
  res.json(data);
}));

router.get('/ops/freight-invoice/banking/:bdId', asyncHandler(async (req, res) => {
  getRequestUser(req);
  const detail = await getFreightInvoiceBanking(req.params.bdId);
  if (!detail) {
    res.status(404).json({ message: 'Banking details not found.' });
    return;
  }
  res.json(detail);
}));

router.post('/ops/freight-invoice', vesselUpload, asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  const body = parseFreightInvoiceBody(req.body || {});
  const existingUpload = String(body.existingUpload || body.upload || body.txtCRMFILE || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const existingUploadName = String(body.existingUploadName || body.uploadName || body.txtCRMNAME || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const { attachment, attachmentName } = mergeVesselAttachments(
    existingUpload,
    existingUploadName,
    req.files || [],
  );
  const data = await saveFreightInvoice(
    {
      ...body,
      upload: attachment,
      uploadName: attachmentName,
    },
    { userId: user?.id },
  );
  res.status(201).json(data);
}));

router.post('/ops/freight-invoice/:invoiceId/payment', (req, res, next) => {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) {
    next();
    return;
  }
  ticketUpload(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  const body = parseFreightInvoiceBody(req.body || {});
  const existingUpload = String(body.existingUpload || body.upload || body.txtCRMFILE1 || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const existingUploadName = String(body.existingUploadName || body.uploadName || body.txtCRMNAME1 || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const { attachment, attachmentName } = mergeVesselAttachments(
    existingUpload,
    existingUploadName,
    req.files || [],
  );
  const data = await receiveFreightInvoicePayment(
    req.params.invoiceId,
    {
      amount: body.amount || body.txtP_PR,
      paymentDate: body.paymentDate || body.txtP_Date || body.date,
      remarks: body.remarks || body.txtP_Remarks || '',
      paymentRows: body.paymentRows,
      upload: attachment,
      uploadName: attachmentName,
    },
    { userId: user?.id },
  );
  res.json(data);
}));

router.post('/ops/freight-invoice/:invoiceId/cancel', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can cancel invoices.' });
    return;
  }
  const user = getRequestUser(req);
  res.json(await cancelFreightInvoice(req.params.invoiceId, { userId: user?.id }));
}));

router.post('/ops/freight-invoice/:invoiceId/reopen', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can reopen invoices.' });
    return;
  }
  res.json(await reopenFreightInvoice(req.params.invoiceId));
}));

router.delete('/ops/freight-invoice/:invoiceId', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can delete invoices.' });
    return;
  }
  res.json(await deleteFreightInvoice(req.params.invoiceId));
}));

router.get('/ops/freight-invoice/:invoiceId/pdf', asyncHandler(async (req, res) => {
  getRequestUser(req);
  const { buffer, filename } = await generateFreightInvoicePdf(req.params.invoiceId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

router.get('/ops/request-port-cost', asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  const data = await getRequestPortCostForm({
    id: req.query.id,
    name: req.query.name,
    page: req.query.page || '1',
    voyageNo: req.query.voyageNo || req.query.voyage_no || '',
    userId: user?.id,
    mgmtUser: resolveRequestIsMgmtUser(req),
  });
  res.json(data);
}));

router.get('/ops/request-port-cost/vendor-banking/:vendorId', asyncHandler(async (req, res) => {
  getRequestUser(req);
  res.json(await getRequestPortCostVendorBanking(req.params.vendorId));
}));

router.post('/ops/request-port-cost', vesselUpload, asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  const body = parseRequestPortCostBody(req.body || {});
  const existingUpload = String(body.existingUpload || body.upload || body.txtCRMFILE || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const existingUploadName = String(body.existingUploadName || body.uploadName || body.txtCRMNAME || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const { attachment, attachmentName } = mergeVesselAttachments(
    existingUpload,
    existingUploadName,
    req.files || [],
  );
  const data = await saveRequestPortCost(
    {
      ...body,
      upload: attachment,
      uploadName: attachmentName,
    },
    { userId: user?.id },
  );
  res.status(201).json(data);
}));

router.post('/ops/request-port-cost/:reqId/payment', (req, res, next) => {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) {
    next();
    return;
  }
  ticketUpload(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  const body = parseRequestPortCostBody(req.body || {});
  const existingUpload = String(body.existingUpload || body.upload || body.txtCRMFILE1 || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const existingUploadName = String(body.existingUploadName || body.uploadName || body.txtCRMNAME1 || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const { attachment, attachmentName } = mergeVesselAttachments(
    existingUpload,
    existingUploadName,
    req.files || [],
  );
  const data = await receiveRequestPortCostPayment(
    req.params.reqId,
    {
      amount: body.amount || body.txtP_PR,
      amountEx: body.amountEx || body.txtP_PREX || '',
      paymentDate: body.paymentDate || body.txtP_Date || body.date,
      remarks: body.remarks || body.txtP_Remarks || '',
      costDesc: body.costDesc || body.name || '',
      name: body.name || '',
      upload: attachment,
      uploadName: attachmentName,
    },
    { userId: user?.id },
  );
  res.json(data);
}));

router.post('/ops/request-port-cost/:reqId/reopen', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can reopen payments.' });
    return;
  }
  res.json(await reopenRequestPortCost(req.params.reqId));
}));

router.delete('/ops/request-port-cost/:reqId', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can delete payments.' });
    return;
  }
  res.json(await deleteRequestPortCost(req.params.reqId));
}));

router.get('/ops/request-port-cost/:reqId/pdf', asyncHandler(async (req, res) => {
  getRequestUser(req);
  const { buffer, filename } = await generateRequestPortCostPdf(req.params.reqId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

router.get('/ops/other-invoice', asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  res.json(await getOtherInvoiceForm({
    id: req.query.id,
    name: req.query.name,
    amountTitle: req.query.amountTitle || req.query.amounttitle,
    page: req.query.page || '1',
    portType: req.query.portType || req.query.porttype,
    randomId: req.query.randomId || req.query.randomid,
    portId: req.query.portId || req.query.portid,
    voyageNo: req.query.voyageNo || req.query.voyage_no || '',
    userId: user?.id,
    mgmtUser: resolveRequestIsMgmtUser(req),
  }));
}));

router.get('/ops/other-invoice/banking/:bdId', asyncHandler(async (req, res) => {
  getRequestUser(req);
  const detail = await getOtherInvoiceBanking(req.params.bdId);
  if (!detail) {
    res.status(404).json({ message: 'Banking details not found.' });
    return;
  }
  res.json(detail);
}));

router.post('/ops/other-invoice', vesselUpload, asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  const body = parseOtherInvoiceBody(req.body || {});
  const existingUpload = String(body.existingUpload || body.upload || body.txtCRMFILE || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const existingUploadName = String(body.existingUploadName || body.uploadName || body.txtCRMNAME || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const { attachment, attachmentName } = mergeVesselAttachments(
    existingUpload,
    existingUploadName,
    req.files || [],
  );
  res.status(201).json(await saveOtherInvoice({ ...body, upload: attachment, uploadName: attachmentName }, { userId: user?.id }));
}));

router.post('/ops/other-invoice/:invoiceId/payment', (req, res, next) => {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) {
    next();
    return;
  }
  ticketUpload(req, res, (err) => {
    if (err) next(err);
    else next();
  });
}, asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  const body = parseOtherInvoiceBody(req.body || {});
  res.json(await receiveOtherInvoicePayment(req.params.invoiceId, {
    amount: body.amount || body.txtP_PR,
    paymentDate: body.paymentDate || body.txtP_Date || body.date,
    remarks: body.remarks || body.txtP_Remarks || '',
    paymentRows: body.paymentRows,
    upload: body.upload,
    uploadName: body.uploadName,
  }, { userId: user?.id }));
}));

router.post('/ops/other-invoice/:invoiceId/cancel', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can cancel invoices.' });
    return;
  }
  const user = getRequestUser(req);
  res.json(await cancelOtherInvoice(req.params.invoiceId, { userId: user?.id }));
}));

router.post('/ops/other-invoice/:invoiceId/reopen', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can reopen invoices.' });
    return;
  }
  res.json(await reopenOtherInvoice(req.params.invoiceId));
}));

router.delete('/ops/other-invoice/:invoiceId', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can delete invoices.' });
    return;
  }
  res.json(await deleteOtherInvoice(req.params.invoiceId));
}));

router.get('/ops/other-invoice/:invoiceId/pdf', asyncHandler(async (req, res) => {
  getRequestUser(req);
  const { buffer, filename } = await generateOtherInvoicePdf(req.params.invoiceId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

router.get('/ops/hire-statement', asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  res.json(await getHireStatementForm({
    comId: req.query.comId || req.query.comid,
    page: req.query.page || '1',
    voyageNo: req.query.voyageNo || req.query.voyage_no || '',
    userId: user?.id,
    mgmtUser: resolveRequestIsMgmtUser(req),
  }));
}));

router.post('/ops/hire-statement', vesselUpload, asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  const body = parseHireStatementBody(req.body || {});
  const existingUpload = String(body.existingUpload || body.upload || body.txtCRMFILE || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const existingUploadName = String(body.existingUploadName || body.uploadName || body.txtCRMNAME || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const { attachment, attachmentName } = mergeVesselAttachments(
    existingUpload,
    existingUploadName,
    req.files || [],
  );
  res.status(201).json(await saveHireStatement({ ...body, upload: attachment, uploadName: attachmentName }, { userId: user?.id }));
}));

router.post('/ops/hire-statement/:invoiceId/payment', asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  const body = parseHireStatementBody(req.body || {});
  res.json(await receiveHireStatementPayment(req.params.invoiceId, {
    amount: body.amount,
    paymentDate: body.paymentDate || body.date,
    remarks: body.remarks || '',
    paymentRows: body.paymentRows,
  }, { userId: user?.id }));
}));

router.post('/ops/hire-statement/:invoiceId/reopen', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can reopen hire statements.' });
    return;
  }
  res.json(await reopenHireStatement(req.params.invoiceId));
}));

router.delete('/ops/hire-statement/:invoiceId', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can delete hire statements.' });
    return;
  }
  res.json(await deleteHireStatement(req.params.invoiceId));
}));

router.get('/ops/hire-statement/:invoiceId/pdf', asyncHandler(async (req, res) => {
  getRequestUser(req);
  const { buffer, filename } = await generateHireStatementPdf(req.params.invoiceId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

router.get('/ops/clubbed-invoice', asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  res.json(await getClubbedFreightInvoice({
    id: req.query.id,
    name: req.query.name,
    invType: req.query.invType || req.query.invtype,
    voyageNo: req.query.voyageNo || req.query.voyage_no || '',
    page: req.query.page || '1',
    userId: user?.id,
    mgmtUser: resolveRequestIsMgmtUser(req),
  }));
}));

router.post('/ops/clubbed-invoice/:invoiceId/reopen', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can reopen invoices.' });
    return;
  }
  res.json(await reopenClubbedFreightInvoice(req.params.invoiceId));
}));

router.get('/ops/clubbed-invoice/:invoiceId/pdf', asyncHandler(async (req, res) => {
  getRequestUser(req);
  const { buffer, filename } = await generateClubbedFreightPdf(req.params.invoiceId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

router.get('/ops/clubbed-hire', asyncHandler(async (req, res) => {
  const user = getRequestUser(req);
  res.json(await getClubbedHireInvoice({
    comId: req.query.comId || req.query.comid,
    page: req.query.page || '1',
    voyageNo: req.query.voyageNo || req.query.voyage_no || '',
    userId: user?.id,
    mgmtUser: resolveRequestIsMgmtUser(req),
  }));
}));

router.post('/ops/clubbed-hire/:invoiceId/reopen', asyncHandler(async (req, res) => {
  if (!resolveRequestIsMgmtUser(req)) {
    res.status(403).json({ message: 'Only management users can reopen invoices.' });
    return;
  }
  res.json(await reopenClubbedHireInvoice(req.params.invoiceId));
}));

router.get('/ops/clubbed-hire/:invoiceId/pdf', asyncHandler(async (req, res) => {
  getRequestUser(req);
  const { buffer, filename } = await generateClubbedHirePdf(req.params.invoiceId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

router.get('/ops/sof', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await getSofForm(comId));
}));

router.post('/ops/sof', asyncHandler(async (req, res) => {
  res.json(await saveSof(req.body || {}));
}));

router.get('/ops/laytime', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await getLaytimeForm(comId));
}));

router.post('/ops/laytime', asyncHandler(async (req, res) => {
  res.json(await saveLaytime(req.body || {}));
}));

router.post('/ops/laytime/open', asyncHandler(async (req, res) => {
  res.json(await openLaytime(req.body || {}));
}));

router.get('/ops/bunker', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  const prevComId = req.query.prevComId || req.query.prevcomid;
  res.json(await getBunkerForm(comId, prevComId));
}));

router.post('/ops/bunker', asyncHandler(async (req, res) => {
  res.json(await saveBunker(req.body || {}));
}));

router.get('/ops/soa-report', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await getSoaReport(comId));
}));

router.get('/ops/documents', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  const kind = req.query.kind || 'vc';
  res.json(await getOpsDocuments(comId, kind));
}));

router.post('/ops/documents', ticketUpload, asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid || req.body?.comId || req.body?.comid;
  const payload = req.body?.payload ? JSON.parse(req.body.payload) : (req.body || {});
  const files = mapUploadedFiles(req.files || []);
  res.status(201).json(await createOpsDocument(comId, payload, files));
}));

router.delete('/ops/documents', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  const fileName = req.query.fileName || req.query.filename || req.body?.fileName;
  res.json(await deleteOpsDocument(comId, fileName));
}));

router.get('/ops-tc/documents', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await getOpsDocuments(comId, 'tc'));
}));

router.post('/ops-tc/documents', ticketUpload, asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid || req.body?.comId || req.body?.comid;
  const payload = req.body?.payload ? JSON.parse(req.body.payload) : (req.body || {});
  const files = mapUploadedFiles(req.files || []);
  res.status(201).json(await createOpsDocument(comId, payload, files));
}));

router.delete('/ops-tc/documents', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  const fileName = req.query.fileName || req.query.filename || req.body?.fileName;
  res.json(await deleteOpsDocument(comId, fileName));
}));

router.get('/ops/agency-letter', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await getAgencyLetterForm(comId));
}));

router.post('/ops/agency-letter', asyncHandler(async (req, res) => {
  const result = await saveAgencyLetter(req.body || {});
  res.json(result);
}));

router.delete('/ops/agency-letter/:genAgencyId', asyncHandler(async (req, res) => {
  res.json(await deleteAgencyLetter(req.params.genAgencyId));
}));

router.get('/ops/agency-letter/:genAgencyId/pdf', asyncHandler(async (req, res) => {
  const { buffer, filename } = await generateAgencyLetterPdf(req.params.genAgencyId, {
    type: req.query.type || 'pda',
    portType: req.query.portType || req.query.port_type || '',
    comId: req.query.comId || req.query.comid || '',
    portId: req.query.portId || req.query.port_name || '',
    agentCode: req.query.agentCode || req.query.agent_code || '',
    randomId: req.query.randomId || req.query.randomno || '',
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

router.get('/ops/compare-sheets', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await getCompareSheetsVc(comId));
}));

router.patch('/ops/:comId/operator', asyncHandler(async (req, res) => {
  res.json(await updateOpsVcOperator(req.params.comId, req.body?.operatorId));
}));

router.post('/ops/:comId/post-ops', asyncHandler(async (req, res) => {
  res.json(await moveOpsVcToPostOps(req.params.comId));
}));

router.post('/ops/:comId/history', asyncHandler(async (req, res) => {
  res.json(await moveOpsVcToHistory(req.params.comId));
}));

router.post('/ops/:comId/deactivate', asyncHandler(async (req, res) => {
  res.json(await deactivateOpsVcEntry(req.params.comId));
}));

router.get('/ops/:comId/cost-sheets/:costSheetId', asyncHandler(async (req, res) => {
  res.json(await getOpsVcCostSheet(req.params.comId, req.params.costSheetId));
}));

router.post('/ops/:comId/cost-sheets', asyncHandler(async (req, res) => {
  res.json(await createOpsVcCostSheet(
    req.params.comId,
    req.body?.sheetName || req.body?.txtFile || '',
  ));
}));

router.get('/ops-tc/operators', asyncHandler(async (_req, res) => {
  res.json(await listOpsTcOperators());
}));

router.get('/ops-tc/years', asyncHandler(async (_req, res) => {
  res.json(await listOpsTcYears());
}));

router.get('/ops-tc/in-ops-glance', asyncHandler(async (req, res) => {
  res.json(await listInOpsAtGlanceTc({
    selBType: req.query.selBType || '2',
    selYear: req.query.selYear || String(new Date().getFullYear()),
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
    // PHP in_ops_tc.php: dropdown only when $_SESSION['iutype'] == 'mgmt_user'
    canEditOperator: resolveRequestIsMgmtUser(req),
  }));
}));

router.get('/ops-tc/post-ops', asyncHandler(async (req, res) => {
  res.json(await listPostOpsAtGlanceTc({
    selBType: req.query.selBType || '2',
    selYear: req.query.selYear || String(new Date().getFullYear()),
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
    canEditOperator: resolveRequestIsMgmtUser(req),
  }));
}));

router.get('/ops-tc/history', asyncHandler(async (req, res) => {
  res.json(await listHistoryAtGlanceTc({
    selBType: req.query.selBType || '2',
    selYear: req.query.selYear || String(new Date().getFullYear()),
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  }));
}));

router.get('/ops-tc/year-updation', asyncHandler(async (req, res) => {
  res.json(await listYearUpdationTc({
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  }));
}));

router.patch('/ops-tc/year-updation/:comId', asyncHandler(async (req, res) => {
  const updateYear = req.body?.updateYear || req.body?.f_year || '';
  res.json(await updateTcUpdateOnDate(req.params.comId, updateYear));
}));

router.patch('/ops-tc/:comId/operator', asyncHandler(async (req, res) => {
  res.json(await updateOpsTcOperator(req.params.comId, req.body?.operatorId));
}));

router.post('/ops-tc/:comId/post-ops', asyncHandler(async (req, res) => {
  res.json(await moveOpsTcToPostOps(req.params.comId));
}));

router.post('/ops-tc/:comId/history', asyncHandler(async (req, res) => {
  res.json(await moveOpsTcToHistory(req.params.comId));
}));

router.post('/ops-tc/:comId/deactivate', asyncHandler(async (req, res) => {
  res.json(await deactivateOpsTcEntry(req.params.comId));
}));

router.post('/ops-tc/:comId/cost-sheets', asyncHandler(async (req, res) => {
  res.json(await createOpsTcCostSheet(req.params.comId, req.body?.sheetName || req.body?.txtFile || ''));
}));

router.get('/ops-tc/:comId/cost-sheets/:costSheetId', asyncHandler(async (req, res) => {
  res.json(await getTcCostSheet(req.params.comId, req.params.costSheetId));
}));

router.post('/ops-tc/:comId/cost-sheets/:costSheetId', asyncHandler(async (req, res) => {
  res.json(await saveTcCostSheet(req.params.comId, req.params.costSheetId, req.body || {}));
}));

router.get('/ops-tc/finalised-fixtures', asyncHandler(async (req, res) => {
  res.json(await listFinalisedVoyageFixturesTc({
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  }));
}));

router.post('/ops-tc/finalised-fixtures/finalise', asyncHandler(async (req, res) => {
  res.json(await finaliseVoyageFixturesTc(req.body?.fixtures || []));
}));

router.get('/ops-tc/fixture-note', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await resolveOpsTcFixtureNote(comId));
}));

router.get('/ops-tc/checklist', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await getTcChecklist(comId));
}));

router.post('/ops-tc/checklist', asyncHandler(async (req, res) => {
  const comId = req.body?.comId || req.body?.comid;
  res.json(await saveTcChecklist(comId, req.body || {}));
}));

router.get('/ops-tc/agency-letter', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await getAgencyLetterTcForm(comId));
}));

router.post('/ops-tc/agency-letter', asyncHandler(async (req, res) => {
  res.json(await saveAgencyLetterTc(req.body || {}));
}));

router.delete('/ops-tc/agency-letter/:genAgencyTcId', asyncHandler(async (req, res) => {
  res.json(await deleteAgencyLetterTc(req.params.genAgencyTcId));
}));

router.get('/ops-tc/agency-letter/:genAgencyTcId/pdf', asyncHandler(async (_req, res) => {
  res.status(501).json({
    message: 'TC Agency letter PDF generation is not migrated yet (legacy allPdf.php?id=66).',
  });
}));

router.get('/ops-tc/payment-grid', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await getPaymentGridTc(comId));
}));

router.get('/ops-tc/compare-sheets', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  res.json(await getCompareSheetsTc(comId));
}));

router.get('/ops-tc/compare-sheets/pdf', asyncHandler(async (req, res) => {
  const comId = req.query.comId || req.query.comid;
  const { buffer, filename } = await generateCompareSheetsTcPdf(comId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

export default router;
