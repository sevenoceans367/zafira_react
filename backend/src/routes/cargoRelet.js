import { Router } from 'express';
import {
  createCargoRelet,
  deleteCargoRelet,
  getCargoRelet,
  listCargoRelets,
  updateCargoRelet,
} from '../services/coaService.js';

const router = Router();

function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({
        message: error.message || 'Cargo relet request failed.',
      });
    }
  };
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(await listCargoRelets({
    selBType: req.query.selBType,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
    search: req.query.search || '',
    coaId: req.query.coaId || '',
    status: req.query.status || '',
    view: req.query.view || 'business',
    standaloneOnly: req.query.standaloneOnly === '1' || req.query.standaloneOnly === 'true',
  }));
}));

router.get('/:fcaId', asyncHandler(async (req, res) => {
  const data = await getCargoRelet(req.params.fcaId);
  if (!data) return res.status(404).json({ message: 'Cargo relet not found.' });
  return res.json(data);
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = { ...(req.body || {}), standalone: true };
  res.json(await createCargoRelet(body));
}));

router.put('/:fcaId', asyncHandler(async (req, res) => {
  const body = { ...(req.body || {}), standalone: true };
  res.json(await updateCargoRelet(req.params.fcaId, body));
}));

router.delete('/:fcaId', asyncHandler(async (req, res) => {
  res.json(await deleteCargoRelet(req.params.fcaId));
}));

export default router;
