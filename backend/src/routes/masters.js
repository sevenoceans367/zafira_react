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
  createOwnerRelatedCost,
  getOwnerRelatedCost,
  listOwnerRelatedCosts,
  updateOwnerRelatedCost,
  updateOwnerRelatedCostStatus,
} from '../services/ownerRelatedCostService.js';
import {
  createOtherMiscCost,
  getOtherMiscCost,
  listOtherMiscCosts,
  updateOtherMiscCost,
  updateOtherMiscCostStatus,
} from '../services/otherMiscCostService.js';
import {
  createOtherShippingCost,
  getOtherShippingCost,
  listOtherShippingCosts,
  updateOtherShippingCost,
  updateOtherShippingCostStatus,
} from '../services/otherShippingCostService.js';
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
  createPcctf,
  getPcctf,
  getPcctfLookups,
  listPcctf,
  updatePcctf,
  updatePcctfStatus,
} from '../services/pcctfService.js';
import {
  createPcftf,
  getPcftf,
  getPcftfLookups,
  listPcftf,
  updatePcftf,
  updatePcftfStatus,
} from '../services/pcftfService.js';
import {
  createPortCostTypes,
  getPortCostType,
  getPortCostTypeLookups,
  listPortCostTypes,
  updatePortCostType,
  updatePortCostTypeStatus,
} from '../services/portCostTypeService.js';
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
import {
  createPortData,
  deletePortData,
  getPortData,
  getPortDataLookups,
  listPortData,
  updatePortData,
} from '../services/portDataService.js';
import {
  createPortInformation,
  getPortInformation,
  getPortInformationLookups,
  getPortInformationTerminals,
  listPortInformation,
  updatePortInformation,
  updatePortInformationStatus,
} from '../services/portInformationService.js';
import {
  createTcDeduction,
  getTcDeduction,
  listTcDeductions,
  updateTcDeduction,
  updateTcDeductionStatus,
} from '../services/tcDeductionService.js';
import {
  createVcDeduction,
  getVcDeduction,
  listVcDeductions,
  updateVcDeduction,
  updateVcDeductionStatus,
} from '../services/vcDeductionService.js';
import {
  createAccountingGroup,
  getAccountingGroup,
  listAccountingGroups,
  updateAccountingGroup,
  updateAccountingGroupStatus,
} from '../services/accountingGroupService.js';
import {
  createVesselCategory,
  getVesselCategory,
  listVesselCategories,
  updateVesselCategory,
  updateVesselCategoryStatus,
} from '../services/vesselCategoryService.js';
import {
  createRateNetTon,
  getRateNetTon,
  getRateNetTonLookups,
  listRateNetTons,
  updateRateNetTon,
  updateRateNetTonStatus,
} from '../services/rateNetTonService.js';
import {
  createScnt,
  getScnt,
  getScntLookups,
  listScnt,
  updateScnt,
  updateScntStatus,
} from '../services/scntService.js';
import {
  createSdrRate,
  getSdrRate,
  getSdrRateLookups,
  listSdrRates,
  updateSdrRate,
  updateSdrRateStatus,
} from '../services/sdrRateService.js';
import {
  createVesselType,
  getVesselType,
  getVesselTypeLookups,
  listVesselTypes,
  updateVesselType,
} from '../services/vesselTypeService.js';
import {
  createAccountingLedger,
  getAccountingLedger,
  getAccountingLedgerLookups,
  listAccountingLedgers,
  updateAccountingLedger,
  updateAccountingLedgerStatus,
} from '../services/accountingLedgerService.js';
import {
  createTerminal,
  getTerminal,
  listTerminals,
  updateTerminal,
  updateTerminalStatus,
} from '../services/terminalService.js';
import {
  createVendor,
  getVendor,
  getVendorLookups,
  listVendors,
  updateVendor,
} from '../services/vendorService.js';
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

router.get('/owner-related-costs', async (_req, res) => {
  try {
    const data = await listOwnerRelatedCosts();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load owner related cost list.' });
  }
});

