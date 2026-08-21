import { Router } from 'express';
import {
  deleteEstimate,
  getBusinessTypes,
  getCompareEstimates,
  getEstimateList,
  replicateEstimate,
  sendEstimateToOps,
  submitDecisionChart,
} from '../services/estimateListService.js';
import {
  checkVoyageNoExists,
  createEstimateDetail,
  getEstimateDetail,
  getEstimateLookups,
  getPeriodPrefill,
  getVesselEstimatePrefill,
  nextEstimateNo,
  searchVessels,
  updateEstimateDetail,
} from '../services/estimateDetailService.js';
import { fetchPortToPortDistance, searchEstimatePorts } from '../services/portDistanceService.js';
import { getCanalOrcRates, getDefaultMarketPrices } from '../services/canalOrcService.js';
import { getSensitivityAnalysis, updateSensitivityEstimate } from '../services/sensitivityAnalysisService.js';
import { generateSensitivityAnalysisPdf } from '../services/sensitivityAnalysisPdfService.js';
import { fetchVesselsWithinRange as queryVesselsWithinRange } from '../services/vesselPositionService.js';
import {
  createSupportTicket,
  getTicketMessages,
  listSupportTickets,
  sendTicketMessage,
  updateSupportTicket,
} from '../services/supportTicketService.js';
import { mapUploadedFiles, ticketUpload, estimateUpload } from '../utils/ticketAttachments.js';

const router = Router();

router.get('/business_types', (req, res) => {
  res.json(getBusinessTypes(req.query.selBType));
});

