import { Router } from 'express';
import {
  cancelCoa,
  completeDirectFixture,
  createCargoRelet,
  createCoa,
  createDirectFixture,
  deleteCargoRelet,
  getCargoRelet,
  getCoa,
  getCoaLookups,
  getCoaNominations,
  getDirectFixture,
  listCargoRelets,
  listCoaOpsVoyages,
  listDirectFixtures,
  listRunningCoas,
  moveVoyageToPostOps,
  saveMonthlyRemarks,
  updateCargoRelet,
  updateCoa,
  updateDirectFixture,
} from '../services/coaService.js';

const router = Router();

function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({
        message: error.message || 'COA request failed.',
      });
    }
  };
}

router.get('/lookups', asyncHandler(async (_req, res) => {
  res.json(await getCoaLookups());
}));

router.get('/running', asyncHandler(async (req, res) => {
  res.json(await listRunningCoas({
    selBType: req.query.selBType,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
    search: req.query.search || '',
    status: req.query.status || '1',
  }));
}));

router.get('/running/:coaId', asyncHandler(async (req, res) => {
  const data = await getCoa(req.params.coaId);
  if (!data) return res.status(404).json({ message: 'COA not found.' });
  return res.json(data);
}));

router.post('/running', asyncHandler(async (req, res) => {
  res.json(await createCoa(req.body || {}));
}));

router.put('/running/:coaId', asyncHandler(async (req, res) => {
  res.json(await updateCoa(req.params.coaId, req.body || {}));
}));

router.post('/running/:coaId/cancel', asyncHandler(async (req, res) => {
  res.json(await cancelCoa(req.params.coaId, req.body?.remarks || ''));
}));

router.put('/running/:coaId/monthly-remarks', asyncHandler(async (req, res) => {
  res.json(await saveMonthlyRemarks(req.params.coaId, req.body?.remarks || []));
}));

router.get('/running/:coaId/nominations', asyncHandler(async (req, res) => {
  res.json(await getCoaNominations(req.params.coaId));
}));

router.get('/cargo-relets', asyncHandler(async (req, res) => {
  res.json(await listCargoRelets({
    selBType: req.query.selBType,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
    search: req.query.search || '',
    coaId: req.query.coaId || '',
    status: req.query.status || '',
    view: req.query.view || 'business',
  }));
}));

router.get('/cargo-relets/:fcaId', asyncHandler(async (req, res) => {
  const data = await getCargoRelet(req.params.fcaId);
  if (!data) return res.status(404).json({ message: 'Cargo relet not found.' });
  return res.json(data);
}));

router.post('/cargo-relets', asyncHandler(async (req, res) => {
  res.json(await createCargoRelet(req.body || {}));
}));

router.put('/cargo-relets/:fcaId', asyncHandler(async (req, res) => {
  res.json(await updateCargoRelet(req.params.fcaId, req.body || {}));
}));

router.delete('/cargo-relets/:fcaId', asyncHandler(async (req, res) => {
  res.json(await deleteCargoRelet(req.params.fcaId));
}));

router.get('/ops', asyncHandler(async (req, res) => {
  res.json(await listCoaOpsVoyages({
    selBType: req.query.selBType,
    status: req.query.status || '1',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
    search: req.query.search || '',
    fromDate: req.query.fromDate || '',
    toDate: req.query.toDate || '',
  }));
}));

router.post('/ops/:comId/post-ops', asyncHandler(async (req, res) => {
  res.json(await moveVoyageToPostOps(req.params.comId));
}));

router.get('/direct-fixtures', asyncHandler(async (req, res) => {
  res.json(await listDirectFixtures({
    selBType: req.query.selBType,
    status: req.query.status || '',
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
    search: req.query.search || '',
  }));
}));

router.get('/direct-fixtures/:fcaId', asyncHandler(async (req, res) => {
  const data = await getDirectFixture(req.params.fcaId);
  if (!data) return res.status(404).json({ message: 'Direct fixture not found.' });
  return res.json(data);
}));

router.post('/direct-fixtures', asyncHandler(async (req, res) => {
  res.json(await createDirectFixture(req.body || {}));
}));

router.put('/direct-fixtures/:fcaId', asyncHandler(async (req, res) => {
  res.json(await updateDirectFixture(req.params.fcaId, req.body || {}));
}));

router.post('/direct-fixtures/:fcaId/complete', asyncHandler(async (req, res) => {
  res.json(await completeDirectFixture(req.params.fcaId));
}));

export default router;
