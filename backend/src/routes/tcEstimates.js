import { Router } from 'express';
import {
  createTcEstimate,
  deleteTcEstimate,
  getPeriodTcInDetails,
  getTcBusinessTypes,
  getTcCompareEstimates,
  getTcDecisionChartDetails,
  getTcEstimate,
  getTcLookups,
  listTcDecisionCharts,
  listTcEstimates,
  nextTcEstimateNo,
  saveTcCalculation,
  submitTcDecisionChart,
  sendTcEstimatesToOps,
  updateTcEstimate,
} from '../services/tcEstimateService.js';
import {
  generateTcDecisionChartPdf,
  generateTcDecisionChartsPdf,
} from '../services/tcDecisionChartPdfService.js';
import { generateTcEstimatePdf } from '../services/tcEstimatePdfService.js';

const router = Router();

function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({
        message: error.message || 'TC estimate request failed.',
      });
    }
  };
}

router.get('/business-types', asyncHandler(async (req, res) => {
  res.json(getTcBusinessTypes(req.query.selectedId || req.query.selBType || '2'));
}));

router.get('/lookups', asyncHandler(async (_req, res) => {
  res.json(await getTcLookups());
}));

router.get('/next-estimate-no', asyncHandler(async (req, res) => {
  res.json({ estimateNo: await nextTcEstimateNo(req.query.tcNo || '') });
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await listTcEstimates({
    selBType: req.query.selBType || '2',
    periodFrom: req.query.periodFrom || '',
    periodTo: req.query.periodTo || '',
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
  }));
}));

router.get('/decision-charts', asyncHandler(async (req, res) => {
  res.json(await listTcDecisionCharts({
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
    search: req.query.search || '',
  }));
}));

router.get('/decision-charts/pdf', asyncHandler(async (_req, res) => {
  const result = await generateTcDecisionChartsPdf();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  return res.send(result.buffer);
}));

router.get('/decision-charts/:message/pdf', asyncHandler(async (req, res) => {
  const result = await generateTcDecisionChartPdf(req.params.message);
  if (!result) return res.status(404).json({ message: 'Decision chart not found.' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  return res.send(result.buffer);
}));

router.get('/decision-charts/:message', asyncHandler(async (req, res) => {
  const data = await getTcDecisionChartDetails(req.params.message);
  if (!data) return res.status(404).json({ message: 'Decision chart not found.' });
  return res.json(data);
}));

router.get('/compare', asyncHandler(async (req, res) => {
  const ids = req.query.ids || req.query.chkArr || '';
  res.json(await getTcCompareEstimates(ids));
}));

router.get('/period-tc-in/:periodId', asyncHandler(async (req, res) => {
  const data = await getPeriodTcInDetails(req.params.periodId);
  if (!data) return res.status(404).json({ message: 'Period contract not found.' });
  return res.json(data);
}));

router.post('/decision-chart', asyncHandler(async (req, res) => {
  res.json(await submitTcDecisionChart(req.body || {}));
}));

router.post('/send-to-ops', asyncHandler(async (req, res) => {
  const ids = req.body?.tcOutIds ?? req.body?.ids ?? [];
  res.json(await sendTcEstimatesToOps(ids));
}));

router.get('/:tcOutId/pdf', asyncHandler(async (req, res) => {
  const result = await generateTcEstimatePdf(req.params.tcOutId);
  if (!result) return res.status(404).json({ message: 'TC estimate not found.' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  return res.send(result.buffer);
}));

router.get('/:tcOutId', asyncHandler(async (req, res) => {
  const data = await getTcEstimate(req.params.tcOutId);
  if (!data) return res.status(404).json({ message: 'TC estimate not found.' });
  return res.json(data);
}));

router.post('/', asyncHandler(async (req, res) => {
  res.json(await createTcEstimate(req.body || {}));
}));

router.put('/:tcOutId', asyncHandler(async (req, res) => {
  const data = await updateTcEstimate(req.params.tcOutId, req.body || {});
  if (!data) return res.status(404).json({ message: 'TC estimate not found.' });
  return res.json(data);
}));

router.put('/:tcOutId/calculate', asyncHandler(async (req, res) => {
  const data = await saveTcCalculation(req.params.tcOutId, req.body || {});
  if (!data) return res.status(404).json({ message: 'TC estimate not found.' });
  return res.json(data);
}));

router.delete('/:tcOutId', asyncHandler(async (req, res) => {
  const data = await deleteTcEstimate(req.params.tcOutId);
  if (!data) return res.status(404).json({ message: 'TC estimate not found.' });
  return res.json(data);
}));

export default router;