router.get('/estimate_list', async (req, res) => {
  try {
    const { selBType, estimatetype, periodFrom, periodTo } = req.query;
    const data = await getEstimateList({ selBType, periodFrom, periodTo });
    res.json({
      ...data,
      estimatetype: Number(estimatetype) || Number(selBType) || 2,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load estimate list.' });
  }
});

router.get('/vessels/search', async (req, res) => {
  try {
    const result = await searchVessels(req.query.q);
    if (Array.isArray(result)) {
      res.json({ rows: result });
      return;
    }
    res.json({
      rows: result.rows || [],
      source: result.source,
      warning: result.warning,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to search vessels.' });
  }
});

router.get('/vessels/:vesselId/estimate-prefill', async (req, res) => {
  try {
    const data = await getVesselEstimatePrefill(req.params.vesselId);
    if (!data) {
      res.status(404).json({ message: 'Vessel not found.' });
      return;
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load vessel prefill.' });
  }
});

router.post('/port-distance', async (req, res) => {
  try {
    const body = req.body || {};
    const data = await fetchPortToPortDistance({
      startPortId: body.startPortId || body.StartPortID,
      endPortId: body.endPortId || body.EndPortID,
      startLon: body.startLon ?? body.StartLon,
      startLat: body.startLat ?? body.StartLat,
      endLon: body.endLon ?? body.EndLon,
      endLat: body.endLat ?? body.EndLat,
      greatCircleInterval: body.greatCircleInterval ?? body.GreatCircleInterval,
      secaAvoidance: body.secaAvoidance ?? body.SecaAvoidance,
      aslCompliance: body.aslCompliance ?? body.AslCompliance,
      allowedAreas: body.allowedAreas ?? body.AllowedAreas,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({
      message: error.message || 'Failed to fetch port distance.',
    });
  }
});

router.get('/ports/search', async (req, res) => {
  try {
    const rows = await searchEstimatePorts(req.query.q, Number(req.query.limit) || 25);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({
      message: error.message || 'Failed to search ports.',
    });
  }
});

router.post('/canal-orc-rates', async (req, res) => {
  try {
    const body = req.body || {};
    const data = await getCanalOrcRates({
      turkish: Boolean(body.turkish),
      suez: Boolean(body.suez),
      panama: Boolean(body.panama),
      businessType: body.businessType || body.estimateType || 2,
      nrt: body.nrt,
      dwt: body.dwt,
      passageType: body.passageType,
      vesselType: body.vesselType,
      sdrToUsd: body.sdrToUsd,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load canal rates.' });
  }
});

router.get('/market-prices', (_req, res) => {
  res.json(getDefaultMarketPrices());
});

router.get('/estimates/lookups', async (req, res) => {
  try {
    const data = await getEstimateLookups(req.query.estimateType || req.query.estimatetype);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load estimate lookups.' });
  }
});

/** PHP options.php?id=149 — voyage / TC number uniqueness check. */
router.get('/estimates/voyage-exists', async (req, res) => {
  try {
    const voyageNo = req.query.vno || req.query.Vno || req.query.voyageNo || '';
    const excludeId = req.query.excludeId || req.query.excludeFcaId || null;
    const estimateNo = req.query.estimateNo != null ? Number(req.query.estimateNo) : 1;
    const allowSameVoyage = String(req.query.allowSameVoyage || '') === '1'
      || String(req.query.allowSameVoyage || '').toLowerCase() === 'true';
    const exists = await checkVoyageNoExists(voyageNo, {
      excludeFcaId: excludeId,
      estimateNo,
      allowSameVoyage,
    });
    res.json({ exists: Boolean(exists) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to check voyage number.' });
  }
});

/** Next EstN for replicate (same voyage, new estimate number). */
router.get('/estimates/next-estimate-no', async (req, res) => {
  try {
    const voyageNo = req.query.vno || req.query.voyageNo || '';
    const estimateNo = await nextEstimateNo(voyageNo);
    res.json({ estimateNo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to resolve next estimate number.' });
  }
});

router.get('/estimates/period-prefill/:periodId', async (req, res) => {
  try {
    const data = await getPeriodPrefill(req.params.periodId);
    if (!data) {
      res.status(404).json({ message: 'Period contract not found.' });
      return;
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load period prefill.' });
  }
});

router.post('/estimates', estimateUpload, async (req, res) => {
  try {
    let payload = req.body || {};
    if (typeof payload.payload === 'string') {
      payload = JSON.parse(payload.payload);
    }
    const upload = mapUploadedFiles(req.files || []);
    const result = await createEstimateDetail(payload, upload);
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create estimate.', msg: 1 });
  }
});

router.get('/estimates/:id', async (req, res) => {
  try {
    const data = await getEstimateDetail(req.params.id);
    if (!data) {
      return res.status(404).json({ message: 'Estimate not found.' });
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load estimate.' });
  }
});

router.put('/estimates/:id', estimateUpload, async (req, res) => {
  try {
    let payload = req.body || {};
    if (typeof payload.payload === 'string') {
      payload = JSON.parse(payload.payload);
    }
    const upload = mapUploadedFiles(req.files || []);
    const result = await updateEstimateDetail(req.params.id, payload, upload);
    if (!result) {
      return res.status(404).json({ message: 'Estimate not found.', msg: 1 });
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to update estimate.' });
  }
});

router.delete('/estimate_list/:id', async (req, res) => {
  try {
    const result = await deleteEstimate(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Estimate not found.', msg: 1 });
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to delete estimate.' });
  }
});

router.post('/estimate_list/:id/replicate', async (req, res) => {
  try {
    const result = await replicateEstimate(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Estimate not found.', msg: 1 });
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to replicate estimate.' });
  }
});

router.post('/estimate_list/:id/send_to_ops', async (req, res) => {
  try {
    const result = await sendEstimateToOps(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Estimate not found.', msg: 1 });
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to send estimate to Operations.' });
  }
});

router.post('/sensitivity_analysis', async (req, res) => {
  try {
    const ids = req.body.ids ?? req.body.chkArr;
    const parsed = Array.isArray(ids) ? ids : String(ids ?? '').split(',').filter(Boolean);
    const businessType = req.body.businessType ?? req.body.selBType ?? '2';
    res.json(await getSensitivityAnalysis(parsed, businessType));
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to load sensitivity analysis.' });
  }
});

router.post('/sensitivity_analysis/pdf', async (req, res) => {
  try {
    const { buffer, filename } = await generateSensitivityAnalysisPdf(req.body || {});
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(error.status || 400).json({
      message: error.message || 'Failed to generate sensitivity analysis PDF.',
    });
  }
});

router.post('/sensitivity_analysis/:id/update', async (req, res) => {
  try {
    res.json(await updateSensitivityEstimate(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to update estimate.' });
  }
});

router.post('/decision_chart', async (req, res) => {
  try {
    const ids = req.body.ids ?? req.body.chkArr;
    const parsed = Array.isArray(ids) ? ids : String(ids ?? '').split(',').filter(Boolean);
    res.json(await getCompareEstimates(parsed));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load decision chart.' });
  }
});

router.post('/decision_chart/submit', async (req, res) => {
  try {
    const result = await submitDecisionChart(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/options/31', (_req, res) => {
  res.json({ rows: [] });
});

router.get('/vessel_positions/within_range', async (req, res) => {
  try {
    const { lat, lng, radius, navstatus } = req.query;
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedRadius = Number(radius);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      return res.status(400).json({ message: 'Latitude and longitude are required.' });
    }
    if (!Number.isFinite(parsedRadius) || parsedRadius <= 0) {
      return res.status(400).json({ message: 'Radius should be greater than zero.' });
    }

    const data = await queryVesselsWithinRange({
      lat: parsedLat,
      lng: parsedLng,
      radius: parsedRadius,
      navstatus: navstatus ? String(navstatus) : '',
    });

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load vessel positions.' });
  }
});

router.get('/support_tickets', async (req, res) => {
  try {
    const { page, pageSize, search } = req.query;
    const data = await listSupportTickets({
      page,
      pageSize,
      search,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load support tickets.' });
  }
});

router.post('/support_tickets', ticketUpload, async (req, res) => {
  try {
    const { attachment, attachmentName } = mapUploadedFiles(req.files);
    const result = await createSupportTicket({
      message: req.body.message,
      attachment,
      attachmentName,
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create support ticket.', msg: 1 });
  }
});

router.get('/support_tickets/:ticketId/messages', async (req, res) => {
  try {
    const data = await getTicketMessages(req.params.ticketId);
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.message === 'Support ticket not found.' ? 404 : 500;
    res.status(status).json({ message: error.message || 'Failed to load ticket messages.' });
  }
});

router.post('/support_tickets/:ticketId/messages', async (req, res) => {
  try {
    const data = await sendTicketMessage(req.params.ticketId, req.body.message);
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.message === 'Support ticket not found.' ? 404 : 400;
    res.status(status).json({ message: error.message || 'Failed to send message.', msg: 1 });
  }
});

router.put('/support_tickets/:ticketId', async (req, res) => {
  try {
    const data = await updateSupportTicket(req.params.ticketId, {
      replyMessage: req.body.replyMessage,
      status: req.body.status,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.message === 'Support ticket not found.' ? 404 : 400;
    res.status(status).json({ message: error.message || 'Failed to update support ticket.', msg: 1 });
  }
});

export default router;
