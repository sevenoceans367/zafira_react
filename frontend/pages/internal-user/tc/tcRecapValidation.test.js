import assert from 'node:assert/strict';
import { getTcAddRowBlockMessage, validateTcRecapForm } from './tcRecapValidation.js';

assert.deepEqual(
  validateTcRecapForm({}),
  { message: 'Please select Vessel', fieldId: 'vesselName' },
);

const base = {
  vesselImoId: '12',
  tcNo: 'TC-1',
  deliveryBunkers: [],
  redeliveryBunkers: [],
  charterer: '9',
  charteringTeam: '6',
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
  validateTcRecapForm({ ...base, charterer: '' }),
  { message: 'Please select Charterers', fieldId: 'charterer' },
);
assert.deepEqual(
  validateTcRecapForm({ ...base, hirePeriods: [{ delDate: '', reDelDate: '31-01-2026', hireRate: '12000' }] }),
  { message: 'Please fill Delivery Date', fieldId: 'hireDelDate_0' },
);
assert.deepEqual(
  validateTcRecapForm({
    ...base,
    hirePeriods: [{ delDate: '01-01-1970 00:00', reDelDate: '31-01-2026', hireRate: '12000' }],
  }),
  { message: 'Please fill Delivery Date', fieldId: 'hireDelDate_0' },
);
assert.deepEqual(
  validateTcRecapForm({ ...base, broCommPayable: '' }),
  { message: 'Please select Brokerage Paid By', fieldId: 'broCommPayable' },
);
assert.deepEqual(
  validateTcRecapForm({ ...base, ilohcUsd: '' }),
  { message: 'Please fill ILOHC', fieldId: 'ilohcUsd' },
);

// TC In / sub-charter (updatetcestimatecal.php)
assert.deepEqual(
  validateTcRecapForm({
    ...base,
    contractType: 'tcinout',
    tcInExpenses: { hires: [{ deliveryDate: '', redeliveryDate: '', cveMonth: '' }] },
  }),
  { message: 'Please fill TC In Date of Delivery', fieldId: 'tcInDeliveryDate_0' },
);
assert.deepEqual(
  validateTcRecapForm({
    ...base,
    periodId: '44',
    tcInExpenses: {
      hires: [{
        deliveryDate: '01-01-2026 00:00',
        redeliveryDate: '',
        cveMonth: '',
      }],
    },
  }),
  { message: 'Please fill TC In Date of Re-Delivery', fieldId: 'tcInRedeliveryDate_0' },
);
assert.equal(
  validateTcRecapForm({
    ...base,
    contractType: 'tcinout',
    tcInExpenses: {
      hires: [{
        deliveryDate: '01-01-2026 00:00',
        redeliveryDate: '10-01-2026 00:00',
        cveMonth: '',
      }],
    },
  }),
  null,
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
  getTcAddRowBlockMessage('hirePeriods', [{ delDate: '01-01-2026', reDelDate: '', hireRate: '1000' }]),
  'Please fill previous data',
);
assert.equal(
  getTcAddRowBlockMessage('hirePeriods', [{
    delDate: '01-01-2026', reDelDate: '10-01-2026', hireRate: '1000',
  }]),
  null,
);
assert.equal(
  getTcAddRowBlockMessage('otherExpenses', [{ expenseTypeId: '1', amount: '' }]),
  'Please fill previous data',
);
assert.equal(
  getTcAddRowBlockMessage('otherExpenses', [{ expenseTypeId: '1', amount: '50' }]),
  null,
);
assert.equal(
  getTcAddRowBlockMessage('otherIncome', [{ description: 'Rebate', amount: '' }]),
  'Please fill previous data',
);

console.log('tcRecapValidation ok');
