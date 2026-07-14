import { isDbConfigured } from '../config.js';
import {
  dbCreateTerminal,
  dbGetTerminal,
  dbListTerminals,
  dbUpdateTerminal,
  dbUpdateTerminalStatus,
} from './terminalDb.js';

const MOCK = [
  {
    id: 1,
    index: 1,
    name: 'Demo Terminal',
    portCode: 'SGSIN',
    portName: 'Singapore(SGSIN)',
    description: 'Sample',
    status: 1,
    isActive: true,
  },
];

export async function listTerminals() {
  if (!isDbConfigured()) return { records: MOCK, recordsTotal: MOCK.length };
  return dbListTerminals();
}

export async function getTerminal(id) {
  if (!isDbConfigured()) return MOCK.find((r) => String(r.id) === String(id)) ?? null;
  return dbGetTerminal(id);
}

export async function createTerminal(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateTerminal(payload);
}

export async function updateTerminal(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateTerminal(id, payload);
}

export async function updateTerminalStatus(id, status) {
  if (!isDbConfigured()) return { msg: 2, status: Number(status) === 1 ? 2 : 1 };
  return dbUpdateTerminalStatus(id, status);
}
