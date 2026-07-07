import { Router } from 'express';
import sopfRoutes from './sopf.js';
import { pingDb } from '../db.js';
import { isDbConfigured } from '../config.js';

const router = Router();

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

export default router;
