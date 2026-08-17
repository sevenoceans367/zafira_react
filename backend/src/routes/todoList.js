import { Router } from 'express';
import {
  getTodoList,
  holdTodoPayment,
  inactiveTodoAlert,
  searchTodoVoyageByNumber,
  searchTodoVoyagesByVessel,
  unholdTodoPayment,
  updateTodoAlRem,
} from '../services/todoListService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getTodoList({
      tab: req.query.tab || 'hold',
      accountType: req.query.accountType || '',
      search: req.query.search || '',
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load financial transactions.' });
  }
});

router.post('/search-voyage', async (req, res) => {
  try {
    const data = await searchTodoVoyageByNumber({
      voyageNo: req.body.voyageNo || req.body.txtvoyageno,
      voyType: req.body.voyType || req.body.voytype,
      businessType: req.body.businessType || req.body.selBType1,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to search voyage.' });
  }
});

router.post('/search-voyage-by-vessel', async (req, res) => {
  try {
    const data = await searchTodoVoyagesByVessel({
      vesselId: req.body.vesselId || req.body.selVessel,
      voyType: req.body.voyType || req.body.voytype,
      businessType: req.body.businessType || req.body.selBType1,
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to search voyages by vessel.' });
  }
});

router.post('/inactive/:alertId', async (req, res) => {
  try {
    const result = await inactiveTodoAlert(req.params.alertId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to inactive alert.', msg: 1 });
  }
});

router.post('/al-rem', async (req, res) => {
  try {
    const result = await updateTodoAlRem({
      identify: req.body.identify,
      identifyId: req.body.identifyId,
      value: req.body.value,
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to update accruals.', msg: 1 });
  }
});

router.post('/hold', async (req, res) => {
  try {
    const result = await holdTodoPayment({
      identify: req.body.identify,
      identifyId: req.body.identifyId,
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to hold payment.', msg: 1 });
  }
});

router.post('/unhold', async (req, res) => {
  try {
    const result = await unholdTodoPayment({
      identify: req.body.identify,
      identifyId: req.body.identifyId,
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Failed to unhold payment.', msg: 1 });
  }
});

export default router;
