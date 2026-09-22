import { Router } from 'express';
import { fetchDeclaredVoyageRoute } from '../services/liveVesselMapRouteService.js';
import { fetchFleetOverlay } from '../services/liveVesselMapFleetService.js';
import { fetchVesselLastPosition } from '../services/vesselPositionService.js';

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

/** Search / zoom to last AIS position by IMO, MMSI, or vessel name. */
router.get('/last-position', async (req, res) => {
  try {
    const data = await fetchVesselLastPosition({
      imo: req.query.imo || '',
      mmsi: req.query.mmsi || '',
      name: req.query.name || '',
      q: req.query.q || req.query.query || '',
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Failed to load vessel last position.',
    });
  }
});

/** Our performing fleet (Zafira in-ops) with AIS last positions. */
router.get('/fleet-overlay', async (_req, res) => {
  try {
    const data = await fetchFleetOverlay();
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Failed to load fleet overlay.',
    });
  }
});

export default router;
