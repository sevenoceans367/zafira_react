import crypto from 'crypto';
import { appContext } from '../config.js';
import { dbAuthenticateUser, isAuthDbAvailable } from './authDb.js';

const sessions = new Map();

/** Idle session lifetime — 30 minutes (matches frontend). */
const SESSION_TTL_MS = 30 * 60 * 1000;

function createToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, {
    user,
    createdAt: now,
    lastActiveAt: now,
  });
  return token;
}

function isSessionExpired(session) {
  if (!session) return true;
  const lastActive = session.lastActiveAt ?? session.createdAt ?? 0;
  return Date.now() - lastActive >= SESSION_TTL_MS;
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
  return { ok: true };
}
