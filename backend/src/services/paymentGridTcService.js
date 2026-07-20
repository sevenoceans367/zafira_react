import { isDbConfigured } from '../config.js';
import { dbGetPaymentGridTc } from './paymentGridTcDb.js';

const MOCK_GRID = {
  comId: '1001',
  tcOutId: '5001',
  tcNo: '25001',
  vesselName: 'ATLANTIC STAR',
  trips: [
    {
      tripIndex: 1,
      slave1Id: '101',
      randomId: '9001',
      periodLabel: 'Trip/Period 1 (01-01-2026 08:00 To 31-01-2026 18:00)',
      lines: [
        {
          key: 'hire-income-101',
          name: 'Hire Income',
          description: 'Hire Invoice',
          vendorId: 'CH001',
          vendorName: 'Ocean Charterers',
          totalPaid: '150000',
          lastPaidDate: '15-01-2026',
          actions: [
            {
              key: 'hireInvoice',
              label: 'Hire Invoice',
              variant: 'info',
              enabled: true,
              migrated: false,
              randomId: '9001',
              vendorId: 'CH001',
            },
          ],
        },
        {
          key: 'add-comm-101',
          name: 'Address Commission',
          description: 'Add Comm(1.25%)',
          vendorId: 'BR001',
          vendorName: 'Broker Co',
          totalPaid: '1875',
          lastPaidDate: '16-01-2026',
          actions: [
            {
              key: 'otherInvoice',
              label: 'Add Comm Invoice',
              variant: 'info',
              enabled: true,
              migrated: false,
              randomId: '9001',
              vendorId: 'BR001',
              amount: '1875',
              desc: 'Add Comm(1.25%)',
              invType: 'Address Commission Invoice',
            },
          ],
        },
        {
          key: 'hire-expense-101',
          name: 'Hire Expense',
          description: 'Hireage Invoice',
          vendorId: 'OWN1',
          vendorName: 'Ocean Owners',
          totalPaid: '',
          lastPaidDate: '',
          actions: [
            {
              key: 'hireStatement',
              label: 'Hire Statement',
              variant: 'danger',
              enabled: true,
              migrated: false,
              randomId: '9001',
              vendorId: 'OWN1',
            },
          ],
        },
      ],
    },
  ],
};

export async function getPaymentGridTc(comId) {
  if (isDbConfigured()) return dbGetPaymentGridTc(comId);
  if (String(comId) !== String(MOCK_GRID.comId)) {
    const error = new Error('TC nomination not found.');
    error.status = 404;
    throw error;
  }
  return structuredClone(MOCK_GRID);
}
