import PDFDocument from 'pdfkit';
import { dbGetFreightInvoiceForPdf } from './freightInvoiceDb.js';

const TEXT = '#111111';
const MUTED = '#333333';
const LINE = '#444444';

const ONES = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function moneyComma(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qtyComma(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.000';
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function safeFilename(input) {
  return String(input || 'Freight-Invoice').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

/** Strip mojibake / non-printable junk from DB text (keeps newlines). */
function cleanText(value) {
  return String(value || '')
    .replace(/\u00C2/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\t\n\x20-\x7E]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function twoDigitWords(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? `-${ONES[o]}` : ''}`.replace(/-$/, '');
}

function chunkToWords(n) {
  if (!n) return '';
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundred) parts.push(`${ONES[hundred]} HUNDRED`);
  if (rest) parts.push(twoDigitWords(rest));
  return parts.join(' ');
}

export function amountInWordsUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'ZERO';
  const abs = Math.abs(n);
  let dollars = Math.floor(abs);
  let cents = Math.round((abs - dollars) * 100);
  if (cents === 100) {
    dollars += 1;
    cents = 0;
  }

  if (dollars === 0) {
    return `US DOLLARS ZERO AND ${twoDigitWords(cents) || 'ZERO'} CENTS ONLY`;
  }

  const scales = [
    { value: 1_000_000_000, label: 'BILLION' },
    { value: 1_000_000, label: 'MILLION' },
    { value: 1_000, label: 'THOUSAND' },
  ];
  const parts = [];
  let remaining = dollars;
  for (const scale of scales) {
    const count = Math.floor(remaining / scale.value);
    if (count) {
      parts.push(`${chunkToWords(count)} ${scale.label}`);
      remaining %= scale.value;
    }
  }
  if (remaining) parts.push(chunkToWords(remaining));

  const dollarWords = parts.join(' ').replace(/\s+/g, ' ').trim();
  const centWords = cents === 0 ? 'ZERO' : twoDigitWords(cents);
  return `US DOLLARS ${dollarWords} AND ${centWords} CENTS ONLY`;
}

function formatLongDate(value) {
  if (!value) return '';
  let y;
  let m;
  let d;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    y = value.getUTCFullYear();
    m = value.getUTCMonth();
    d = value.getUTCDate();
    if (value.getUTCHours() !== 0 || value.getUTCMinutes() !== 0) {
      y = value.getFullYear();
      m = value.getMonth();
      d = value.getDate();
    }
  } else {
    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (iso) {
      y = Number(iso[1]);
      m = Number(iso[2]) - 1;
      d = Number(iso[3]);
    } else if (dmy) {
      d = Number(dmy[1]);
      m = Number(dmy[2]) - 1;
      y = Number(dmy[3]);
    } else {
      return raw;
    }
  }
  if (!y || y < 1971) return '';
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${String(d).padStart(2, '0')} ${months[m]} ${y}`;
}

function createDocument(title) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 36, right: 40, bottom: 48, left: 40 },
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

function pageWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function ensureSpace(doc, need = 60) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + need > bottom) doc.addPage();
}

function hr(doc) {
  ensureSpace(doc, 8);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const y = doc.y + 2;
  doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).lineWidth(0.6).stroke();
  doc.y = y + 6;
}

/**
 * Draw a description/amount row without overlapping wrapped text.
 * Returns the bottom Y used.
 */
function drawAmountRow(doc, label, amount, opts = {}) {
  ensureSpace(doc, 28);
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const amountWidth = 105;
  const labelWidth = width - amountWidth - 8;
  const fontSize = opts.size || 9;
  const font = opts.bold ? 'Helvetica-Bold' : 'Helvetica';
  const startY = doc.y;
  const labelText = cleanText(label);
  const amountText = amount == null || amount === '' ? '' : String(amount);

  doc.font(font).fontSize(fontSize);
  const labelHeight = doc.heightOfString(labelText || ' ', {
    width: labelWidth,
    lineGap: 1,
  });
  const amountHeight = amountText
    ? doc.heightOfString(amountText, { width: amountWidth, align: 'right' })
    : 0;
  const rowHeight = Math.max(labelHeight, amountHeight, fontSize + 2);

  doc.fillColor(TEXT).text(labelText, left, startY, {
    width: labelWidth,
    lineGap: 1,
    continued: false,
  });
  if (amountText) {
    doc.fillColor(TEXT).text(amountText, left + labelWidth + 8, startY, {
      width: amountWidth,
      align: 'right',
      lineGap: 1,
    });
  }

  doc.y = startY + rowHeight + (opts.gap ?? 4);
  return doc.y;
}

