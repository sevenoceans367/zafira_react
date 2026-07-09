import { Router } from 'express';
import { loginUser, logoutUser } from '../services/authService.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    const result = await loginUser(username, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message || 'Login failed.' });
  }
});

router.post('/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.body?.token;
  logoutUser(token);
  res.json({ ok: true });
});

export default router;
