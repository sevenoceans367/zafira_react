import PDFDocument from 'pdfkit';
import { dbGetFreightInvoiceForPdf } from './freightInvoiceDb.js';

const BLUE = '#3c8dbc';
const TEXT = '#24313A';
const MUTED = '#5b6b75';

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function safeFilename(input) {
  return String(input || 'Freight-Invoice').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
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

/**
 * Simple pdfkit freight invoice PDF (parity-lite vs allPdf.php?id=27).
 */
export async function generateFreightInvoicePdf(invoiceId) {
  const data = await dbGetFreightInvoiceForPdf(invoiceId);
  const title = `Freight Invoice ${data.invoiceNo || data.invoiceId}`;
  const { doc, chunks } = createDocument(title);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(BLUE).text('FREIGHT INVOICE', { align: 'center' });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).fillColor(TEXT)
    .text(`${data.invType || ''} — ${data.pType || ''}`.trim(), { align: 'center' });
  doc.moveDown(1);

  line(doc, 'Invoice No', data.invoiceNo);
  line(doc, 'Invoice Date', data.invoiceDate);
  line(doc, 'Due Date', data.dueDate);
  line(doc, 'Invoicing Company', data.ownerName);
  line(doc, 'Vendor / Charterer', data.vendorName);
  if (data.vendorAddress) line(doc, 'Vendor Address', data.vendorAddress);
  line(doc, 'Currency', data.currency);
  doc.moveDown(0.6);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text('Amounts');
  doc.moveDown(0.4);
  line(doc, 'Gross Freight', money(data.grossFreight), { align: 'right' });
  for (const row of data.addRows || []) {
    line(doc, `Add: ${row.description || 'Addition'}`, money(row.amount), { align: 'right' });
  }
  for (const row of data.subRows || []) {
    line(doc, `Less: ${row.description || 'Deduction'}`, money(row.amount), { align: 'right' });
  }
  line(doc, 'Brokerage', money(data.brokerage), { align: 'right' });
  line(doc, 'Add. Commission', money(data.addCom), { align: 'right' });
  if (Number(data.gstOnBrok)) line(doc, 'GST on Brokerage', money(data.gstOnBrok), { align: 'right' });
  line(doc, 'Net Payable', money(data.netPayable), { align: 'right', bold: true });

  if (Number(data.taxApplicable) === 1) {
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text('Tax');
    doc.moveDown(0.4);
    if (Number(data.gstVat) === 1) {
      line(doc, 'SGST', money(data.sgst), { align: 'right' });
      line(doc, 'CGST', money(data.cgst), { align: 'right' });
      line(doc, 'IGST', money(data.igst), { align: 'right' });
    } else {
      line(doc, 'VAT', money(data.vat), { align: 'right' });
    }
    line(doc, 'Amount Payable (with tax)', money(data.netPayableTax), { align: 'right', bold: true });
  }

  if (data.remarks) {
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text('Remarks');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(data.remarks);
  }

  const buffer = await finish(doc, chunks);
  const filename = `${safeFilename(data.invoiceNo || `Freight-Invoice-${data.invoiceId}`)}.pdf`;
  return { buffer, filename };
}
