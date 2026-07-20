import { Router } from 'express';
import { getRequestUser } from '../services/authService.js';
import {
  listCombinedSoaPayable,
  listCombinedSoaPayableTc,
} from '../services/combinedSoaPayableService.js';

const router = Router();

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

export default router;
