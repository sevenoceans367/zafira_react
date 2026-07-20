import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetAgencyLetterMockForTests,
  deleteAgencyLetter,
  getAgencyLetterForm,
  saveAgencyLetter,
} from './agencyLetterService.js';

describe('agencyLetterService mock lifecycle', () => {
  beforeEach(() => {
    __resetAgencyLetterMockForTests();
  });

  it('loads agency letter form ports for a voyage', async () => {
    const data = await getAgencyLetterForm(1001);
    assert.equal(data.ports.length, 1);
    assert.equal(data.ports[0].portType, 'LP');
    assert.equal(data.nomId, '26-001');
  });

  it('saves and closes an agency letter', async () => {
    const saved = await saveAgencyLetter({
      comId: 1001,
      portType: 'LP',
      portId: '10',
      randomId: '101',
      vendorId: 'AG001',
      submitId: 2,
      date: '15-01-2026',
      qty: '50000',
      countryId: '1',
      username: 'ZAF/001/101',
      password: 'secret',
      etaDate1: '18-01-2026 08:00',
      cargoDetails: 'Coal',
      entities: [{ entity: '2', name: 'Ops Desk', email: 'agent@example.com' }],
      bunkers: [{ bunkerPort: '10', grade: 'HSFO', supplier: 'Shell', physical: 'Physical', quantity: '100' }],
    });
    assert.equal(saved.msg, 0);
    assert.equal(saved.submitId, 2);

    const data = await getAgencyLetterForm(1001);
    assert.equal(data.ports[0].locked, true);
    assert.equal(data.ports[0].records.length, 1);
  });

  it('deletes an agency letter record', async () => {
    const saved = await saveAgencyLetter({
      comId: 1001,
      portType: 'LP',
      portId: '10',
      randomId: '101',
      vendorId: 'AG001',
      submitId: 1,
      countryId: '1',
      etaDate1: '18-01-2026 08:00',
      username: 'ZAF/001/101',
    });
    const result = await deleteAgencyLetter(saved.genAgencyId);
    assert.equal(result.msg, 0);
    const data = await getAgencyLetterForm(1001);
    assert.equal(data.ports[0].records.length, 0);
  });
});
