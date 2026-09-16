import { Router } from 'express';
import { getRequestUser } from '../services/authService.js';
import {
  dbGetAgentDashboard,
  dbGetAgentPortCost,
  dbSaveAgentPortCost,
} from '../services/agentPortalDb.js';
import {
  dbGetAgentSof,
  dbSaveAgentSof,
  dbSaveAgentPreArrival,
} from '../services/agentSofDb.js';
import { mapUploadedFiles, ticketUpload } from '../utils/ticketAttachments.js';

const router = Router();

function requireAgent(req, res) {
  const user = getRequestUser(req);
  if (!user?.id) {
    res.status(401).json({ message: 'Not authenticated.' });
    return null;
  }
  if (user.userType !== 'agent') {
    res.status(403).json({ message: 'Agent access required.' });
    return null;
  }
  return user;
}

function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(error.status || 500).json({
        message: error.message || 'Agent request failed.',
      });
    }
  };
}

router.get('/dashboard', asyncHandler(async (req, res) => {
  const user = requireAgent(req, res);
  if (!user) return;
  res.json(await dbGetAgentDashboard(user));
}));

router.get('/port-cost', asyncHandler(async (req, res) => {
  const user = requireAgent(req, res);
  if (!user) return;
  const mode = String(req.query.mode || 'pda').toLowerCase() === 'fda' ? 'fda' : 'pda';
  res.json(await dbGetAgentPortCost(user, mode));
}));

router.post('/port-cost', asyncHandler(async (req, res) => {
  const user = requireAgent(req, res);
  if (!user) return;
  res.json(await dbSaveAgentPortCost(user, req.body || {}));
}));

router.get('/sof', asyncHandler(async (req, res) => {
  const user = requireAgent(req, res);
  if (!user) return;
  res.json(await dbGetAgentSof(user));
}));

router.post('/sof/pre-arrival', asyncHandler(async (req, res) => {
  const user = requireAgent(req, res);
  if (!user) return;
  res.json(await dbSaveAgentPreArrival(user, req.body || {}));
}));

router.post('/sof', (req, res, next) => {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) {
    next();
    return;
  }
  ticketUpload(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  const user = requireAgent(req, res);
  if (!user) return;
  const body = req.body?.payload ? JSON.parse(req.body.payload) : (req.body || {});
  const keepFiles = Array.isArray(body.keepFiles)
    ? body.keepFiles.map(String).filter(Boolean)
    : [];
  const { attachment } = mapUploadedFiles(req.files || []);
  const newFiles = attachment
    ? attachment.split(',').map((part) => part.trim()).filter(Boolean)
    : [];
  res.json(await dbSaveAgentSof(user, {
    ...body,
    keepFiles: newFiles.length ? [...keepFiles, ...newFiles] : keepFiles,
  }));
}));

export default router;
