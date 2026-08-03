import { Router } from 'express';
import {
  createElibraryReference,
  deleteElibraryReference,
  getElibraryReference,
  listElibraryLookups,
  listElibraryReferences,
  updateElibraryReference,
} from '../services/elibraryService.js';
import { mapUploadedFiles, ticketUpload } from '../utils/ticketAttachments.js';
import { mergeVesselAttachments } from '../utils/vesselAttachments.js';

const router = Router();

router.get('/lookups', async (_req, res) => {
  try {
    const data = await listElibraryLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load E-Library lookups.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const data = await listElibraryReferences({
      categoryId: req.query.selCategory || '',
      referenceTypeId: req.query.selRefType || '',
      name: req.query.txtName || req.query.search || '',
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load E-Library list.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await getElibraryReference(req.params.id);
    if (!data) {
      res.status(404).json({ message: 'E-Library reference not found.' });
      return;
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load E-Library reference.' });
  }
});

router.post('/', ticketUpload, async (req, res) => {
  try {
    const payload = req.body.payload ? JSON.parse(req.body.payload) : req.body;
    const { attachment, attachmentName } = mapUploadedFiles(req.files);
    const result = await createElibraryReference(payload, { attachment, attachmentName });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create E-Library reference.', msg: 1 });
  }
});

router.put('/:id', ticketUpload, async (req, res) => {
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
    const result = await updateElibraryReference(req.params.id, payload, {
      attachment,
      attachmentName,
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    const status = error.status || 400;
    res.status(status).json({ message: error.message || 'Failed to update E-Library reference.', msg: 1 });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await deleteElibraryReference(req.params.id);
    res.json(result);
  } catch (error) {
    console.error(error);
    const status = error.status || 400;
    res.status(status).json({ message: error.message || 'Failed to delete E-Library reference.' });
  }
});

export default router;
