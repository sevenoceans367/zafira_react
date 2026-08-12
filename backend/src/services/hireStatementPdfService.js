import PDFDocument from 'pdfkit';
import { dbGetHireStatementForPdf } from './hireStatementDb.js';

const BLUE = '#3c8dbc';
const TEXT = '#24313A';
const MUTED = '#5b6b75';

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function days(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00000';
  return n.toFixed(5);
}

function safeFilename(input) {
  return String(input || 'Hire-Statement').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function createDocument(title) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    info: { Title: title, Author: 'Zafira' },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  return { doc, chunks };
}

function finish(doc, chunks) {
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function line(doc, label, value, opts = {}) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, left, y, { width: width * 0.42, continued: false });
  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(TEXT)
    .text(value == null || value === '' ? '-' : String(value), left + width * 0.42, y, {
      width: width * 0.58,
      align: opts.align || 'left',
    });
  doc.moveDown(0.35);
}

export async function generateHireStatementPdf(invoiceId) {
  const data = await dbGetHireStatementForPdf(invoiceId);
  const title = `Hire Statement ${data.invoiceNo || data.invoiceId}`;
  const { doc, chunks } = createDocument(title);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(BLUE).text('HIRE STATEMENT', { align: 'center' });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).fillColor(TEXT)
    .text(`${data.invoiceType || ''} — ${data.invoiceNo || ''}`.trim(), { align: 'center' });
  doc.moveDown(1);

  line(doc, 'Statement No', data.invoiceNo);
  line(doc, 'Statement Type', data.invoiceType);
  line(doc, 'Date', data.invoiceDate);
  line(doc, 'Invoicing Company', data.ownerName);
  line(doc, 'Vendor / Owner', data.vendorName);
  if (data.vendorAddress) line(doc, 'Vendor Address', data.vendorAddress);
  line(doc, 'Fixture / Voyage', data.voyageNo || data.nomMessage);
  line(doc, 'Vessel', data.vesselName);
  line(doc, 'Currency', data.currency);
  line(doc, 'Payment Terms', data.paymentTerms);
  line(doc, 'Hire From', data.hireFrom);
  line(doc, 'Hire To', data.hireTo);
  doc.moveDown(0.6);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text('Hire Days');
  doc.moveDown(0.4);
  for (const row of data.hireDayRows || []) {
    line(
      doc,
      `${row.hireFrom || '-'} → ${row.hireTo || '-'}`,
      `${days(row.utilisedDays)} days × ${money(row.hireAmt)}`,
      { align: 'right' },
    );
  }
  line(doc, 'Daily Hire Rate', money(data.dailyHireRate), { align: 'right' });
  line(doc, 'Hire Days', days(data.hireDays), { align: 'right' });
  line(doc, 'Gross Hire', money(data.hireAmt), { align: 'right' });
  line(doc, `CVE (${money(data.cve)})`, money(data.cveAmt), { align: 'right' });
  line(doc, `Address Commission (${money(data.addCommPer)}%)`, money(data.addCommAmt), { align: 'right' });
  line(doc, `Broker Commission (${money(data.broCommPer)}%)`, money(data.broCommAmt), { align: 'right' });

  for (const row of data.adjAddRows || []) {
    line(doc, `Add Adj: ${row.description || 'Addition'}`, money(row.amount), { align: 'right' });
  }
  for (const row of data.addRows || []) {
    line(doc, `Add: ${row.description || 'Addition'}`, money(row.amount), { align: 'right' });
  }
  for (const row of data.holdRows || []) {
    line(doc, `Hold Cleaning: ${row.description || ''}`, money(row.amount), { align: 'right' });
  }
  for (const row of data.surveyRows || []) {
    line(doc, `Hire Survey: ${row.description || ''}`, money(row.amount), { align: 'right' });
  }
  for (const row of data.adjSubRows || []) {
    line(doc, `Less Adj: ${row.description || 'Deduction'}`, money(row.amount), { align: 'right' });
  }
  for (const row of data.subRows || []) {
    line(doc, `Less: ${row.description || 'Deduction'}`, money(row.amount), { align: 'right' });
  }
  if (Number(data.offhireDays) > 0 || Number(data.offhireAmt) > 0) {
    line(doc, `Off-hire (${days(data.offhireDays)} days)`, money(data.offhireAmt), { align: 'right' });
  }
  line(doc, 'Final Amount', money(data.finalAmt), { align: 'right', bold: true });
  line(doc, 'Balance to Owner', money(data.balanceToOwner), { align: 'right', bold: true });

  if (data.description) {
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text('Description');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(data.description);
  }

  const buffer = await finish(doc, chunks);
  const filename = `${safeFilename(data.invoiceNo || `Hire-Statement-${data.invoiceId}`)}.pdf`;
  return { buffer, filename };
}
