import PDFDocument from 'pdfkit';
import {
  dbGetClubbedFreightForPdf,
  dbGetClubbedHireForPdf,
} from './clubbedInvoiceDb.js';

const BLUE = '#3c8dbc';
const TEXT = '#24313A';
const MUTED = '#5b6b75';

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function safeFilename(input) {
  return String(input || 'Clubbed-Invoice').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
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

function sectionTitle(doc, title) {
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text(title);
  doc.moveDown(0.35);
}

export async function generateClubbedFreightPdf(invoiceId) {
  const data = await dbGetClubbedFreightForPdf(invoiceId);
  const title = `Clubbed Freight Invoice ${data.invoiceNo || data.invoiceId}`;
  const { doc, chunks } = createDocument(title);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(BLUE).text('CLUBBED FREIGHT INVOICE', { align: 'center' });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).fillColor(TEXT)
    .text(`${data.invType || ''} — ${data.pType || ''}`.trim(), { align: 'center' });
  doc.moveDown(1);

  line(doc, 'Invoice No', data.invoiceNo);
  line(doc, 'Invoice Type', data.invType);
  line(doc, 'Invoice Date', data.invoiceDate);
  line(doc, 'Due Date', data.dueDate);
  line(doc, 'Invoicing Company', data.ownerName);
  line(doc, 'Vendor / Charterer', data.vendorName);
  if (data.vendorAddress) line(doc, 'Vendor Address', data.vendorAddress);
  line(doc, 'Fixture / Voyage', data.voyageNo || data.nomMessage);
  line(doc, 'Vessel', data.vesselName);
  line(doc, 'Currency', data.currency);

  sectionTitle(doc, 'Amounts');
  line(doc, 'Gross Freight', money(data.grossFreight), { align: 'right' });
  for (const row of data.addRows || []) {
    line(doc, `Add: ${row.description || 'Addition'}`, money(row.amount), { align: 'right' });
  }
  for (const row of data.subRows || []) {
    line(doc, `Less: ${row.description || 'Deduction'}`, money(row.amount), { align: 'right' });
  }
  line(doc, 'Net Amount', money(data.netAmount), { align: 'right' });
  line(doc, 'Net Payable', money(data.netPayableTax || data.netPayable), { align: 'right', bold: true });

  if ((data.clubbedCharterers || []).length) {
    sectionTitle(doc, 'Clubbed Charterers');
    for (const row of data.clubbedCharterers) {
      const label = [row.vendorName, row.cargoName ? `(${row.cargoName})` : '']
        .filter(Boolean)
        .join(' ');
      line(doc, label || row.vendorId, row.quantity ? `Qty ${money(row.quantity)}` : '-', { align: 'right' });
    }
  }

  if (data.remarks) {
    sectionTitle(doc, 'Remarks');
    doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(data.remarks);
  }

  const buffer = await finish(doc, chunks);
  const filename = `${safeFilename(data.invoiceNo || `Clubbed-Freight-${data.invoiceId}`)}.pdf`;
  return { buffer, filename };
}

export async function generateClubbedHirePdf(invoiceId) {
  const data = await dbGetClubbedHireForPdf(invoiceId);
  const title = `Clubbed Hire Statement ${data.invoiceNo || data.invoiceId}`;
  const { doc, chunks } = createDocument(title);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(BLUE).text('CLUBBED HIRE STATEMENT', { align: 'center' });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).fillColor(TEXT)
    .text(data.invType || 'Hire Statement', { align: 'center' });
  doc.moveDown(1);

  line(doc, 'Hire Statement No', data.invoiceNo);
  line(doc, 'Statement Type', data.invType);
  line(doc, 'Statement Date', data.invoiceDate);
  line(doc, 'Due Date', data.dueDate);
  line(doc, 'Hire From', data.hireFrom);
  line(doc, 'Hire To', data.hireTo);
  line(doc, 'Vendor', data.vendorName);
  if (data.vendorAddress) line(doc, 'Vendor Address', data.vendorAddress);
  line(doc, 'Nom ID', data.nomMessage);
  line(doc, 'Fixture / Voyage', data.voyageNo);
  line(doc, 'Vessel', data.vesselName);
  if (data.tcNo) line(doc, 'TC No', data.tcNo);
  line(doc, 'Currency', data.currency);

  sectionTitle(doc, 'Amounts');
  line(doc, 'Hire Days', money(data.hireDays), { align: 'right' });
  if (data.utilisedDays != null) line(doc, 'Utilised Days', money(data.utilisedDays), { align: 'right' });
  line(doc, 'Total Hire (this inv)', money(data.finalAmt), { align: 'right' });
  line(doc, 'Balance to Shipowner', money(data.balanceToOwner), { align: 'right', bold: true });

  if ((data.clubbedOrcs || []).length) {
    sectionTitle(doc, 'Clubbed Owner Related Costs');
    for (const row of data.clubbedOrcs) {
      line(doc, row.costName || row.orcId, money(row.amount), { align: 'right' });
    }
  }

  if (data.remarks) {
    sectionTitle(doc, 'Remarks');
    doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(data.remarks);
  }

  const buffer = await finish(doc, chunks);
  const filename = `${safeFilename(data.invoiceNo || `Clubbed-Hire-${data.invoiceId}`)}.pdf`;
  return { buffer, filename };
}