router.get('/owner-related-costs/:id', async (req, res) => {
  try {
    const record = await getOwnerRelatedCost(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Owner related cost not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load owner related cost.' });
  }
});

router.post('/owner-related-costs', async (req, res) => {
  try {
    const result = await createOwnerRelatedCost(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create owner related cost.', msg: 1 });
  }
});

router.put('/owner-related-costs/:id', async (req, res) => {
  try {
    const result = await updateOwnerRelatedCost(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update owner related cost.', msg: 1 });
  }
});

router.post('/owner-related-costs/:id/status', async (req, res) => {
  try {
    const result = await updateOwnerRelatedCostStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/other-misc-costs', async (_req, res) => {
  try {
    const data = await listOtherMiscCosts();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load other miscellaneous cost list.' });
  }
});

router.get('/other-misc-costs/:id', async (req, res) => {
  try {
    const record = await getOtherMiscCost(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Other miscellaneous cost not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load other miscellaneous cost.' });
  }
});

router.post('/other-misc-costs', async (req, res) => {
  try {
    const result = await createOtherMiscCost(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create other miscellaneous cost.', msg: 1 });
  }
});

router.put('/other-misc-costs/:id', async (req, res) => {
  try {
    const result = await updateOtherMiscCost(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update other miscellaneous cost.', msg: 1 });
  }
});

router.post('/other-misc-costs/:id/status', async (req, res) => {
  try {
    const result = await updateOtherMiscCostStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/other-shipping-costs', async (_req, res) => {
  try {
    const data = await listOtherShippingCosts();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load other shipping cost list.' });
  }
});

router.get('/other-shipping-costs/:id', async (req, res) => {
  try {
    const record = await getOtherShippingCost(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Other shipping cost not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load other shipping cost.' });
  }
});

router.post('/other-shipping-costs', async (req, res) => {
  try {
    const result = await createOtherShippingCost(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create other shipping cost.', msg: 1 });
  }
});

router.put('/other-shipping-costs/:id', async (req, res) => {
  try {
    const result = await updateOtherShippingCost(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update other shipping cost.', msg: 1 });
  }
});

router.post('/other-shipping-costs/:id/status', async (req, res) => {
  try {
    const result = await updateOtherShippingCostStatus(req.params.id, req.body.status);
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

router.get('/pcctf/lookups', async (_req, res) => {
  try {
    const data = await getPcctfLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Panama Canal Capacity Tariff Fee lookups.' });
  }
});

router.get('/pcctf', async (_req, res) => {
  try {
    const data = await listPcctf();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Panama Canal Capacity Tariff Fee list.' });
  }
});

router.get('/pcctf/:id', async (req, res) => {
  try {
    const record = await getPcctf(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Panama Canal Capacity Tariff Fee not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Panama Canal Capacity Tariff Fee.' });
  }
});

router.post('/pcctf', async (req, res) => {
  try {
    const result = await createPcctf(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create Panama Canal Capacity Tariff Fee.', msg: 1 });
  }
});

router.put('/pcctf/:id', async (req, res) => {
  try {
    const result = await updatePcctf(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update Panama Canal Capacity Tariff Fee.', msg: 1 });
  }
});

router.post('/pcctf/:id/status', async (req, res) => {
  try {
    const result = await updatePcctfStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/pcftf/lookups', async (_req, res) => {
  try {
    const data = await getPcftfLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Panama Canal Fixed Transit Fee lookups.' });
  }
});

router.get('/pcftf', async (_req, res) => {
  try {
    const data = await listPcftf();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Panama Canal Fixed Transit Fee list.' });
  }
});

router.get('/pcftf/:id', async (req, res) => {
  try {
    const record = await getPcftf(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Panama Canal Fixed Transit Fee not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Panama Canal Fixed Transit Fee.' });
  }
});

router.post('/pcftf', async (req, res) => {
  try {
    const result = await createPcftf(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create Panama Canal Fixed Transit Fee.', msg: 1 });
  }
});

router.put('/pcftf/:id', async (req, res) => {
  try {
    const result = await updatePcftf(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update Panama Canal Fixed Transit Fee.', msg: 1 });
  }
});

router.post('/pcftf/:id/status', async (req, res) => {
  try {
    const result = await updatePcftfStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/port-cost-types/lookups', async (_req, res) => {
  try {
    const data = await getPortCostTypeLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load port cost type lookups.' });
  }
});

router.get('/port-cost-types', async (_req, res) => {
  try {
    const data = await listPortCostTypes();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load port cost type list.' });
  }
});

router.get('/port-cost-types/:id', async (req, res) => {
  try {
    const record = await getPortCostType(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Port cost type not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load port cost type.' });
  }
});

router.post('/port-cost-types', async (req, res) => {
  try {
    const result = await createPortCostTypes(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create port cost type.', msg: 1 });
  }
});

router.put('/port-cost-types/:id', async (req, res) => {
  try {
    const result = await updatePortCostType(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update port cost type.', msg: 1 });
  }
});

router.post('/port-cost-types/:id/status', async (req, res) => {
  try {
    const result = await updatePortCostTypeStatus(req.params.id, req.body.status);
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

router.get('/port-data/lookups', async (_req, res) => {
  try {
    const data = await getPortDataLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Port Data lookups.' });
  }
});

router.get('/port-data', async (_req, res) => {
  try {
    const data = await listPortData();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Port Data list.' });
  }
});

router.get('/port-data/:id', async (req, res) => {
  try {
    const record = await getPortData(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Port Data record not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Port Data record.' });
  }
});

router.post('/port-data', ticketUpload, async (req, res) => {
  try {
    const { attachment, attachmentName } = mapUploadedFiles(req.files);
    let materialIds = req.body.materialIds;
    if (typeof materialIds === 'string') {
      try {
        materialIds = JSON.parse(materialIds);
      } catch {
        materialIds = materialIds.split(',');
      }
    }
    const result = await createPortData(
      { ...req.body, materialIds },
      attachment,
      attachmentName,
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create Port Data record.', msg: 1 });
  }
});

router.put('/port-data/:id', ticketUpload, async (req, res) => {
  try {
    const { attachment, attachmentName } = mapUploadedFiles(req.files);
    const result = await updatePortData(req.params.id, req.body, attachment, attachmentName);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update Port Data record.', msg: 1 });
  }
});

router.delete('/port-data/:id', async (req, res) => {
  try {
    const result = await deletePortData(req.params.id);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to delete Port Data record.', msg: 1 });
  }
});

router.get('/port-information/lookups', async (_req, res) => {
  try {
    const data = await getPortInformationLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Port Information lookups.' });
  }
});

router.get('/port-information/terminals', async (req, res) => {
  try {
    const data = await getPortInformationTerminals(req.query.portId || req.query.portCode || '');
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load terminals.' });
  }
});

router.get('/port-information', async (_req, res) => {
  try {
    const data = await listPortInformation();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Port Information list.' });
  }
});

router.get('/port-information/:id', async (req, res) => {
  try {
    const record = await getPortInformation(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Port Information record not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Port Information record.' });
  }
});

router.post('/port-information', async (req, res) => {
  try {
    const result = await createPortInformation(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({
      message: error.message || 'Failed to create Port Information record.',
      msg: error.msg ?? 1,
    });
  }
});

router.put('/port-information/:id', async (req, res) => {
  try {
    const result = await updatePortInformation(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update Port Information record.', msg: 1 });
  }
});

router.post('/port-information/:id/status', async (req, res) => {
  try {
    const result = await updatePortInformationStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/tc-deductions', async (_req, res) => {
  try {
    const data = await listTcDeductions();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load TC Deduction list.' });
  }
});

router.get('/tc-deductions/:id', async (req, res) => {
  try {
    const record = await getTcDeduction(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'TC Deduction not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load TC Deduction.' });
  }
});

router.post('/tc-deductions', async (req, res) => {
  try {
    const result = await createTcDeduction(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create TC Deduction.', msg: 1 });
  }
});

router.put('/tc-deductions/:id', async (req, res) => {
  try {
    const result = await updateTcDeduction(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update TC Deduction.', msg: 1 });
  }
});

router.post('/tc-deductions/:id/status', async (req, res) => {
  try {
    const result = await updateTcDeductionStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/vc-deductions', async (_req, res) => {
  try {
    const data = await listVcDeductions();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load VC Deduction list.' });
  }
});

router.get('/vc-deductions/:id', async (req, res) => {
  try {
    const record = await getVcDeduction(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'VC Deduction not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load VC Deduction.' });
  }
});

router.post('/vc-deductions', async (req, res) => {
  try {
    const result = await createVcDeduction(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create VC Deduction.', msg: 1 });
  }
});

router.put('/vc-deductions/:id', async (req, res) => {
  try {
    const result = await updateVcDeduction(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update VC Deduction.', msg: 1 });
  }
});

router.post('/vc-deductions/:id/status', async (req, res) => {
  try {
    const result = await updateVcDeductionStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/accounting-groups', async (_req, res) => {
  try {
    const data = await listAccountingGroups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Accounting Group list.' });
  }
});

router.get('/accounting-groups/:id', async (req, res) => {
  try {
    const record = await getAccountingGroup(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Accounting Group not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Accounting Group.' });
  }
});

router.post('/accounting-groups', async (req, res) => {
  try {
    const result = await createAccountingGroup(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create Accounting Group.', msg: 1 });
  }
});

router.put('/accounting-groups/:id', async (req, res) => {
  try {
    const result = await updateAccountingGroup(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update Accounting Group.', msg: 1 });
  }
});

router.post('/accounting-groups/:id/status', async (req, res) => {
  try {
    const result = await updateAccountingGroupStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

router.get('/vessel-categories', async (_req, res) => {
  try {
    const data = await listVesselCategories();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Vessel Category list.' });
  }
});

router.get('/vessel-categories/:id', async (req, res) => {
  try {
    const record = await getVesselCategory(req.params.id);
    if (!record) {
      res.status(404).json({ message: 'Vessel Category not found.' });
      return;
    }
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Vessel Category.' });
  }
});

router.post('/vessel-categories', async (req, res) => {
  try {
    const result = await createVesselCategory(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create Vessel Category.', msg: 1 });
  }
});

router.put('/vessel-categories/:id', async (req, res) => {
  try {
    const result = await updateVesselCategory(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update Vessel Category.', msg: 1 });
  }
});

router.post('/vessel-categories/:id/status', async (req, res) => {
  try {
    const result = await updateVesselCategoryStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
  }
});

function mountCrud(base, handlers) {
  if (handlers.lookups) {
    router.get(`${base}/lookups`, async (_req, res) => {
      try {
        res.json(await handlers.lookups());
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || 'Failed to load lookups.' });
      }
    });
  }
  router.get(base, async (_req, res) => {
    try {
      res.json(await handlers.list());
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message || 'Failed to load list.' });
    }
  });
  router.get(`${base}/:id`, async (req, res) => {
    try {
      const record = await handlers.get(req.params.id);
      if (!record) {
        res.status(404).json({ message: 'Record not found.' });
        return;
      }
      res.json(record);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message || 'Failed to load record.' });
    }
  });
  router.post(base, async (req, res) => {
    try {
      res.json(await handlers.create(req.body));
    } catch (error) {
      console.error(error);
      res.status(400).json({ message: error.message || 'Failed to create record.', msg: 1 });
    }
  });
  router.put(`${base}/:id`, async (req, res) => {
    try {
      res.json(await handlers.update(req.params.id, req.body));
    } catch (error) {
      console.error(error);
      res.status(400).json({ message: error.message || 'Failed to update record.', msg: 1 });
    }
  });
  if (handlers.status) {
    router.post(`${base}/:id/status`, async (req, res) => {
      try {
        res.json(await handlers.status(req.params.id, req.body.status));
      } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message || 'Failed to update status.', msg: 1 });
      }
    });
  }
}

mountCrud('/rate-net-tons', {
  lookups: getRateNetTonLookups,
  list: listRateNetTons,
  get: getRateNetTon,
  create: createRateNetTon,
  update: updateRateNetTon,
  status: updateRateNetTonStatus,
});

mountCrud('/scnt', {
  lookups: getScntLookups,
  list: listScnt,
  get: getScnt,
  create: createScnt,
  update: updateScnt,
  status: updateScntStatus,
});

mountCrud('/sdr-rates', {
  lookups: getSdrRateLookups,
  list: listSdrRates,
  get: getSdrRate,
  create: createSdrRate,
  update: updateSdrRate,
  status: updateSdrRateStatus,
});

mountCrud('/vessel-types', {
  lookups: getVesselTypeLookups,
  list: listVesselTypes,
  get: getVesselType,
  create: createVesselType,
  update: updateVesselType,
});

mountCrud('/accounting-ledgers', {
  lookups: getAccountingLedgerLookups,
  list: listAccountingLedgers,
  get: getAccountingLedger,
  create: createAccountingLedger,
  update: updateAccountingLedger,
  status: updateAccountingLedgerStatus,
});

mountCrud('/terminals', {
  list: listTerminals,
  get: getTerminal,
  create: createTerminal,
  update: updateTerminal,
  status: updateTerminalStatus,
});

mountCrud('/vendors', {
  lookups: getVendorLookups,
  list: listVendors,
  get: getVendor,
  create: createVendor,
  update: updateVendor,
});

export default router;
