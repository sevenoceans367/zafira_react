import { isDbConfigured } from '../config.js';
import {
  dbCreateAccountingLedger,
  dbGetAccountingLedger,
  dbGetAccountingLedgerLookups,
  dbListAccountingLedgers,
  dbUpdateAccountingLedger,
  dbUpdateAccountingLedgerStatus,
} from './accountingLedgerDb.js';

const MOCK = [
  {
    id: 1,
    index: 1,
    name: 'Freight Income',
    groupId: '1',
    groupName: 'Income',
    code: '4100',
    status: 1,
    isActive: true,
  },
];

export async function getAccountingLedgerLookups() {
  if (!isDbConfigured()) return { groups: [{ id: '1', name: 'Income' }] };
  return dbGetAccountingLedgerLookups();
}

export async function listAccountingLedgers() {
  if (!isDbConfigured()) return { records: MOCK, recordsTotal: MOCK.length };
  return dbListAccountingLedgers();
}

export async function getAccountingLedger(id) {
  if (!isDbConfigured()) return MOCK.find((r) => String(r.id) === String(id)) ?? null;
  return dbGetAccountingLedger(id);
}

export async function createAccountingLedger(payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbCreateAccountingLedger(payload);
}

export async function updateAccountingLedger(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateAccountingLedger(id, payload);
}

export async function updateAccountingLedgerStatus(id, status) {
  if (!isDbConfigured()) return { msg: 2, status: Number(status) === 1 ? 2 : 1 };
  return dbUpdateAccountingLedgerStatus(id, status);
}