function drawKeyValue(doc, label, value, opts = {}) {
  ensureSpace(doc, 20);
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const labelWidth = opts.labelWidth || 150;
  const startY = doc.y;
  const fontSize = opts.size || 9;
  const valueText = cleanText(value);

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(TEXT)
    .text(label, left, startY, { width: labelWidth, continued: false });
  doc.font('Helvetica').fontSize(fontSize).fillColor(TEXT)
    .text(valueText, left + labelWidth, startY, {
      width: width - labelWidth,
      lineGap: 1,
    });
  const h = Math.max(
    doc.heightOfString(label, { width: labelWidth }),
    doc.heightOfString(valueText || ' ', { width: width - labelWidth, lineGap: 1 }),
  );
  doc.y = startY + h + (opts.gap ?? 3);
}

function drawLabeledBlock(doc, label, value) {
  ensureSpace(doc, 24);
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const labelWidth = 120;
  const startY = doc.y;
  const valueText = cleanText(value);
  doc.font('Helvetica').fontSize(9).fillColor(TEXT)
    .text(label, left, startY, { width: labelWidth });
  doc.text(valueText, left + labelWidth, startY, {
    width: width - labelWidth,
    lineGap: 1,
  });
  const h = Math.max(
    doc.heightOfString(label, { width: labelWidth }),
    doc.heightOfString(valueText || ' ', { width: width - labelWidth, lineGap: 1 }),
  );
  doc.y = startY + h + 3;
}

/**
 * Freight invoice PDF — layout parity with PHP allPdf.php?id=27
 */
