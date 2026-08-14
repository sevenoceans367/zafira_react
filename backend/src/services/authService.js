import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appContext, isMgmtUser } from '../config.js';
import { dbAuthenticateUser, isAuthDbAvailable } from './authDb.js';

const sessions = new Map();

/** Idle session lifetime — 1 hour (matches frontend). */
const SESSION_TTL_MS = 60 * 60 * 1000;

// node --watch restarts wipe in-memory Maps. Keep tokens on disk in dev so a
// code save does not force re-login. Frontend still holds auth_token in localStorage.
const SESSION_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.dev-sessions.json',
);

let persistTimer = null;

function isSessionExpired(session) {
  if (!session) return true;
  const lastActive = session.lastActiveAt ?? session.createdAt ?? 0;
  return Date.now() - lastActive >= SESSION_TTL_MS;
}

function persistSessions() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const entries = [];
    for (const [token, session] of sessions) {
      if (isSessionExpired(session)) continue;
      entries.push({
        token,
        user: session.user,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
      });
    }
    try {
      fs.writeFileSync(SESSION_FILE, JSON.stringify(entries), 'utf8');
    } catch {
      /* ignore disk errors in dev */
    }
  }, 200);
}

function loadSessions() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    if (!Array.isArray(parsed)) return;
    for (const row of parsed) {
      if (!row?.token || !row?.user) continue;
      const session = {
        user: row.user,
        createdAt: Number(row.createdAt) || Date.now(),
        lastActiveAt: Number(row.lastActiveAt) || Date.now(),
      };
      if (!isSessionExpired(session)) sessions.set(String(row.token), session);
    }
  } catch {
    /* first run or missing file */
  }
}

loadSessions();

function createToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, {
    user,
    createdAt: now,
    lastActiveAt: now,
  });
  persistSessions();
  return token;
}

export function getSessionUser(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (isSessionExpired(session)) {
    sessions.delete(token);
    return null;
  }
  session.lastActiveAt = Date.now();
  persistSessions();
  return session.user;
}

export async function loginUser(username, password) {
  if (!username?.trim() || !password) {
    throw new Error('Username and password are required.');
  }

  let user = null;

  if (isAuthDbAvailable()) {
    user = await dbAuthenticateUser(username, password);
  } else {
    const mockUser = process.env.MOCK_LOGIN_USER || 'admin';
    const mockPass = process.env.MOCK_LOGIN_PASSWORD || 'admin';
    if (username.trim() === mockUser && password === mockPass) {
      user = {
        id: Number(appContext.userId) || 1,
        username: mockUser,
        name: appContext.userName || 'Internal User',
        userType: appContext.userType || 'internal_user',
        companyId: Number(appContext.companyId) || 1,
        sopfUser: true,
        rmUser: false,
      };
    }
  }

  if (!user) {
    throw new Error('Invalid username or password.');
  }

  const token = createToken(user);
  return {
    token,
    user,
    expiresInMs: SESSION_TTL_MS,
  };
}

export function logoutUser(token) {
  if (token) sessions.delete(token);
  persistSessions();
  return { ok: true };
}

/** Resolve Bearer token from an Express request. */
export function getRequestToken(req) {
  const header = req?.headers?.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return '';
}

/** Logged-in user for the request, or null. */
export function getRequestUser(req) {
  return getSessionUser(getRequestToken(req));
}

/**
 * PHP: $_SESSION['iutype'] == 'mgmt_user'
 * Prefer the session user from the Authorization token; fall back to env USER_TYPE.
 */
export function resolveRequestIsMgmtUser(req) {
  const user = getRequestUser(req);
  if (user?.userType) return user.userType === 'mgmt_user';
  return isMgmtUser();
}
