import { Router } from 'express';
import { fetchDeclaredVoyageRoute } from '../services/liveVesselMapRouteService.js';

/** Isolated Live Vessel Map routes — remove with frontend/pages/internal-user/live-vessel-map. */
const router = Router();

router.get('/route', async (req, res) => {
  try {
    const data = await fetchDeclaredVoyageRoute({
      origin: req.query.from || req.query.origin,
      destination: req.query.to || req.query.destination,
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Failed to load vessel route.',
    });
  }
});

export default router;
