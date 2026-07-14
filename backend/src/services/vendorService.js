import { isDbConfigured } from '../config.js';
import {
  dbCreateVendor,
  dbGetVendor,
  dbGetVendorLookups,
  dbListVendors,
  dbUpdateVendor,
} from './vendorDb.js';

const MOCK = [
  {
    id: 1,
    index: 1,
    vendorTypeId: '1',
    vendorTypeName: 'Agent',
    name: 'DEMO VENDOR',
    shortName: 'DEMO',
    code: 'AG0001',
    vatNumber: '',
    street1: '',
    street2: '',
    city: '',
    country: '',
    postalCode: '',
    phone: '',
    fax: '',
    email: '',
    bankingDetails: '',
    footerDetails: '',
    accountNos: '123',
    slaveAddress: 'Addr',
    ibanNos: 'IBAN',
    status: 1,
    bankRows: [],
  },
];

export async function getVendorLookups() {
  if (!isDbConfigured()) {
    return { vendorTypes: [{ id: '1', name: 'Agent', prefix: 'AG' }] };
  }
  return dbGetVendorLookups();
}

export async function listVendors() {
  if (!isDbConfigured()) return { records: MOCK, recordsTotal: MOCK.length };
  return dbListVendors();
}

export async function getVendor(id) {
  if (!isDbConfigured()) return MOCK.find((r) => String(r.id) === String(id)) ?? null;
  return dbGetVendor(id);
}

export async function createVendor(payload) {
  if (!isDbConfigured()) return { msg: 0, id: 1 };
  return dbCreateVendor(payload);
}

export async function updateVendor(id, payload) {
  if (!isDbConfigured()) return { msg: 0 };
  return dbUpdateVendor(id, payload);
}
