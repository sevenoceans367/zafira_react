import PDFDocument from 'pdfkit';
import { dbGetRequestPortCostForPdf } from './requestPortCostDb.js';

const BLUE = '#3c8dbc';
const TEXT = '#24313A';
const MUTED = '#5b6b75';

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function safeFilename(input) {
  return String(input || 'Operational-Cost-Payment').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
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

export async function generateRequestPortCostPdf(reqId) {
  const data = await dbGetRequestPortCostForPdf(reqId);
  const title = `Payment ${data.paymentNo || data.reqId}`;
  const { doc, chunks } = createDocument(title);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(BLUE).text('OPERATIONAL COST PAYMENT', { align: 'center' });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).fillColor(TEXT)
    .text(`${data.costName || ''} — ${data.costDesc || ''}`.trim(), { align: 'center' });
  doc.moveDown(1);

  line(doc, 'Payment No', data.paymentNo);
  line(doc, 'Account Type', data.accountType);
  line(doc, 'Date', data.date);
  line(doc, 'Invoice Date', data.invoiceDate);
  line(doc, 'CP Date', data.cpDate);
  line(doc, 'Vendor', data.vendorName);
  if (data.vendorAddress) line(doc, 'Vendor Address', data.vendorAddress);
  line(doc, 'Fixture / Voyage', data.voyageNo || data.nomMessage);
  line(doc, 'Vessel', data.vesselName);
  line(doc, 'Currency', data.currency);
  doc.moveDown(0.6);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text('Amounts');
  doc.moveDown(0.4);
  line(doc, 'Vendor Invoice Amount', money(data.invoiceAmt), { align: 'right' });
  line(doc, 'Total Outstanding', money(data.outstanding), { align: 'right' });
  line(doc, 'Balance Outstanding', money(data.balance), { align: 'right' });
  for (const row of data.addRows || []) {
    line(doc, `Add: ${row.description || 'Addition'}`, money(row.amount), { align: 'right' });
  }
  for (const row of data.subRows || []) {
    line(doc, `Less: ${row.description || 'Deduction'}`, money(row.amount), { align: 'right' });
  }
  line(doc, 'Net Payable', money(data.netAmt), { align: 'right', bold: true });
  line(doc, 'Requested To Pay', money(data.requestedToPay), { align: 'right', bold: true });

  if (data.remarks) {
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text('Remarks');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(data.remarks);
  }

  const buffer = await finish(doc, chunks);
  const filename = `${safeFilename(data.paymentNo || `Payment-${data.reqId}`)}.pdf`;
  return { buffer, filename };
}
