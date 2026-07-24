import { Router } from 'express';
import authRoutes from './auth.js';
import sopfRoutes from './sopf.js';
import vcRoutes from './vc.js';
import coaRoutes from './coa.js';
import tcEstimateRoutes from './tcEstimates.js';
import fleetRoutes from './fleet.js';
import periodContractRoutes from './periodContract.js';
import todoListRoutes from './todoList.js';
import combinedSoaPayableRoutes from './combinedSoaPayable.js';
import genericFinancesRoutes from './genericFinances.js';
import mastersRoutes from './masters.js';
import reportsRoutes from './reports.js';
import { pingDb } from '../db.js';
import { isDbConfigured } from '../config.js';

const router = Router();

router.use('/auth', authRoutes);

router.get('/health', async (_req, res) => {
  const payload = { status: 'ok', database: { configured: isDbConfigured() } };
  if (isDbConfigured()) {
    try {
      payload.database = { ...payload.database, ...(await pingDb()) };
    } catch (error) {
      payload.database.connected = false;
      payload.database.error = error.message;
    }
  }
  res.json(payload);
});

router.get('/recent_work', (_req, res) => {
  res.json([
    { work: 'Viewed Dashboard', datetime: new Date().toISOString() },
    {
      work: 'Opened Reports',
      datetime: new Date(Date.now() - 3600000).toISOString(),
    },
  ]);
});

router.get('/alerts', (_req, res) => {
  res.json([
    {
      alertId: 1,
      title: 'Welcome',
      message: 'Zafira API is running.',
      datetime: new Date().toISOString(),
    },
  ]);
});

router.use('/internal-user/sopf', sopfRoutes);
router.use('/internal-user/vc', vcRoutes);
router.use('/internal-user/coa', coaRoutes);
router.use('/internal-user/tc-estimates', tcEstimateRoutes);
router.use('/internal-user/fleet', fleetRoutes);
router.use('/internal-user/period-contracts', periodContractRoutes);
router.use('/internal-user/todo-list', todoListRoutes);
router.use('/internal-user/combined-soa-payable', combinedSoaPayableRoutes);
router.use('/internal-user/generic-finances', genericFinancesRoutes);
router.use('/internal-user/masters', mastersRoutes);
router.use('/internal-user/reports', reportsRoutes);

export default router;
