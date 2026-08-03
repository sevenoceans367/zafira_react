import { isDbConfigured } from '../config.js';
import {
  dbCreateElibraryReference,
  dbDeleteElibraryReference,
  dbGetElibraryReference,
  dbListElibraryLookups,
  dbListElibraryReferences,
  dbUpdateElibraryReference,
} from './elibraryDb.js';

const MOCK_LOOKUPS = {
  categories: [
    { id: '1', name: 'Contracts' },
    { id: '2', name: 'Circulars' },
  ],
  referenceTypes: [
    { id: '1', name: 'PDF' },
    { id: '2', name: 'Word' },
  ],
};

const MOCK_RECORDS = [
  {
    id: 1,
    index: 1,
    categoryId: '1',
    categoryName: 'Contracts',
    referenceTypeId: '1',
    referenceTypeName: 'PDF',
    date: '03 Aug 2026',
    dateInput: '2026-08-03',
    name: 'Sample Charter Party',
    description: 'Demo E-Library reference',
    source: 'Internal',
    upload: '',
    uploadName: '',
    attachments: [],
  },
];

export async function listElibraryLookups() {
  if (!isDbConfigured()) return MOCK_LOOKUPS;
  return dbListElibraryLookups();
}

export async function listElibraryReferences(filters = {}) {
  if (!isDbConfigured()) {
    let rows = MOCK_RECORDS;
    if (filters.categoryId) {
      rows = rows.filter((row) => row.categoryId === String(filters.categoryId));
    }
    if (filters.referenceTypeId) {
      rows = rows.filter((row) => row.referenceTypeId === String(filters.referenceTypeId));
    }
    if (filters.name) {
      const q = String(filters.name).toLowerCase();
      rows = rows.filter((row) => row.name.toLowerCase().includes(q));
    }
    return { records: rows, recordsTotal: rows.length };
  }
  return dbListElibraryReferences(filters);
}

export async function getElibraryReference(id) {
  if (!isDbConfigured()) {
    return MOCK_RECORDS.find((row) => String(row.id) === String(id)) ?? null;
  }
  return dbGetElibraryReference(id);
}

export async function createElibraryReference(payload, attachments = {}) {
  if (!isDbConfigured()) return { msg: 0, id: 99 };
  return dbCreateElibraryReference(payload, attachments);
}

export async function updateElibraryReference(id, payload, attachments = {}) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateElibraryReference(id, payload, attachments);
}

export async function deleteElibraryReference(id) {
  if (!isDbConfigured()) return { msg: 3 };
  return dbDeleteElibraryReference(id);
}
