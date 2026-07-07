import { Router } from 'express';
import {
  deleteEstimate,
  getBusinessTypes,
  getCompareEstimates,
  getEstimateList,
  replicateEstimate,
  submitDecisionChart,
} from '../services/estimateListService.js';
import {
  getEstimateDetail,
  updateEstimateDetail,
} from '../services/estimateDetailService.js';

const router = Router();

router.get('/business_types', (req, res) => {
  res.json(getBusinessTypes(req.query.selBType));
});

router.get('/estimate_list', async (req, res) => {
  try {
    const { selBType, estimatetype } = req.query;
    const data = await getEstimateList({ selBType });
    res.json({
      ...data,
      estimatetype: Number(estimatetype) || Number(selBType) || 2,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load estimate list.' });
  }
});

router.get('/estimates/:id', async (req, res) => {
  try {
    const data = await getEstimateDetail(req.params.id);
    if (!data) {
      return res.status(404).json({ message: 'Estimate not found.' });
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load estimate.' });
  }
});

router.put('/estimates/:id', async (req, res) => {
  try {
    const result = await updateEstimateDetail(req.params.id, req.body);
    if (!result) {
      return res.status(404).json({ message: 'Estimate not found.', msg: 1 });
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to update estimate.' });
  }
});

router.delete('/estimate_list/:id', async (req, res) => {
  try {
    const result = await deleteEstimate(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Estimate not found.', msg: 1 });
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to delete estimate.' });
  }
});

router.post('/estimate_list/:id/replicate', async (req, res) => {
  try {
    const result = await replicateEstimate(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Estimate not found.', msg: 1 });
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to replicate estimate.' });
  }
});

router.post('/decision_chart', async (req, res) => {
  try {
    const ids = req.body.ids ?? req.body.chkArr;
    const parsed = Array.isArray(ids) ? ids : String(ids ?? '').split(',').filter(Boolean);
    res.json(await getCompareEstimates(parsed));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to load decision chart.' });
  }
});

router.post('/decision_chart/submit', async (req, res) => {
  try {
    const result = await submitDecisionChart(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/options/31', (_req, res) => {
  res.json({ rows: [] });
});

export default router;
