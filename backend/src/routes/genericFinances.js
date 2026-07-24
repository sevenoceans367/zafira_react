import { Router } from 'express';
import { getRequestUser } from '../services/authService.js';
import {
  cancelGenericInvoice,
  getGenericFinanceBusinessTypes,
  listGenericFinanceYears,
  listGenericFinances,
  receiveGenericPayment,
} from '../services/genericFinancesService.js';

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
