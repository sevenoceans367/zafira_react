import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { isDbConfigured } from '../config.js';
import { dbGetAgencyLetterForPdf } from './agencyLetterDb.js';

const LOGO_SVG = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../frontend/assets/progress_shipping.svg',
);

let logoPngCache;

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function decodePng(buf) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!width || !height || !channels) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let src = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src];
    src += 1;
    const row = Buffer.from(raw.subarray(src, src + stride));
    src += stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = prev[i];
      const upLeft = i >= channels ? prev[i - channels] : 0;
      let value = row[i];
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + up) & 255;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = (value + pred) & 255;
      }
      row[i] = value;
    }
    row.copy(pixels, y * stride);
    prev = row;
  }
  return { width, height, channels, pixels };
}

function sampleChannel(image, x, y, channel) {
  const px = Math.min(image.width - 1, Math.max(0, x));
  const py = Math.min(image.height - 1, Math.max(0, y));
  return image.pixels[(py * image.width + px) * image.channels + channel];
}

function encodeLogoPng(mask, color, size = 240) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    const srcY = Math.floor(((y + 0.5) * color.height) / size);
    for (let x = 0; x < size; x += 1) {
      const srcX = Math.floor(((x + 0.5) * color.width) / size);
      const alpha = sampleChannel(mask, srcX, srcY, 0);
      const o = 1 + x * 4;
      row[o] = sampleChannel(color, srcX, srcY, 0);
      row[o + 1] = sampleChannel(color, srcX, srcY, 1);
      row[o + 2] = sampleChannel(color, srcX, srcY, 2);
      row[o + 3] = alpha;
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function loadLogoPng() {
  if (logoPngCache !== undefined) return logoPngCache;
  try {
    const svg = fs.readFileSync(LOGO_SVG, 'utf8');
    const matches = [...svg.matchAll(/xlink:href="data:image\/png;base64,([^"]+)"/g)];
    if (matches.length < 2) {
      logoPngCache = null;
      return logoPngCache;
    }
    const mask = decodePng(Buffer.from(matches[0][1], 'base64'));
    const color = decodePng(Buffer.from(matches[1][1], 'base64'));
    logoPngCache = mask && color ? encodeLogoPng(mask, color) : null;
  } catch {
    logoPngCache = null;
  }
  return logoPngCache;
}

function drawHeaderLogo(doc, top) {
  const png = loadLogoPng();
  const size = 58;
  const x = leftX(doc) + usableWidth(doc) - size;
  if (!png) return 0;
  try {
    doc.image(png, x, top, { fit: [size, size], align: 'right', valign: 'top' });
    return size + 10;
  } catch {
    return 0;
  }
}

const NAVY = '#274670';
const ORANGE = '#F4652C';
const AMBER = '#B9760A';
const BLUE = '#2F6FED';
const TEXT = '#1B2430';
const MUTED = '#5B6472';
const LIGHT = '#8A93A2';
const LINE = '#DFE2E7';
const FIELD = '#F1F2F4';
const GREEN_PORTAL_BG = '#E8F1FB';
const GREEN_PORTAL_BD = '#C9DBF5';
const AMBER_BG = '#FCF1DD';
const AMBER_BD = '#F3DFB3';

const LETTER_TITLES = {
  pda: 'PDA Request Letter',
  nomination: 'Agency Nomination Letter',
  'agent-bunker': 'Letter to Agents - Bunker Stemmed',
  'master-bunker': 'Letter to Master - Bunker Stemmed',
  voyage: 'Voyage Instructions Letter',
};

function safeFilename(input) {
  return String(input || 'Agency-Letter').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function dash(value) {
  const text = String(value ?? '').trim();
  return text || '—';
}

function createDocument(title) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, right: 42, bottom: 56, left: 42 },
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

function usableWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function leftX(doc) {
  return doc.page.margins.left;
}

function ensureSpace(doc, needed = 80) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function firstContact(data) {
  const entity = (data.entities || []).find((row) => row.name || row.email) || {};
  return {
    name: entity.name || '',
    email: entity.email || data.agentEmail || '',
  };
}

function agentLoginUrl(data) {
  const raw = data.agentLoginUrl
    || process.env.AGENT_LOGIN_URL
    || 'https://zafira.sevenoceans.net.in/login';
  return /^https?:\/\//i.test(raw)
    ? raw
    : `https://zafira.sevenoceans.net.in${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function formatDisplayDate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function buildRef(data, prefix) {
  const portCode = String(data.portName || 'PORT').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'PORT';
  return `GVL/${prefix}/${dash(data.nomId)}/${portCode}`;
}

function drawStyledHeader(doc, { heading, sub, accent, refCode, dateLabel }) {
  const x = leftX(doc);
  const w = usableWidth(doc);
  const top = doc.y;
  const logoPad = drawHeaderLogo(doc, top);
  const textW = Math.max(120, w - logoPad);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(accent).text(heading, x, top, { width: textW });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(sub, x, doc.y, { width: textW });
  doc.y = Math.max(doc.y, top + 58);
  doc.x = x;
  doc.moveDown(0.55);

  const barY = doc.y;
  doc.roundedRect(x, barY, w, 22, 4).fill(NAVY);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
  doc.text(`Ref: ${refCode}`, x + 10, barY + 6, { width: w / 2 - 12, continued: false });
  doc.text(`Date: ${dateLabel}`, x + w / 2, barY + 6, { width: w / 2 - 12, align: 'right' });
  doc.rect(x, barY + 22, w, 3).fill(ORANGE);
  doc.y = barY + 34;
  doc.x = x;
  doc.fillColor(TEXT);
}

function drawToFrom(doc, toLines, fromLines) {
  const x = leftX(doc);
  const w = usableWidth(doc);
  const col = (w - 16) / 2;
  const y0 = doc.y + 8;

  const drawCol = (title, lines, cx) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(LIGHT).text(title, cx, y0, { width: col });
    let y = y0 + 12;
    lines.forEach((line, index) => {
      doc.font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .fillColor(index === 0 ? TEXT : MUTED)
        .text(line, cx, y, { width: col });
      y = doc.y + 2;
    });
    return y;
  };

  const yLeft = drawCol('TO', toLines, x);
  const yRight = drawCol('FROM', fromLines, x + col + 16);
  doc.y = Math.max(yLeft, yRight) + 8;
  doc.x = x;
}

function drawReLine(doc, text) {
  const x = leftX(doc);
  const w = usableWidth(doc);
  doc.moveTo(x, doc.y).lineTo(x + w, doc.y).strokeColor(LINE).lineWidth(1).stroke();
  doc.moveDown(0.45);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(text, x, doc.y, { width: w });
  doc.moveDown(0.35);
  doc.fillColor(TEXT);
}

function drawParagraph(doc, text, opts = {}) {
  const x = leftX(doc);
  const w = usableWidth(doc);
  doc.x = x;
  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.size || 10)
    .fillColor(opts.color || TEXT)
    .text(String(text || ''), x, doc.y, {
      width: w,
      align: opts.align || 'left',
      lineGap: opts.lineGap ?? 2,
    });
  doc.moveDown(opts.gap ?? 0.35);
}

function drawSignOff(doc, data) {
  ensureSpace(doc, 70);
  drawParagraph(doc, 'Best regards,', { gap: 0.55 });
  const name = data.contactPerson || 'Operations';
  drawParagraph(doc, name, { bold: true, gap: 0.1 });
  drawParagraph(doc, `Operations, ${data.companyName || 'Progress Shipping'}`, { gap: 0.4, color: MUTED });
}

function drawPlatformFooter(doc, data) {
  const x = leftX(doc);
  const w = usableWidth(doc);
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 24;
  const y0 = doc.page.height - 48;
  if (doc.y > y0 - 18) {
    doc.page.margins.bottom = savedBottom;
    return;
  }

  doc.roundedRect(x, y0 - 4, w, 36, 4).fill(NAVY);
  const logoSize = 22;
  const logoX = x + 8;
  const logoY = y0 + 3;
  const png = loadLogoPng();
  let textX = x + 12;
  if (png) {
    try {
      const cx = logoX + logoSize / 2;
      const cy = logoY + logoSize / 2;
      doc.save();
      doc.circle(cx, cy, logoSize / 2).fill('#fff');
      doc.circle(cx, cy, logoSize / 2 - 1).clip();
      doc.image(png, logoX + 1, logoY + 1, { fit: [logoSize - 2, logoSize - 2], align: 'center', valign: 'center' });
      doc.restore();
      textX = logoX + logoSize + 8;
    } catch {
      textX = x + 12;
    }
  }
  doc.fillColor('#B9C4D8').font('Helvetica').fontSize(8);
  const company = data.companyName || 'Progress Shipping';
  const line1 = [
    company,
    data.companyAddress || 'Singapore',
    data.companyPhone ? `Tel: ${data.companyPhone}` : '',
  ].filter(Boolean).join(' · ');
  const line2 = [
    data.companyEmail || 'ops@progressshipping.com',
    data.companyWebsite || 'www.sevenoceans.world',
  ].filter(Boolean).join(' · ');
  doc.text(line1, textX, y0 + 4, { width: x + w - 12 - textX });
  doc.text(line2, textX, y0 + 16, { width: x + w - 12 - textX });
  doc.page.margins.bottom = savedBottom;
  doc.x = x;
}

function drawGenBy(doc) {
  drawParagraph(
    doc,
    'This letter was generated on the Seven Oceans platform on behalf of Progress Shipping.',
    { size: 8, color: LIGHT, gap: 0.5 },
  );
}

function drawPortalBox(doc, data) {
  ensureSpace(doc, 90);
  const x = leftX(doc);
  const w = usableWidth(doc);
  const y = doc.y;
  const boxH = 78;
  doc.roundedRect(x, y, w, boxH, 8).fillAndStroke(GREEN_PORTAL_BG, GREEN_PORTAL_BD);
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(11)
    .text('Agent Portal Access', x + 12, y + 10, { width: w - 24 });
  doc.fillColor(MUTED).font('Helvetica').fontSize(9.5)
    .text('Please log in to the agent portal to submit your PDA response directly:', x + 12, y + 28, { width: w - 24 });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10)
    .text(`Username: ${dash(data.username)}    Password: ${dash(data.password)}`, x + 12, y + 44, { width: w - 24 });
  doc.fillColor(BLUE).font('Helvetica').fontSize(9.5)
    .text('Click here to log in', x + 12, y + 58, {
      width: w - 24,
      link: agentLoginUrl(data),
      underline: true,
    });
  doc.y = y + boxH + 10;
  doc.x = x;
  doc.fillColor(TEXT);
}

function drawParticularsGrid(doc, cells) {
  const x = leftX(doc);
  const w = usableWidth(doc);
  const cols = cells.length;
  const colW = w / cols;
  const y = doc.y;
  const h = 46;
  doc.roundedRect(x, y, w, h, 5).fillAndStroke(FIELD, LINE);
  cells.forEach((cell, index) => {
    const cx = x + colW * index;
    if (index > 0) {
      doc.moveTo(cx, y).lineTo(cx, y + h).strokeColor(LINE).stroke();
    }
    doc.font('Helvetica-Bold').fontSize(7).fillColor(LIGHT)
      .text(cell.label, cx + 4, y + 8, { width: colW - 8, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(TEXT)
      .text(dash(cell.value), cx + 4, y + 22, { width: colW - 8, align: 'center' });
  });
  doc.y = y + h + 12;
  doc.x = x;
}

function drawInfoGrid(doc, pairs) {
  const x = leftX(doc);
  const w = usableWidth(doc);
  const colW = w / 2;
  const rowH = 34;
  const rows = Math.ceil(pairs.length / 2);
  const y0 = doc.y;
  doc.roundedRect(x, y0, w, rows * rowH, 6).strokeColor(LINE).stroke();

  pairs.forEach((pair, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const cx = x + col * colW;
    const cy = y0 + row * rowH;
    const bg = row % 2 === 0 ? '#F7F8FA' : '#FFFFFF';
    doc.rect(cx, cy, colW, rowH).fill(bg);
    if (col === 1) {
      doc.moveTo(cx, cy).lineTo(cx, cy + rowH).strokeColor(LINE).stroke();
    }
    if (row < rows - 1) {
      doc.moveTo(cx, cy + rowH).lineTo(cx + colW, cy + rowH).strokeColor(LINE).stroke();
    }
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY)
      .text(pair[0].toUpperCase(), cx + 8, cy + 6, { width: colW - 16 });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(TEXT)
      .text(dash(pair[1]), cx + 8, cy + 17, { width: colW - 16 });
  });

  doc.roundedRect(x, y0, w, rows * rowH, 6).strokeColor(LINE).stroke();
  doc.y = y0 + rows * rowH + 12;
  doc.x = x;
}

function drawSimpleTable(doc, headers, rows) {
  ensureSpace(doc, 60 + rows.length * 22);
  const x = leftX(doc);
  const w = usableWidth(doc);
  const colW = w / headers.length;
  let y = doc.y;

  doc.roundedRect(x, y, w, 22, 4).fill('#F7F8FA');
  headers.forEach((header, index) => {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY)
      .text(header.toUpperCase(), x + colW * index + 6, y + 7, { width: colW - 12 });
  });
  y += 22;
  doc.moveTo(x, y).lineTo(x + w, y).strokeColor(LINE).stroke();

  rows.forEach((row, rowIndex) => {
    ensureSpace(doc, 28);
    if (doc.y !== y && rowIndex > 0) y = doc.y;
    const bg = rowIndex % 2 === 1 ? '#F7F8FA' : '#FFFFFF';
    const h = 24;
    doc.rect(x, y, w, h).fill(bg);
    row.forEach((cell, index) => {
      doc.font('Helvetica').fontSize(9).fillColor(TEXT)
        .text(dash(cell), x + colW * index + 6, y + 7, { width: colW - 12 });
    });
    y += h;
    doc.moveTo(x, y).lineTo(x + w, y).strokeColor(LINE).stroke();
  });

  doc.roundedRect(x, doc.y < y ? y - rows.length * 24 - 22 : doc.y, w, 0, 0);
  doc.y = y + 10;
  doc.x = x;
}

function drawSpecTable(doc, specs) {
  ensureSpace(doc, 40 + specs.length * 28);
  const x = leftX(doc);
  const w = usableWidth(doc);
  let y = doc.y;
  const labelW = w * 0.32;

  specs.forEach((spec, index) => {
    ensureSpace(doc, 36);
    y = doc.y;
    const h = Math.max(28, 14 + Math.ceil(String(spec.value || '').length / 55) * 11);
    const bg = index % 2 === 1 ? '#F7F8FA' : '#FFFFFF';
    doc.rect(x, y, w, h).fill(bg);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY)
      .text(spec.label, x + 8, y + 8, { width: labelW - 12 });
    doc.font('Helvetica').fontSize(9).fillColor(TEXT)
      .text(dash(spec.value), x + labelW, y + 8, { width: w - labelW - 10 });
    doc.y = y + h;
    doc.moveTo(x, doc.y).lineTo(x + w, doc.y).strokeColor(LINE).stroke();
  });
  doc.moveDown(0.4);
  doc.x = x;
}

function drawOpsBox(doc, paragraphs) {
  ensureSpace(doc, 90);
  const x = leftX(doc);
  const w = usableWidth(doc);
  const text = (paragraphs || []).filter(Boolean).join('\n\n')
    || 'Please acknowledge receipt and confirm compliance at your earliest convenience.';
  const textHeight = doc.heightOfString(text, { width: w - 24, lineGap: 3 });
  const boxH = textHeight + 24;
  ensureSpace(doc, boxH + 20);
  const y = doc.y;
  doc.roundedRect(x, y, w, boxH, 8).fillAndStroke(AMBER_BG, AMBER_BD);
  doc.fillColor(TEXT).font('Helvetica').fontSize(10)
    .text(text, x + 12, y + 12, { width: w - 24, lineGap: 3 });
  doc.y = y + boxH + 12;
  doc.x = x;
}

/** Legacy plain header kept for nomination / bunker letters. */
function drawLegacyHeader(doc, title) {
  const top = doc.y;
  const logoPad = drawHeaderLogo(doc, top);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1b77a6').text(title, leftX(doc), top, {
    align: 'center',
    width: usableWidth(doc) - logoPad,
  });
  doc.y = Math.max(doc.y, top + 58);
  doc.x = leftX(doc);
  doc.moveDown(0.35);
  doc.moveTo(leftX(doc), doc.y)
    .lineTo(leftX(doc) + usableWidth(doc), doc.y)
    .strokeColor('#c5cdd3')
    .stroke();
  doc.moveDown(0.8);
}

function para(doc, text, opts = {}) {
  doc.x = leftX(doc);
  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.size || 10)
    .fillColor(TEXT)
    .text(String(text || ''), {
      align: opts.align || 'left',
      lineGap: 2,
      width: usableWidth(doc),
    });
  doc.moveDown(opts.gap ?? 0.45);
}

function drawAgentLoginCredentials(doc, data) {
  doc.moveDown(0.35);
  para(doc, `Username: ${data.username || ''}          Password: ${data.password || ''}`, { gap: 0.25, size: 11 });
  doc.fillColor('#1b77a6').font('Helvetica').fontSize(10)
    .text('Click here to login', {
      width: usableWidth(doc),
      link: agentLoginUrl(data),
      underline: true,
    });
  doc.fillColor(TEXT);
  doc.moveDown(0.4);
  doc.x = leftX(doc);
}

function kv(doc, label, value) {
  para(doc, `${label} : ${value == null || value === '' ? '' : String(value)}`, { gap: 0.1, size: 9 });
}

function drawBunkerTable(doc, bunkers) {
  const x = leftX(doc);
  const usable = usableWidth(doc);
  const lines = [
    ['FUEL GRADE/SPEC', 'SUPPLIER', 'PHYSICAL', 'QUANTITY(MT)'].join('  |  '),
    ...(bunkers || []).map((row) => [row.grade, row.supplier, row.physical, row.quantity]
      .map((v) => String(v ?? ''))
      .join('  |  ')),
  ];
  lines.forEach((line, index) => {
    doc.x = x;
    doc.font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor(TEXT)
      .text(line, x, doc.y, { width: usable, align: 'left' });
    doc.x = x;
  });
  doc.x = x;
  doc.moveDown(0.3);
}

function drawPdaBody(doc, data) {
  const v = data.vessel || {};
  const dateLabel = formatDisplayDate(data.date);
  const refCode = buildRef(data, 'PDA');
  const portLabel = [data.portName, data.countryName].filter(Boolean).join(', ') || data.portName;

  drawStyledHeader(doc, {
    heading: 'PDA REQUEST LETTER',
    sub: 'Performa Disbursement Account Request',
    accent: ORANGE,
    refCode,
    dateLabel,
  });

  drawToFrom(
    doc,
    ['The Port Agents', dash(portLabel), 'Attn: Operations'],
    [
      `Seven Oceans / ${data.companyName || 'Progress Shipping'}`,
      'Operations Department',
      `Voyage ${dash(data.nomId)}`,
    ],
  );

  drawReLine(doc, `Re: M/V “${dash(data.vesselName)}” — Voyage ${dash(data.nomId)}`);

  drawParagraph(doc, 'Good day,', { gap: 0.15 });
  drawParagraph(doc, 'Dear Sirs,', { gap: 0.35 });
  drawParagraph(
    doc,
    `We are working on a possible loading at ${dash(portLabel)} for ${dash(data.cargoName)}`
    + `${data.qty ? `, ${data.qty} MT` : ''}`
    + `${data.tolerance ? ` (+/- ${data.tolerance})` : ''}.`,
  );
  drawParagraph(doc, "Please revert with your best Performa DA on basis following vessel’s particulars:");

  drawParticularsGrid(doc, [
    { label: 'LOA (M)', value: v.loa },
    { label: 'BOA (M)', value: v.breadth },
    { label: 'MAX S.DRAFT (M)', value: v.draft },
    { label: 'DWT (MT)', value: v.dwt },
    { label: 'GRT', value: v.grt },
    { label: 'NRT', value: v.nrt },
  ]);

  drawParagraph(doc, 'Please quote ALL IN agency fee. In addition, please advise the usual port restrictions for this vessel type.');
  drawSignOff(doc, data);
  drawPortalBox(doc, data);
  drawGenBy(doc);
}

function drawVoyageBody(doc, data) {
  const dateLabel = formatDisplayDate(data.date);
  const refCode = buildRef(data, 'VOY');
  const portLabel = [data.portName, data.countryName].filter(Boolean).join(', ') || data.portName;
  const portsSummary = data.portsSummary
    || (data.portRotation || []).map((row) => row.port).filter(Boolean).join(' / ')
    || portLabel;

  drawStyledHeader(doc, {
    heading: 'VOYAGE INSTRUCTIONS',
    sub: 'Letter to Master',
    accent: AMBER,
    refCode,
    dateLabel,
  });

  drawToFrom(
    doc,
    ['The Master', `M/V “${dash(data.vesselName)}”`, `Voyage ${dash(data.nomId)}`],
    [
      `Seven Oceans / ${data.companyName || 'Progress Shipping'}`,
      'Operations Department',
      dash(portLabel),
    ],
  );

  drawReLine(doc, `Re: Voyage Instructions — M/V “${dash(data.vesselName)}”, Voyage ${dash(data.nomId)}`);
  drawParagraph(doc, 'Dear Sir,', { gap: 0.2 });
  drawParagraph(doc, 'The next voyage has been fixed as follows. Please follow the enclosed voyage instructions.');

  drawInfoGrid(doc, [
    ['Vessel Name', data.vesselName],
    ['Voyage No', data.nomId],
    ['Charterer', data.chartererName],
    ['Charter Party Date', data.cpDate],
    ['Cargo', data.cargoName],
    ['Load / Disch Ports', portsSummary],
    ['Commercial Ops', data.companyEmail || 'ops@progressshipping.com'],
    ['Broker / Ref', refCode],
  ]);

  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('PORT ROTATION');
  doc.moveDown(0.25);
  const rotation = (data.portRotation || []).length
    ? data.portRotation
    : [{ port: portLabel, event: 'Load / Discharge', eta: data.etaDate1, agent: data.agentName }];
  drawSimpleTable(
    doc,
    ['Port / Location', 'Event / Operation', 'Est. Arrival', 'Agent Appointed'],
    rotation.map((row) => [row.port, row.event, row.eta, row.agent]),
  );

  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('CARGO SPECS AND INSTRUCTIONS');
  doc.moveDown(0.25);
  const specs = (data.cargoSpecs || []).length
    ? data.cargoSpecs
    : [
      { label: 'Cargo Grade', value: data.cargoName },
      { label: 'Quantity & Tolerance', value: [data.qty ? `${data.qty} Metric Tons` : '', data.tolerance ? `(+/- ${data.tolerance})` : ''].filter(Boolean).join(' ') },
      { label: 'Cargo Details', value: data.cargoDetails },
    ].filter((row) => String(row.value || '').trim());
  drawSpecTable(doc, specs.length ? specs : [{ label: 'Cargo details', value: data.cargoName }]);

  ensureSpace(doc, 120);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(AMBER).text('OPERATIONAL AND REPORTING INSTRUCTIONS');
  doc.moveDown(0.25);
  drawOpsBox(doc, data.opsInstructions || []);

  drawSignOff(doc, data);
  drawGenBy(doc);
}

function drawNominationBody(doc, data) {
  const contact = firstContact(data);
  const portKind = String(data.portType || '').toUpperCase().startsWith('DP') ? 'discharge' : 'load';
  para(doc, `To : ${data.agentName || '-'}${data.portName ? ` (${data.portName})` : ''}`
    + `${contact.name || contact.email ? ` / att. ${[contact.name, contact.email ? `(${contact.email})` : ''].filter(Boolean).join(' ')}` : ''}`);
  if (data.nomId) para(doc, `Nom ID : ${data.nomId}`);
  doc.moveDown(0.2);
  para(doc, 'Good day,');
  para(
    doc,
    `We are glad to appoint you as our agents for handling cargo operations for subject vessel,`
    + ` which shows ETA on/around ${data.etaDate1 || '_____________'} IAGW.`,
  );
  para(
    doc,
    `Vessel expected to ${portKind} about ${data.qty || '____'} MTS (subject to master's stow plan) of `
    + `${data.cargoName || 'cargo'} in Bulk at the port of ${data.portName || '-'}.`,
  );
  if (data.cargoDetails) para(doc, `Cargo packing / details: ${data.cargoDetails}`);
  if (data.tolerance) para(doc, `Tolerance: ${data.tolerance}%`);
  if (data.masterName) para(doc, `Master / terms: ${data.masterName}`);
  if (data.shipOwnerName) {
    doc.moveDown(0.2);
    para(doc, 'Owners / Disponent Owners:', { bold: true, gap: 0.2 });
    para(doc, data.shipOwnerName, { gap: 0.15 });
    if (data.shipOwnerPerson) para(doc, data.shipOwnerPerson, { gap: 0.15 });
    if (data.shipOwnerAddress) para(doc, data.shipOwnerAddress, { gap: 0.15 });
    if (data.shipOwnerPhone) para(doc, data.shipOwnerPhone, { gap: 0.15 });
    if (data.shipOwnerEmail) para(doc, data.shipOwnerEmail, { gap: 0.15 });
  }
  para(doc, 'Best regards,');
  doc.moveDown(0.3);
  para(doc, data.contactPerson || 'Operations', { bold: true, gap: 0.2 });
  if (data.companyName) para(doc, data.companyName, { gap: 0.15 });
  drawAgentLoginCredentials(doc, data);
}

function drawBunkerAgentBody(doc, data) {
  const bunkerPort = data.bunkeringPort || data.portName || '';
  const eta = data.etaDate && data.etaDate !== '00:00' ? data.etaDate : '00:00';
  const v = data.vessel || {};
  const biz = String(v.businessTypeId || '');

  para(doc, `Letter to Agents for ${data.vesselName || '-'} at ${bunkerPort} for bunkering`, {
    bold: true,
    align: 'center',
    size: 11,
    gap: 0.55,
  });

  para(doc, 'To :', { gap: 0.15 });
  para(doc, data.agentName || '-', { gap: 0.12 });
  (data.agentAddressLines || []).forEach((line) => para(doc, line, { gap: 0.08 }));
  if (data.agentStreet2) para(doc, data.agentStreet2, { gap: 0.12 });

  para(doc, 'From :', { gap: 0.2 });
  para(doc, data.companyName || '-', { gap: 0.25 });
  para(doc, 'Good day,', { gap: 0.3 });
  para(
    doc,
    `As owners/disponent owners of the captioned vessel, we are pleased to consign the vessel to your agency during her bunker supply at ${bunkerPort}. Vessel ETA at ${bunkerPort} around ${eta} LT.`,
  );
  para(doc, '1)Please declare the vessel to port and contact master for pre-arrival formalities without delay.');
  para(doc, '2) Vessel particulars are stated below:');

  kv(doc, 'VESSEL NAME', String(data.vesselName || '').toUpperCase());
  kv(doc, 'FLAG', String(v.flag || '').toUpperCase());
  kv(doc, 'CLASS', String(v.classSoc || '').toUpperCase());
  kv(doc, 'BUILT (WHEN/WHERE)', `${v.yearBuilt || ''}/${String(v.builtWhere || '').toUpperCase()}`);
  kv(doc, 'IMO NUMBER', v.imoNo || '');
  kv(doc, 'PORT OF REGISTRY', String(v.portOfRegistry || '').toUpperCase());
  kv(
    doc,
    'SUMMER: DEADWEIGHT / DISPLACEMENT / DRAFT / TPC',
    `${v.dwt || ''} MT / ${v.displacement || ''} MT / ${v.draft || ''} M / ${v.tpc || ''} MT`,
  );
  if (biz === '3') {
    kv(doc, 'CARGO HOLD CAPACITY (GRAINS)', `${v.grain || ''} MT`);
    kv(doc, 'NO.OF HOLDS / NO. OF HATCHES', `${v.noh || ''}/${v.noha || ''}`);
  }
  if (biz === '1') {
    kv(doc, 'CARGO TANK CAPACITY (98PCT)', `${v.cargoTankCapacity || ''} CBM`);
  }
  if (biz === '2') {
    kv(doc, 'CARGO TANK CAPACITY (TANKER)', `${v.cargoTankCapacity || ''} CBM`);
    kv(doc, 'NO. OF CARGO PUMPS / NO. OF GRADES(DOUBLE V/V SEG)', `${v.cargoPumps || ''}/${v.noOfGrades || ''}`);
  }
  kv(doc, 'GROSS TONNAGE', v.grt || '');
  kv(doc, 'NET TONNAGE', v.nrt || '');
  kv(doc, 'PANAMA TONNAGE', v.panamaGt || '');
  kv(doc, 'SUEZ CANAL TONNAGE', v.suezGt || '');
  kv(doc, 'LENGTH (O.A.)', `${v.loa || ''} M`);
  kv(doc, 'LENGTH (P.P)', `${v.lbp || ''} M`);
  kv(doc, 'BREADTH(MLD.)', `${v.breadth || ''} M`);
  kv(doc, 'DEPTH (MLD.)', `${v.depth || ''} M`);

  doc.moveDown(0.15);
  para(doc, 'Vsl communication details:', { gap: 0.18 });
  kv(doc, 'CALL SIGN', v.callSign || '');
  if (biz === '3' && v.mmsi) kv(doc, 'MMSI NO', v.mmsi);
  kv(doc, 'E-MAIL', v.email || '');
  if (biz === '1' || biz === '2') {
    kv(doc, 'INM-F TEL', [v.phone, v.telex].filter(Boolean).join('/') || '');
  } else {
    kv(doc, 'INM-F TEL', v.telex || v.phone || '');
  }
  kv(doc, 'INM-F FAX', v.fax || '');
  if (biz === '3' && v.inmarsat) kv(doc, 'INM-C', v.inmarsat);

  doc.moveDown(0.15);
  para(doc, '3) Please contact vessel master directly for regular updates on ETA. Keep us in copy.');
  para(doc, 'Bunker supply details', { bold: true, gap: 0.2 });
  drawBunkerTable(doc, data.bunkers || []);

  para(doc, '4) Notices: Once bunker supplier details are received, please send relevant notices to bunker suppliers with copy to us. The barge schedule and activity should also be shared with us regularly.');
  para(doc, `5)Please appoint bunker surveyor stated below at ${bunkerPort} Our operations department will contact the surveyor for necessary guidelines.`);
  para(doc, `  Bunker Surveyor (Name) :${data.bunkerSurveyor || ''}`, { gap: 0.12 });
  para(doc, `  Bunker Surveyor (Company and Contact) :${data.bunkerSurveyorCom || ''}`, { gap: 0.22 });
  para(doc, '6) Please advise bunker survey fees in the PDA/FDA submission.');
  para(doc, '7) Please send all bunker related vouchers, receipts and survey report to our operations department, within 30 days. Meanwhile, PDFs of these to be sent to us via email, upon completion.');
  para(doc, '8) Details of boarding officer, if any, to be shared with us.');
  para(doc, 'Please confirm safe receipt of our message by return email.');
  para(doc, 'Many thanks and we look forward to a speedy and cost-effective turnaround of the vessel under your agency.');
  para(doc, 'Kind regards,');
  para(doc, data.companyName || '-', { bold: true });
  drawAgentLoginCredentials(doc, data);
}

function drawBunkerMasterBody(doc, data) {
  para(doc, `To : Master of ${data.vesselName || 'M/V ________'}`);
  para(doc, `From : ${data.companyName || '-'}`);
  if (data.portName) para(doc, `Port : ${data.portName}`);
  doc.moveDown(0.2);
  para(doc, 'Good day, Captain,');
  para(doc, `Re. ${String(data.vesselName || '').toUpperCase() || '-'} — Bunker Stemmed`, { bold: true });
  para(
    doc,
    `Please be advised that bunkers have been stemmed for your good vessel`
    + `${data.portName ? ` at ${data.portName}` : ''}.`,
  );
  if (data.etaDate) para(doc, `ETA : ${data.etaDate}`);
  doc.moveDown(0.2);
  para(doc, 'Bunker stemmed details:', { bold: true, gap: 0.25 });
  const bunkers = data.bunkers?.length ? data.bunkers : [{ grade: '-', supplier: '-', physical: '-', quantity: '-', bunkerPort: '-' }];
  bunkers.forEach((row, index) => {
    para(doc, `${index + 1}. Grade: ${row.grade || '-'}  |  Qty: ${row.quantity || '-'} MT`, { gap: 0.1 });
    para(doc, `   Supplier: ${row.supplier || '-'}  |  Physical: ${row.physical || '-'}`, { gap: 0.1 });
    if (row.bunkerPort) para(doc, `   Bunker port: ${row.bunkerPort}`, { gap: 0.2 });
  });
  if (data.bunkerSurveyor) para(doc, `Bunker surveyor: ${data.bunkerSurveyor}`);
  para(doc, 'Best regards,');
  doc.moveDown(0.3);
  para(doc, data.contactPerson || 'Operations', { bold: true, gap: 0.2 });
  if (data.companyName) para(doc, data.companyName, { gap: 0.15 });
}

function mockPdfData(genAgencyId, opts = {}) {
  return {
    genAgencyId,
    portType: opts.portType || 'LP',
    portName: opts.portName || 'Care-Houston',
    countryName: 'USA',
    vesselName: 'POLYAIGOS',
    nomId: '26-012',
    chartererName: 'PetroTrade International Pte Ltd',
    cpDate: '15 August 2026',
    vessel: {
      loa: '225', breadth: '32.2', draft: '14.5', dwt: '82000', grt: '7041', nrt: '',
      flag: 'Liberia', classSoc: 'LR', yearBuilt: '2010', builtWhere: 'JAPAN/YARD',
      imoNo: '1234567', portOfRegistry: 'Monrovia', displacement: '95000', tpc: '65',
      cargoTankCapacity: '90000', cargoPumps: '3', noOfGrades: '6',
      panamaGt: '44000', suezGt: '43000', lbp: '215', depth: '20.5',
      callSign: 'ABCD', email: 'master@vessel.example', phone: '870771234', telex: '870771235',
      fax: '870771236', businessTypeId: '2',
    },
    bunkeringPort: 'Kukup / Tanjung Piai(Malaysia)',
    agentName: 'Barwil Agencies',
    agentAddressLines: ['12 Marina View', 'Asia Square Tower 2'],
    agentStreet2: 'OPERATIONS E-MAIL: ops@example.com',
    username: 'ZAF/003/68637',
    password: 'PDA26012',
    etaDate: '12-08-2026 08:00',
    etaDate1: '05 Sep 2026',
    qty: '36000',
    tolerance: '5%',
    cargoName: 'Arabian Heavy Crude',
    cargoDetails: 'Arabian Heavy Crude (H2S content < 10 ppm, Inerted tanks required)',
    cargoSpecs: [
      { label: 'Cargo Grade', value: 'Arabian Heavy Crude (H2S content < 10 ppm, Inerted tanks required)' },
      { label: 'Quantity & Tolerance', value: "36,000 Metric Tons (+/- 5% Owner's option, declared at loadport)" },
      { label: 'Temperature Req', value: 'Load Temp: Min 35°C | Maintain Temp: 40°C - 45°C during voyage | Voyage Heating: Steam on coils as required.' },
      { label: 'Max Allowable Draft', value: 'Loadport max draft: 12.4m SW | Dischport max draft: 11.8m brackish.' },
    ],
    opsInstructions: [
      'Proceed to RAS TANRAH, SAUDI ARABIA, full speed and arrive on 20 Oct 2026, 0900 and tender NOR.',
      'Letter of Protest (LOP): Issue immediate LOP if cargo temperature drops below 38°C or if shore facility delays manifold connection by more than 2 hours.',
      'BDR & Samples: Retain 4x composite cargo samples sealed jointly with independent surveyor. Ensure bunker delivery notes (BDNs) are signed “under protest” if density/viscosity discrepancies arise.',
      'NOON Reports: Transmit daily at 1200 UTC including current bunker inventory, RPM, slip, weather conditions, and ETA updates to ops@progressshipping.com.',
    ],
    portsSummary: 'Care-Houston, USA / New Orleans, USA',
    portRotation: [
      { port: 'Care-Houston, USA', event: 'Load Cargo (36,000 MT Arabian Heavy Crude)', eta: '05 Sep 2026', agent: 'Barwil Agencies' },
      { port: 'New Orleans, USA', event: 'Discharge', eta: '20 Oct 2026', agent: '—' },
    ],
    companyName: 'Progress Shipping',
    companyAddress: 'Singapore',
    companyPhone: '+65 6123 4567',
    companyEmail: 'ops@progressshipping.com',
    companyWebsite: 'www.sevenoceans.world',
    agentLoginUrl: 'https://zafira.sevenoceans.net.in/login',
    contactPerson: 'Rachel Zane',
    bunkerSurveyor: 'John Surveyor',
    bunkerSurveyorCom: 'Survey Co / +65 1234',
    bunkers: [
      { grade: 'VLSFO 0.5%', supplier: 'Supplier A', physical: 'Physical A', quantity: '500' },
      { grade: 'LSMGO', supplier: 'Supplier B', physical: 'Physical B', quantity: '100' },
    ],
    entities: [],
  };
}

/**
 * Port-related letter PDFs — PDA / Voyage match Platform letter references;
 * nomination & bunker keep legacy PHP-style bodies.
 */
export async function generateAgencyLetterPdf(genAgencyId, opts = {}) {
  const type = String(opts.type || 'pda').toLowerCase();
  if (!LETTER_TITLES[type]) {
    const error = new Error('Unknown agency letter PDF type.');
    error.status = 400;
    throw error;
  }

  const data = isDbConfigured()
    ? await dbGetAgencyLetterForPdf(genAgencyId, opts)
    : mockPdfData(genAgencyId, opts);

  const title = LETTER_TITLES[type];
  const { doc, chunks } = createDocument(title);
  const styled = type === 'pda' || type === 'voyage';

  if (!styled) {
    if (type !== 'agent-bunker') {
      drawLegacyHeader(doc, title);
    } else {
      const top = doc.y;
      drawHeaderLogo(doc, top);
      doc.y = top + 62;
      doc.x = leftX(doc);
      doc.moveTo(leftX(doc), doc.y)
        .lineTo(leftX(doc) + usableWidth(doc), doc.y)
        .strokeColor('#b1afaf')
        .stroke();
      doc.moveDown(0.6);
    }
  }

  if (type === 'pda') drawPdaBody(doc, data);
  else if (type === 'voyage') drawVoyageBody(doc, data);
  else if (type === 'nomination') drawNominationBody(doc, data);
  else if (type === 'agent-bunker') drawBunkerAgentBody(doc, data);
  else drawBunkerMasterBody(doc, data);

  if (styled) drawPlatformFooter(doc, data);
  else {
    // legacy footer strip
    const left = leftX(doc);
    const width = usableWidth(doc);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 28;
    const y0 = doc.page.height - 58;
    if (doc.y <= y0 - 12) {
      doc.moveTo(left, y0 - 8).lineTo(left + width, y0 - 8).strokeColor('#b1afaf').stroke();
      doc.x = left;
      doc.y = y0;
      doc.font('Helvetica').fontSize(8).fillColor('#1b77a6');
      [
        data.companyAddress,
        [data.companyPhone ? `Tel: ${data.companyPhone}` : '', data.companyEmail ? `email: ${data.companyEmail}` : ''].filter(Boolean).join('  '),
        data.companyWebsite || '',
      ].filter(Boolean).forEach((line) => {
        doc.text(line, { width, align: 'center', lineGap: 1 });
      });
    }
    doc.page.margins.bottom = savedBottom;
  }

  const buffer = await finish(doc, chunks);
  const today = new Date();
  const dmy = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
  const filename = type === 'agent-bunker'
    ? `Letter to Agents - Bunker Stemmed ( ${safeFilename(data.vesselName || 'Vessel')} - ${safeFilename(data.agentName || 'Agent')} ) ${dmy}.pdf`
    : type === 'voyage'
      ? `Voyage_Instructions_Letter_${safeFilename(data.portName || 'Port')}.pdf`
      : type === 'pda'
        ? `PDA_Request_Letter_${safeFilename(data.portName || 'Port')}.pdf`
        : `${safeFilename(title)}-${safeFilename(data.vesselName || 'Vessel')}-${genAgencyId}.pdf`;
  return { buffer, filename };
}
