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
} from '../services/opsVcService.js';
import {
  deleteAgencyLetter,
  getAgencyLetterForm,
  saveAgencyLetter,
} from '../services/agencyLetterService.js';
import {
  deleteAgencyLetterTc,
  getAgencyLetterTcForm,
  saveAgencyLetterTc,
} from '../services/agencyLetterTcService.js';
import { getPaymentGridTc } from '../services/paymentGridTcService.js';
import { getCompareSheetsTc } from '../services/compareSheetsTcService.js';
import { generateCompareSheetsTcPdf } from '../services/compareSheetsTcPdfService.js';
import { resolveRequestIsMgmtUser } from '../services/authService.js';
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

const router = Router();

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
  res.json(getVcBusinessTypes(req.query.selBType || '3'));
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
    selBType: req.query.selBType || '3',
    selYear: req.query.selYear || String(new Date().getFullYear()),
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  }));
}));

router.get('/ops/post-ops', asyncHandler(async (req, res) => {
  res.json(await listPostOpsAtGlance({
    selBType: req.query.selBType || '3',
    selYear: req.query.selYear || String(new Date().getFullYear()),
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  }));
}));

router.get('/ops/history', asyncHandler(async (req, res) => {
  res.json(await listHistoryAtGlance({
    selBType: req.query.selBType || '3',
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

router.get('/ops/agency-letter/:genAgencyId/pdf', asyncHandler(async (_req, res) => {
  res.status(501).json({
    message: 'Agency letter PDF generation is not migrated yet (legacy allPdf.php).',
  });
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

router.get('/ops-tc/operators', asyncHandler(async (_req, res) => {
  res.json(await listOpsTcOperators());
}));

router.get('/ops-tc/years', asyncHandler(async (_req, res) => {
  res.json(await listOpsTcYears());
}));

router.get('/ops-tc/in-ops-glance', asyncHandler(async (req, res) => {
  res.json(await listInOpsAtGlanceTc({
    selBType: req.query.selBType || '3',
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
    selBType: req.query.selBType || '3',
    selYear: req.query.selYear || String(new Date().getFullYear()),
    search: req.query.search || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
    canEditOperator: resolveRequestIsMgmtUser(req),
  }));
}));

router.get('/ops-tc/history', asyncHandler(async (req, res) => {
  res.json(await listHistoryAtGlanceTc({
    selBType: req.query.selBType || '3',
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
