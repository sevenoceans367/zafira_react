import { Router } from 'express';
import { getRequestUser } from '../services/authService.js';
import {
  cancelGenericInvoice,
  createGenericInvoice,
  getBankingDetail,
  getGenericFinanceBusinessTypes,
  getGenericInvoiceLookups,
  getVendorBanking,
  listGenericFinanceYears,
  listGenericFinances,
  receiveGenericPayment,
} from '../services/genericFinancesService.js';
import { mergeVesselAttachments, vesselUpload } from '../utils/vesselAttachments.js';

const router = Router();

router.get('/business-types', (req, res) => {
  res.json(getGenericFinanceBusinessTypes(req.query.selBType || '2'));
});

router.get('/years', async (_req, res) => {
  try {
    const years = await listGenericFinanceYears();
    res.json(years);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load years.' });
  }
});

router.get('/new', async (req, res) => {
  try {
    const user = getRequestUser(req);
    const lookups = await getGenericInvoiceLookups(user?.id);
    res.json({ lookups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load invoice form.' });
  }
});

router.get('/banking/:bdId', async (req, res) => {
  try {
    getRequestUser(req);
    const detail = await getBankingDetail(req.params.bdId);
    if (!detail) {
      res.status(404).json({ message: 'Banking details not found.' });
      return;
    }
    res.json(detail);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load banking details.' });
  }
});

router.get('/vendors/:vendorId/banking', async (req, res) => {
  try {
    getRequestUser(req);
    const rows = await getVendorBanking(req.params.vendorId);
    res.json({ records: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load vendor banking.' });
  }
});

router.post('/', vesselUpload, async (req, res) => {
  try {
    const user = getRequestUser(req);
    const { attachment, attachmentName } = mergeVesselAttachments([], [], req.files || []);
    const payload = {
      ...req.body,
      upload: attachment,
      uploadName: attachmentName,
      selApprovers: req.body.selApprovers
        ? (Array.isArray(req.body.selApprovers)
          ? req.body.selApprovers
          : String(req.body.selApprovers).split(',').filter(Boolean))
        : [],
    };
    const data = await createGenericInvoice(payload, { userId: user?.id });
    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to create invoice.' });
  }
});

router.get('/', async (req, res) => {
  try {
    getRequestUser(req);
    const data = await listGenericFinances({
      search: req.query.search || '',
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 50,
      selBType: req.query.selBType || '2',
      selYear: req.query.selYear || String(new Date().getFullYear()),
    });
    res.json({ ...data, canCreate: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load Generic Finances list.' });
  }
});

router.post('/:invoiceId/cancel', async (req, res) => {
  try {
    getRequestUser(req);
    const data = await cancelGenericInvoice(req.params.invoiceId);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to cancel invoice.' });
  }
});

router.post('/:invoiceId/payment', async (req, res) => {
  try {
    getRequestUser(req);
    const data = await receiveGenericPayment(req.params.invoiceId, {
      amount: req.body.amount,
      paymentDate: req.body.paymentDate || req.body.date,
      remarks: req.body.remarks || '',
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to record payment.' });
  }
});

export default router;
