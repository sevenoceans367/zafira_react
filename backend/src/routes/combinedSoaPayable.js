import { Router } from 'express';
import multer from 'multer';
import { getRequestUser } from '../services/authService.js';
import {
  createGroupPayment,
  createGroupPaymentTc,
  getGroupPaymentLookups,
  listCombinedSoaPayable,
  listCombinedSoaPayableTc,
  listGroupPaymentCostLines,
} from '../services/combinedSoaPayableService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

async function handleCreate(req, res, createFn) {
  try {
    let lines = [];
    try {
      lines = JSON.parse(req.body?.lines || '[]');
    } catch {
      lines = [];
    }
    const data = await createFn({
      ...req.body,
      lines,
      files: req.files || [],
      userId: getRequestUser(req)?.id,
    });
    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({
      message: error.message || 'Failed to create group payment.',
    });
  }
}

router.get('/', async (req, res) => {
  try {
    const user = getRequestUser(req);
    const data = await listCombinedSoaPayable({
      search: req.query.search || '',
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 50,
      userId: user?.id,
      variant: 'vc',
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Combined SOA Payable list.' });
  }
});

router.get('/new', async (req, res) => {
  try {
    const data = await getGroupPaymentLookups();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Group Payment form.' });
  }
});

router.get('/cost-lines', async (req, res) => {
  try {
    const data = await listGroupPaymentCostLines({
      selVendor: req.query.selVendor || '',
      selYear: req.query.selYear || '',
      contractType: req.query.contractType || 'spot',
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load cost lines.' });
  }
});

router.get('/tc', async (req, res) => {
  try {
    const user = getRequestUser(req);
    const data = await listCombinedSoaPayableTc({
      search: req.query.search || '',
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 50,
      userId: user?.id,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Combined SOA Payable TC list.' });
  }
});

router.post('/', upload.any(), async (req, res) => {
  await handleCreate(req, res, createGroupPayment);
});

router.post('/tc', upload.any(), async (req, res) => {
  await handleCreate(req, res, createGroupPaymentTc);
});

export default router;
