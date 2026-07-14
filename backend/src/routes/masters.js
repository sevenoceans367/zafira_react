import { Router } from 'express';
import {
  createAgencyFeeRecord,
  getAgencyFeeRecord,
  getAgencyFeeRecordLookups,
  listAgencyFeeRecords,
  searchMasterPorts,
  updateAgencyFeeRecord,
  updateAgencyFeeRecordStatus,
} from '../services/agencyFeeRecordService.js';
import {
  createBalticRoute,
  getBalticRoute,
  listBalticRoutes,
  updateBalticRoute,
  updateBalticRouteStatus,
} from '../services/balticRouteService.js';
import {
  createBunkerGrade,
  getBunkerGrade,
  listBunkerGrades,
  updateBunkerGrade,
  updateBunkerGradeStatus,
} from '../services/bunkerGradeService.js';
import {
  createChartererCost,
  getChartererCost,
  listChartererCosts,
  updateChartererCost,
  updateChartererCostStatus,
} from '../services/chartererCostService.js';
import {
  createCoaRoute,
  getCoaRoute,
  listCoaRoutes,
  updateCoaRoute,
  updateCoaRouteStatus,
} from '../services/coaRouteService.js';
import {
  createContractType,
  getContractType,
  listContractTypes,
  updateContractType,
  updateContractTypeStatus,
} from '../services/contractTypeService.js';
import {
  createExpenseType,
  getExpenseType,
  listExpenseTypes,
  updateExpenseType,
  updateExpenseTypeStatus,
} from '../services/expenseTypeService.js';
import {
  createNecessaryApproval,
  getNecessaryApproval,
  listNecessaryApprovals,
  updateNecessaryApproval,
  updateNecessaryApprovalStatus,
} from '../services/necessaryApprovalService.js';
import {
  createElibraryCategory,
  getElibraryCategory,
  listElibraryCategories,
  updateElibraryCategory,
  updateElibraryCategoryStatus,
} from '../services/elibraryCategoryService.js';
import {
  createElibraryReferenceType,
  getElibraryReferenceType,
  listElibraryReferenceTypes,
  updateElibraryReferenceType,
  updateElibraryReferenceTypeStatus,
} from '../services/elibraryReferenceTypeService.js';
import {
  createInvoiceStatus,
  getInvoiceStatus,
  listInvoiceStatuses,
  updateInvoiceStatus,
  updateInvoiceStatusStatus,
} from '../services/invoiceStatusService.js';
import {
  createEstimatedRatio,
  getEstimatedRatio,
  getEstimatedRatioLookups,
  listEstimatedRatios,
  updateEstimatedRatio,
  updateEstimatedRatioStatus,
} from '../services/estimatedRatioService.js';
import {
  createLawArbitration,
  getLawArbitration,
  listLawArbitrations,
  updateLawArbitration,
  updateLawArbitrationStatus,
} from '../services/lawArbitrationService.js';
import {
  createLoadOption,
  getLoadOption,
  listLoadOptions,
  updateLoadOption,
  updateLoadOptionStatus,
} from '../services/loadOptionService.js';
import {
  createMaterial,
  getMaterial,
  listMaterials,
  updateMaterial,
  updateMaterialStatus,
} from '../services/materialService.js';
import {
  createMsds,
  deleteMsds,
  getMsds,
  getMsdsLookups,
  listMsds,
  updateMsds,
} from '../services/msdsService.js';
import { mapUploadedFiles, ticketUpload } from '../utils/ticketAttachments.js';

const router = Router();

router.get('/agency-fee-records/lookups', async (_req, res) => {
  try {
    const data = await getAgencyFeeRecordLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load agency fee lookups.' });
  }
});

router.get('/agency-fee-records', async (_req, res) => {
  try {
    const data = await listAgencyFeeRecords();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load agency fee records.' });
  }
});

