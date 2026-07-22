import { Router } from 'express';
import {
  getComparisonSheets,
  getReport,
  getReportFilterOptions,
  updateOpsTrackerField,
} from '../services/reportsService.js';
import { generateReportTablePdf } from '../services/reportsTablePdfService.js';

const router = Router();

function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({
        message: error.message || 'Reports request failed.',
      });
    }
  };
}

router.get('/meta/filter-options', asyncHandler(async (_req, res) => {
  res.json(await getReportFilterOptions());
}));

router.get('/meta/comparison-sheets', asyncHandler(async (req, res) => {
  res.json(await getComparisonSheets(req.query.comId));
}));

router.post('/export/pdf', asyncHandler(async (req, res) => {
  const { buffer, filename } = await generateReportTablePdf(req.body || {});
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

router.patch('/:reportId/tracker', asyncHandler(async (req, res) => {
  res.json(await updateOpsTrackerField(req.params.reportId, {
    comId: req.body?.comId ?? req.body?.id,
    iden: req.body?.iden,
    value: req.body?.value ?? req.body?.val,
  }));
}));

router.get('/:reportId', asyncHandler(async (req, res) => {
  res.json(await getReport(req.params.reportId, req.query));
}));

export default router;
