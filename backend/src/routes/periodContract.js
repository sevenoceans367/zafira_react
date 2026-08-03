import { Router } from 'express';
import {
  createPeriodContract,
  getPeriodContractById,
  getPeriodContractList,
  getPeriodContractLookups,
  getPeriodLinkedVoyage,
  getPeriodNominations,
  searchPeriodContractPorts,
  updatePeriodContract,
} from '../services/periodContractService.js';
import { mapUploadedFiles } from '../utils/ticketAttachments.js';
import { mergeVesselAttachments, vesselUpload } from '../utils/vesselAttachments.js';

const router = Router();

router.get('/lookups', async (_req, res) => {
  try {
    const data = await getPeriodContractLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load period contract lookups.' });
  }
});

router.get('/ports', async (req, res) => {
  try {
    const rows = await searchPeriodContractPorts(req.query.q || '');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to search ports.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const data = await getPeriodContractList({
      selBType: req.query.selBType,
      status: req.query.status || 'open',
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 10,
      search: req.query.search || '',
      sortColumn: Number(req.query.sortColumn) || 1,
      sortDir: req.query.sortDir || 'desc',
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load period contract list.' });
  }
});

router.post('/', vesselUpload, async (req, res) => {
  try {
    const payload = req.body.payload ? JSON.parse(req.body.payload) : req.body;
    const { attachment, attachmentName } = mapUploadedFiles(req.files);
    const result = await createPeriodContract(payload, { attachment, attachmentName });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create period contract.', msg: 1 });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await getPeriodContractById(req.params.id);
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ message: error.message || 'Failed to load period contract.' });
  }
});

router.get('/:id/voyage', async (req, res) => {
  try {
    const data = await getPeriodLinkedVoyage(req.params.id);
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ message: error.message || 'Failed to load period voyage.' });
  }
});

router.get('/:id/nominations', async (req, res) => {
  try {
    const data = await getPeriodNominations(req.params.id, {
      businessType: req.query.selBType || '',
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ message: error.message || 'Failed to load period nominations.' });
  }
});

router.put('/:id', vesselUpload, async (req, res) => {
  try {
    const payload = req.body.payload ? JSON.parse(req.body.payload) : req.body;
    const existingFiles = String(req.body.existingFiles || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const existingNames = String(req.body.existingNames || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const { attachment, attachmentName } = mergeVesselAttachments(
      existingFiles,
      existingNames,
      req.files || [],
    );
    const result = await updatePeriodContract(req.params.id, payload, {
      attachment,
      attachmentName,
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    const status = error.message?.includes('not found') ? 404
      : error.message?.includes('cannot be edited') ? 403
        : 400;
    res.status(status).json({ message: error.message || 'Failed to update period contract.', msg: 1 });
  }
});

export default router;