router.get('/agency-fee-records/:id', async (req, res) => {
  try {
    const record = await getAgencyFeeRecord(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Agency fee record not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load agency fee record.' });
  }
});

router.post('/agency-fee-records', async (req, res) => {
  try {
    const result = await createAgencyFeeRecord(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    const status = error.code === 'DUPLICATE' ? 409 : 400;
    res.status(status).json({ message: error.message || 'Failed to create agency fee record.', msg: 1 });
  }
});

router.put('/agency-fee-records/:id', async (req, res) => {
  try {
    const result = await updateAgencyFeeRecord(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update agency fee record.', msg: 1 });
  }
});

router.post('/agency-fee-records/:id/status', async (req, res) => {
  try {
    const result = await updateAgencyFeeRecordStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/ports', async (req, res) => {
  try {
    const rows = await searchMasterPorts(req.query.q || '');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to search ports.' });
  }
});

router.get('/baltic-routes', async (_req, res) => {
  try {
    const data = await listBalticRoutes();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Baltic Dry Index list.' });
  }
});

router.get('/baltic-routes/:id', async (req, res) => {
  try {
    const record = await getBalticRoute(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Baltic Dry Index record not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Baltic Dry Index record.' });
  }
});

router.post('/baltic-routes', async (req, res) => {
  try {
    const result = await createBalticRoute(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create Baltic Dry Index record.', msg: 1 });
  }
});

router.put('/baltic-routes/:id', async (req, res) => {
  try {
    const result = await updateBalticRoute(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update Baltic Dry Index record.', msg: 1 });
  }
});

router.post('/baltic-routes/:id/status', async (req, res) => {
  try {
    const result = await updateBalticRouteStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/bunker-grades', async (_req, res) => {
  try {
    const data = await listBunkerGrades();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load bunker grade list.' });
  }
});

router.get('/bunker-grades/:id', async (req, res) => {
  try {
    const record = await getBunkerGrade(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Bunker grade not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load bunker grade.' });
  }
});

router.post('/bunker-grades', async (req, res) => {
  try {
    const result = await createBunkerGrade(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create bunker grade.', msg: 1 });
  }
});

router.put('/bunker-grades/:id', async (req, res) => {
  try {
    const result = await updateBunkerGrade(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update bunker grade.', msg: 1 });
  }
});

router.post('/bunker-grades/:id/status', async (req, res) => {
  try {
    const result = await updateBunkerGradeStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/charterer-costs', async (_req, res) => {
  try {
    const data = await listChartererCosts();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load charterer cost list.' });
  }
});

router.get('/charterer-costs/:id', async (req, res) => {
  try {
    const record = await getChartererCost(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Charterer cost not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load charterer cost.' });
  }
});

router.post('/charterer-costs', async (req, res) => {
  try {
    const result = await createChartererCost(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create charterer cost.', msg: 1 });
  }
});

router.put('/charterer-costs/:id', async (req, res) => {
  try {
    const result = await updateChartererCost(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update charterer cost.', msg: 1 });
  }
});

router.post('/charterer-costs/:id/status', async (req, res) => {
  try {
    const result = await updateChartererCostStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/coa-routes', async (_req, res) => {
  try {
    const data = await listCoaRoutes();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load COA route list.' });
  }
});

router.get('/coa-routes/:id', async (req, res) => {
  try {
    const record = await getCoaRoute(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'COA route not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load COA route.' });
  }
});

router.post('/coa-routes', async (req, res) => {
  try {
    const result = await createCoaRoute(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create COA route.', msg: 1 });
  }
});

router.put('/coa-routes/:id', async (req, res) => {
  try {
    const result = await updateCoaRoute(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update COA route.', msg: 1 });
  }
});

router.post('/coa-routes/:id/status', async (req, res) => {
  try {
    const result = await updateCoaRouteStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/contract-types', async (_req, res) => {
  try {
    const data = await listContractTypes();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load contract type list.' });
  }
});

router.get('/contract-types/:id', async (req, res) => {
  try {
    const record = await getContractType(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Contract type not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load contract type.' });
  }
});

router.post('/contract-types', async (req, res) => {
  try {
    const result = await createContractType(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create contract type.', msg: 1 });
  }
});

router.put('/contract-types/:id', async (req, res) => {
  try {
    const result = await updateContractType(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update contract type.', msg: 1 });
  }
});

router.post('/contract-types/:id/status', async (req, res) => {
  try {
    const result = await updateContractTypeStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/necessary-approvals', async (_req, res) => {
  try {
    const data = await listNecessaryApprovals();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load necessary approval list.' });
  }
});

router.get('/necessary-approvals/:id', async (req, res) => {
  try {
    const record = await getNecessaryApproval(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Necessary approval not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load necessary approval.' });
  }
});

router.post('/necessary-approvals', async (req, res) => {
  try {
    const result = await createNecessaryApproval(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create necessary approval.', msg: 1 });
  }
});

router.put('/necessary-approvals/:id', async (req, res) => {
  try {
    const result = await updateNecessaryApproval(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update necessary approval.', msg: 1 });
  }
});

router.post('/necessary-approvals/:id/status', async (req, res) => {
  try {
    const result = await updateNecessaryApprovalStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/expense-types', async (_req, res) => {
  try {
    const data = await listExpenseTypes();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load expense type list.' });
  }
});

router.get('/expense-types/:id', async (req, res) => {
  try {
    const record = await getExpenseType(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Expense type not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load expense type.' });
  }
});

router.post('/expense-types', async (req, res) => {
  try {
    const result = await createExpenseType(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create expense type.', msg: 1 });
  }
});

router.put('/expense-types/:id', async (req, res) => {
  try {
    const result = await updateExpenseType(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update expense type.', msg: 1 });
  }
});

router.post('/expense-types/:id/status', async (req, res) => {
  try {
    const result = await updateExpenseTypeStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/elibrary-categories', async (_req, res) => {
  try {
    const data = await listElibraryCategories();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load E-Library category list.' });
  }
});

router.get('/elibrary-categories/:id', async (req, res) => {
  try {
    const record = await getElibraryCategory(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'E-Library category not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load E-Library category.' });
  }
});

router.post('/elibrary-categories', async (req, res) => {
  try {
    const result = await createElibraryCategory(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create E-Library category.', msg: 1 });
  }
});

router.put('/elibrary-categories/:id', async (req, res) => {
  try {
    const result = await updateElibraryCategory(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update E-Library category.', msg: 1 });
  }
});

router.post('/elibrary-categories/:id/status', async (req, res) => {
  try {
    const result = await updateElibraryCategoryStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/elibrary-reference-types', async (_req, res) => {
  try {
    const data = await listElibraryReferenceTypes();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load E-Library reference type list.' });
  }
});

router.get('/elibrary-reference-types/:id', async (req, res) => {
  try {
    const record = await getElibraryReferenceType(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'E-Library reference type not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load E-Library reference type.' });
  }
});

router.post('/elibrary-reference-types', async (req, res) => {
  try {
    const result = await createElibraryReferenceType(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create E-Library reference type.', msg: 1 });
  }
});

router.put('/elibrary-reference-types/:id', async (req, res) => {
  try {
    const result = await updateElibraryReferenceType(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update E-Library reference type.', msg: 1 });
  }
});

router.post('/elibrary-reference-types/:id/status', async (req, res) => {
  try {
    const result = await updateElibraryReferenceTypeStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/invoice-statuses', async (_req, res) => {
  try {
    const data = await listInvoiceStatuses();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load invoice status list.' });
  }
});

router.get('/invoice-statuses/:id', async (req, res) => {
  try {
    const record = await getInvoiceStatus(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Invoice status not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load invoice status.' });
  }
});

router.post('/invoice-statuses', async (req, res) => {
  try {
    const result = await createInvoiceStatus(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create invoice status.', msg: 1 });
  }
});

router.put('/invoice-statuses/:id', async (req, res) => {
  try {
    const result = await updateInvoiceStatus(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update invoice status.', msg: 1 });
  }
});

router.post('/invoice-statuses/:id/status', async (req, res) => {
  try {
    const result = await updateInvoiceStatusStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/estimated-ratios/lookups', async (_req, res) => {
  try {
    const data = await getEstimatedRatioLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load estimated ratio lookups.' });
  }
});

router.get('/estimated-ratios', async (_req, res) => {
  try {
    const data = await listEstimatedRatios();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load estimated ratio list.' });
  }
});

router.get('/estimated-ratios/:id', async (req, res) => {
  try {
    const record = await getEstimatedRatio(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Estimated ratio not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load estimated ratio.' });
  }
});

router.post('/estimated-ratios', async (req, res) => {
  try {
    const result = await createEstimatedRatio(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create estimated ratio.', msg: 1 });
  }
});

router.put('/estimated-ratios/:id', async (req, res) => {
  try {
    const result = await updateEstimatedRatio(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update estimated ratio.', msg: 1 });
  }
});

router.post('/estimated-ratios/:id/status', async (req, res) => {
  try {
    const result = await updateEstimatedRatioStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/law-arbitrations', async (_req, res) => {
  try {
    const data = await listLawArbitrations();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Law/Arbitration list.' });
  }
});

router.get('/law-arbitrations/:id', async (req, res) => {
  try {
    const record = await getLawArbitration(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Law/Arbitration not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Law/Arbitration.' });
  }
});

router.post('/law-arbitrations', async (req, res) => {
  try {
    const result = await createLawArbitration(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create Law/Arbitration.', msg: 1 });
  }
});

router.put('/law-arbitrations/:id', async (req, res) => {
  try {
    const result = await updateLawArbitration(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update Law/Arbitration.', msg: 1 });
  }
});

router.post('/law-arbitrations/:id/status', async (req, res) => {
  try {
    const result = await updateLawArbitrationStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/load-options', async (_req, res) => {
  try {
    const data = await listLoadOptions();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Load Options list.' });
  }
});

router.get('/load-options/:id', async (req, res) => {
  try {
    const record = await getLoadOption(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Load Option not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Load Option.' });
  }
});

router.post('/load-options', async (req, res) => {
  try {
    const result = await createLoadOption(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create Load Option.', msg: 1 });
  }
});

router.put('/load-options/:id', async (req, res) => {
  try {
    const result = await updateLoadOption(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update Load Option.', msg: 1 });
  }
});

router.post('/load-options/:id/status', async (req, res) => {
  try {
    const result = await updateLoadOptionStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/materials', async (_req, res) => {
  try {
    const data = await listMaterials();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load material list.' });
  }
});

router.get('/materials/:id', async (req, res) => {
  try {
    const record = await getMaterial(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Material not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load material.' });
  }
});

router.post('/materials', async (req, res) => {
  try {
    const result = await createMaterial(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create material.', msg: 1 });
  }
});

router.put('/materials/:id', async (req, res) => {
  try {
    const result = await updateMaterial(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update material.', msg: 1 });
  }
});

router.post('/materials/:id/status', async (req, res) => {
  try {
    const result = await updateMaterialStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/msds/lookups', async (_req, res) => {
  try {
    const data = await getMsdsLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load MSDS lookups.' });
  }
});

router.get('/msds', async (_req, res) => {
  try {
    const data = await listMsds();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load MSDS list.' });
  }
});

router.get('/msds/:id', async (req, res) => {
  try {
    const record = await getMsds(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'MSDS record not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load MSDS record.' });
  }
});

router.post('/msds', ticketUpload, async (req, res) => {
  try {
    const { attachment } = mapUploadedFiles(req.files);
    const result = await createMsds(req.body, attachment);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create MSDS record.', msg: 1 });
  }
});

router.put('/msds/:id', ticketUpload, async (req, res) => {
  try {
    const { attachment } = mapUploadedFiles(req.files);
    const result = await updateMsds(req.params.id, req.body, attachment);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update MSDS record.', msg: 1 });
  }
});

router.delete('/msds/:id', async (req, res) => {
  try {
    const result = await deleteMsds(req.params.id);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to delete MSDS record.', msg: 1 });
  }
});

export default router;
