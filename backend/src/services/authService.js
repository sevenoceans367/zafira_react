import crypto from 'crypto';
import { appContext } from '../config.js';
import { dbAuthenticateUser, isAuthDbAvailable } from './authDb.js';

const sessions = new Map();

function createToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    user,
    createdAt: Date.now(),
  });
  return token;
}

export function getSessionUser(token) {
  if (!token) return null;
  return sessions.get(token)?.user ?? null;
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
  return { token, user };
}

export function logoutUser(token) {
  if (token) sessions.delete(token);
  return { ok: true };
}
