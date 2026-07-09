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

const router = Router();

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

export default router;
