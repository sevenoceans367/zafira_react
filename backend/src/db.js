import mysql from 'mysql2/promise';
import { dbConfig, isDbConfigured } from './config.js';

let pool = null;

export function getPool() {
  if (!isDbConfigured()) {
    return null;
  }

  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  return pool;
}

export async function pingDb() {
  const activePool = getPool();
  if (!activePool) {
    return {
      connected: false,
      reason: 'not_configured',
      message: 'Set DB_HOST, DB_NAME, DB_USER (and DB_PASSWORD) in backend/.env',
    };
  }

  const connection = await activePool.getConnection();
  try {
    await connection.query('SELECT 1 AS ok');
    return {
      connected: true,
      host: dbConfig.host,
      database: dbConfig.database,
    };
  } finally {
    connection.release();
  }
}
