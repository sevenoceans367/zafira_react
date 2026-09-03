import { Router } from 'express';
import authRoutes from './auth.js';
import sopfRoutes from './sopf.js';
import vcRoutes from './vc.js';
import coaRoutes from './coa.js';
import tcEstimateRoutes from './tcEstimates.js';
import fleetRoutes from './fleet.js';
import periodContractRoutes from './periodContract.js';
import cargoReletRoutes from './cargoRelet.js';
import todoListRoutes from './todoList.js';
import combinedSoaPayableRoutes from './combinedSoaPayable.js';
import genericFinancesRoutes from './genericFinances.js';
import mastersRoutes from './masters.js';
import reportsRoutes from './reports.js';
import elibraryRoutes from './elibrary.js';
import liveVesselMapRoutes from './liveVesselMap.js';
import { pingDb } from '../db.js';
import { isDbConfigured } from '../config.js';
import { getRequestUser } from '../services/authService.js';
import {
  dbDismissUserAlert,
  dbListRecentWork,
  dbListUserAlerts,
} from '../services/userAlertsDb.js';

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

router.get('/recent_work', async (req, res) => {
  try {
    const user = getRequestUser(req);
    if (!user?.id) {
      res.status(401).json({ message: 'Not authenticated.' });
      return;
    }
    res.json(await dbListRecentWork(user.id));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to load recent activity.' });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const user = getRequestUser(req);
    if (!user?.id) {
      res.status(401).json({ message: 'Not authenticated.' });
      return;
    }
    res.json(await dbListUserAlerts(user.id));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to load notifications.' });
  }
});

router.post('/alerts/:alertId/read', async (req, res) => {
  try {
    const user = getRequestUser(req);
    res.json(await dbDismissUserAlert(user?.id, req.params.alertId));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to dismiss notification.' });
  }
});

router.use('/internal-user/sopf', sopfRoutes);
router.use('/internal-user/vc', vcRoutes);
router.use('/internal-user/coa', coaRoutes);
router.use('/internal-user/tc-estimates', tcEstimateRoutes);
router.use('/internal-user/fleet', fleetRoutes);
router.use('/internal-user/period-contracts', periodContractRoutes);
router.use('/internal-user/cargo-relets', cargoReletRoutes);
router.use('/internal-user/todo-list', todoListRoutes);
router.use('/internal-user/combined-soa-payable', combinedSoaPayableRoutes);
router.use('/internal-user/generic-finances', genericFinancesRoutes);
router.use('/internal-user/masters', mastersRoutes);
router.use('/internal-user/reports', reportsRoutes);
router.use('/internal-user/elibrary', elibraryRoutes);
router.use('/internal-user/live-vessels', liveVesselMapRoutes);

export default router;