export async function generateFreightInvoicePdf(invoiceId) {
  const data = await dbGetFreightInvoiceForPdf(invoiceId);
  const title = data.title || 'FREIGHT INVOICE';
  const { doc, chunks } = createDocument(title);

  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const currency = data.currency || 'USD';

  doc.font('Helvetica-Bold').fontSize(14).fillColor(TEXT).text(title, { align: 'center' });
  doc.moveDown(0.7);

  const billName = `M/S ${cleanText(data.vendorName)}`.trim();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT).text(billName, left, doc.y, { width });
  if (data.vendorAddress) {
    let addressOnly = cleanText(data.vendorAddress)
      .replace(new RegExp(`^${String(data.vendorName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,?\\s*`, 'i'), '')
      .trim();
    // Prefer line breaks for comma-separated long addresses
    if (addressOnly.includes(',') && !addressOnly.includes('\n') && addressOnly.length > 60) {
      addressOnly = addressOnly.replace(/,\s+/g, '\n');
    }
    const startY = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text(addressOnly || cleanText(data.vendorAddress), left, startY, {
        width: width * 0.78,
        lineGap: 1,
      });
    doc.y = startY + doc.heightOfString(addressOnly || cleanText(data.vendorAddress), {
      width: width * 0.78,
      lineGap: 1,
    }) + 2;
  }
  doc.font('Helvetica').fontSize(9).fillColor(TEXT)
    .text(`GSTIN/UIN : ${cleanText(data.vendorGstin)}`);
  doc.moveDown(0.45);

  drawKeyValue(doc, 'INVOICE NO. :', data.invoiceNo || '');
  drawKeyValue(doc, 'INVOICE DATE :', formatLongDate(data.invoiceDateRaw || data.invoiceDate));
  drawKeyValue(doc, 'VESSEL NAME :', data.vesselName || '');
  drawKeyValue(doc, 'IMO NO. :', `${data.imoNo || ''}    FLAG : ${data.flag || ''}`);
  drawKeyValue(doc, 'CHARTER PARTY DATED :', formatLongDate(data.cpDateRaw || data.cpDate));
  doc.moveDown(0.25);

  hr(doc);
  const headerY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT)
    .text('DESCRIPTION', left, headerY, { width: width - 110 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT)
    .text(`AMOUNT IN ${currency}`, left + width - 105, headerY, { width: 105, align: 'right' });
  doc.y = headerY + 12;
  hr(doc);

  if (data.voyageLabel) {
    drawAmountRow(doc, `VOYAGE : ${String(data.voyageLabel).toUpperCase()}`, '');
  }

  drawAmountRow(
    doc,
    `TOTAL B/L QUANTITY : ${qtyComma(data.quantity)} MT ${String(data.cargoName || '').toUpperCase()}`,
    '',
  );

  if (data.isLumpsum) {
    drawAmountRow(
      doc,
      `AGREED FREIGHT AS PER CP: ${currency} ${moneyComma(data.agreedFreight)} LUMPSUM`,
      '',
    );
    drawAmountRow(doc, 'LUMPSUM FREIGHT', `${currency} ${moneyComma(data.grossFreight)}`);
  } else {
    drawAmountRow(
      doc,
      `AGREED FREIGHT AS PER CP: ${currency} ${moneyComma(data.freightRate)} / MT`,
      '',
    );
    drawAmountRow(doc, 'GROSS FREIGHT', moneyComma(data.grossFreight));
  }

  const pct = Number(data.percentThereOff) || 0;
  drawAmountRow(doc, `TOTAL ${money(pct)}% FREIGHT DUE`, moneyComma(data.freightDue));

  for (const row of data.addRows || []) {
    if (!row.description && !Number(row.amount)) continue;
    drawAmountRow(doc, String(row.description || 'ADD').toUpperCase(), moneyComma(row.amount));
  }
  for (const row of data.subRows || []) {
    if (!row.description && !Number(row.amount)) continue;
    drawAmountRow(
      doc,
      `${String(row.description || 'LESS').toUpperCase()} (-)`,
      moneyComma(row.amount),
    );
  }

  if (Number(data.brokerage) > 0) {
    drawAmountRow(
      doc,
      `BROKERAGE(${money(data.brokeragePercent)}%) (-)`,
      moneyComma(data.brokerage),
    );
  }
  if (Number(data.addCom) > 0) {
    const addComPct = Number(data.addComPercent) || 0;
    drawAmountRow(doc, `ADDCOM(${addComPct.toFixed(4)}%) (-)`, moneyComma(data.addCom));
  }
  if (Number(data.gstOnBrok) > 0) {
    drawAmountRow(doc, 'GST ON BROKERAGE (-)', moneyComma(data.gstOnBrok));
  }

  if (Number(data.taxApplicable) === 1 && Number(data.gstVat) === 1) {
    drawAmountRow(doc, `SGST OUTPUT(${money(data.sgstPercent)}%) (+)`, moneyComma(data.sgst));
    drawAmountRow(doc, `CGST OUTPUT(${money(data.cgstPercent)}%) (+)`, moneyComma(data.cgst));
    if (Number(data.igst) > 0 || Number(data.igstPercent) > 0) {
      drawAmountRow(doc, `IGST OUTPUT(${money(data.igstPercent)}%) (+)`, moneyComma(data.igst));
    }
  } else if (Number(data.taxApplicable) === 1) {
    drawAmountRow(doc, `VAT(${money(data.vatPercent)}%) (+)`, moneyComma(data.vat));
  }

  hr(doc);
  const payable = Number(data.netPayableTax) || Number(data.netPayable) || 0;
  drawAmountRow(doc, 'TOTAL PAYABLE DUE', moneyComma(payable), { bold: true, gap: 6 });
  hr(doc);

  ensureSpace(doc, 40);
  const words = amountInWordsUsd(payable);
  const wordsText = `(AMOUNT IN WORDS : ${words})`;
  const wordsY = doc.y;
  doc.font('Helvetica').fontSize(8.5).fillColor(TEXT)
    .text(wordsText, left, wordsY, { width, lineGap: 1 });
  doc.y = wordsY + doc.heightOfString(wordsText, { width, lineGap: 1 }) + 10;

  ensureSpace(doc, 130);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT).text('REMIT VIDE WIRE TRANSFER :');
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(9).fillColor(TEXT)
    .text(`PAYMENT DUE DATE : ${cleanText(data.paymentTerms || data.dueDate || '')}`);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT).text('PAYMENT INSTRUCTIONS :');
  doc.moveDown(0.15);

  const bank = data.banking || {};
  if (bank.name) drawLabeledBlock(doc, 'ACCOUNT NAME :', bank.name);
  if (bank.address) drawLabeledBlock(doc, 'ADDRESS :', bank.address);
  if (bank.accountNo) drawLabeledBlock(doc, 'ACCOUNT NO. :', bank.accountNo);
  if (bank.bank) drawLabeledBlock(doc, 'BANK NAME :', bank.bank);
  if (bank.bankAddress) drawLabeledBlock(doc, 'BANK ADDRESS :', bank.bankAddress);
  if (bank.swiftCode) drawLabeledBlock(doc, 'SWIFT CODE :', bank.swiftCode);
  if (bank.ibanNo) drawLabeledBlock(doc, 'IBAN NO. :', bank.ibanNo);
  doc.moveDown(0.35);

  if (Number(data.taxApplicable) === 1 && Number(data.gstVat) === 1) {
    ensureSpace(doc, 90);
    const cols = [left, left + 70, left + 180, left + 280, left + 370];
    hr(doc);
    let y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT);
    doc.text('HSN/SAC', cols[0], y, { width: 65 });
    doc.text('TAXABLE VALUE', cols[1], y, { width: 100 });
    doc.text('RATE', cols[2], y, { width: 90 });
    doc.text('TAX AMOUNT', cols[4], y, { width: 80, align: 'right' });
    doc.y = y + 12;
    hr(doc);
    y = doc.y;

    const taxable = money(payable);
    const taxRows = [
      { rateLabel: `SGST ${money(data.sgstPercent)}%`, tax: money(data.sgst) },
      { rateLabel: `CGST ${money(data.cgstPercent)}%`, tax: money(data.cgst) },
    ];
    if (Number(data.igst) > 0 || Number(data.igstPercent) > 0) {
      taxRows.push({ rateLabel: `IGST ${money(data.igstPercent)}%`, tax: money(data.igst) });
    }

    doc.font('Helvetica').fontSize(8).fillColor(TEXT);
    for (const taxRow of taxRows) {
      doc.text(data.hsnSac || '996521', cols[0], y, { width: 65 });
      doc.text(taxable, cols[1], y, { width: 100 });
      doc.text(taxRow.rateLabel, cols[2], y, { width: 120 });
      doc.text(taxRow.tax, cols[4], y, { width: 80, align: 'right' });
      y += 12;
    }
    doc.y = y;
    hr(doc);
    const totY = doc.y;
    const totalTax = Number(data.sgst) + Number(data.cgst) + Number(data.igst);
    doc.font('Helvetica-Bold').fontSize(8)
      .text('Total', cols[0], totY, { width: 65 })
      .text(taxable, cols[1], totY, { width: 100 })
      .text(money(totalTax), cols[4], totY, { width: 80, align: 'right' });
    doc.y = totY + 14;
  }

  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('*E&OE');
  doc.moveDown(0.12);
  doc.text('* This is a system generated invoice and no signatures are required');
  doc.moveDown(0.7);

  ensureSpace(doc, 50);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT)
    .text(String(data.ownerName || '').toUpperCase(), { align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    .text(`Tel: ${cleanText(data.ownerPhone)} | Fax: ${cleanText(data.ownerFax)}`, { align: 'center' });
  doc.text(
    `Email: ${cleanText(data.ownerEmail)} | Web: ${cleanText(data.ownerWeb)}`,
    { align: 'center' },
  );

  const buffer = await finish(doc, chunks);
  const vesselBit = data.vesselName ? ` Of ${data.vesselName}` : '';
  const typeBit = data.invType ? `(${data.invType})` : '';
  const dateBit = formatLongDate(data.invoiceDateRaw || data.invoiceDate)
    .replace(/(\d{2}) (\w+) (\d{4})/, (_, dd, mon, yyyy) => `${dd}-${mon.slice(0, 3)}-${yyyy}`);
  const filename = safeFilename(
    `Invoice${vesselBit}${typeBit}${dateBit || data.invoiceNo || data.invoiceId}.pdf`,
  );
  return { buffer, filename };
}
