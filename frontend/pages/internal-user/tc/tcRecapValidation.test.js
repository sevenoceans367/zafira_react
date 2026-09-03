import assert from 'node:assert/strict';
import { getTcAddRowBlockMessage, validateTcRecapForm } from './tcRecapValidation.js';

assert.deepEqual(
  validateTcRecapForm({}),
  { message: 'Please select Vessel', fieldId: 'vesselName' },
);

const base = {
  vesselImoId: '12',
  tcNo: 'TC-1',
  deliveryBunkers: [{ bunkerId: '1', qty: '10', bunkerDate: '01-01-2026', price: '100' }],
  redeliveryBunkers: [{ bunkerId: '1', qty: '8', bunkerDate: '15-01-2026', price: '110' }],
  charterer: '9',
  charteringTeam: '7',
  charteringPic1: '3',
  delRangePort: 'Singapore',
  hirePeriods: [{ delDate: '01-01-2026 00:00', reDelDate: '31-01-2026 00:00', hireRate: '12000' }],
  laycanFrom: '01-01-2026 00:00',
  laycanTo: '05-01-2026 00:00',
  reDelRange: 'Mundra',
  exchangeCurrency: 'USD',
  ilohcUsd: '5000',
  broCommPayable: '1',
};

assert.equal(validateTcRecapForm(base), null);

assert.deepEqual(
  validateTcRecapForm({ ...base, tcNo: '' }),
  { message: 'Please fill TC No.', fieldId: 'tcNo' },
);
assert.deepEqual(
  validateTcRecapForm({
    ...base,
    deliveryBunkers: [{ bunkerId: '', qty: '10', bunkerDate: '01-01-2026', price: '100' }],
  }),
  { message: 'Please select Delivery Bunker Grade', fieldId: 'delBunker_0' },
);
assert.deepEqual(
  validateTcRecapForm({ ...base, charterer: '' }),
  { message: 'Please select Charterers', fieldId: 'charterer' },
);
assert.deepEqual(
  validateTcRecapForm({ ...base, hirePeriods: [{ delDate: '', reDelDate: '31-01-2026', hireRate: '12000' }] }),
  { message: 'Please fill Delivery Date', fieldId: 'hireDelDate_0' },
);
assert.deepEqual(
  validateTcRecapForm({ ...base, broCommPayable: '' }),
  { message: 'Please select Brokerage Paid By', fieldId: 'broCommPayable' },
);

assert.equal(
  getTcAddRowBlockMessage('deliveryBunkers', [{ bunkerId: '', qty: '', bunkerDate: '', price: '' }]),
  'Please fill previous data',
);
assert.equal(
  getTcAddRowBlockMessage('deliveryBunkers', [{
    bunkerId: '1', qty: '10', bunkerDate: '01-01-2026', price: '100',
  }]),
  null,
);
assert.equal(
  getTcAddRowBlockMessage('otherExpenses', [{ expenseTypeId: '1', amount: '' }]),
  'Please fill previous data',
);
assert.equal(
  getTcAddRowBlockMessage('otherExpenses', [{ description: 'Agency', amount: '50' }]),
  null,
);

console.log('tcRecapValidation ok');
