import PDFDocument from 'pdfkit';

const COLORS = {
  navy: '#274670',
  navyTint: '#E6EAF1',
  navyTintStrong: '#D3DAE7',
  navyTintPale: '#F1F3F7',
  orange: '#F4652C',
  orangeStrong: '#FBD9C9',
  orangePale: '#FEF6F1',
  blue: '#3B82F6',
  blueTint: '#EAF1FE',
  blueStrong: '#D3E3FD',
  purple: '#6C47FF',
  purplePale: '#F7F4FF',
  purpleStrong: '#DED4FF',
  brown: '#8B5E3C',
  brownPale: '#FAF6F2',
  brownStrong: '#E9D8C6',
  line: '#ECEEF2',
  lineStrong: '#D8DCE3',
  textDark: '#1B2733',
  textMid: '#57626F',
  textLight: '#8A93A0',
  green: '#0B7A28',
  greenTint: '#E8F8EC',
  red: '#C22A20',
  redTint: '#FFECEB',
  fieldGrey: '#F1F2F4',
  fieldBorder: '#E4E6E9',
  white: '#FFFFFF',
};

const THEMES = [
  { color: COLORS.navy, pale: COLORS.navyTintPale, strong: COLORS.navyTintStrong },
  { color: COLORS.orange, pale: COLORS.orangePale, strong: COLORS.orangeStrong },
  { color: COLORS.blue, pale: COLORS.blueTint, strong: COLORS.blueStrong },
  { color: COLORS.purple, pale: COLORS.purplePale, strong: COLORS.purpleStrong },
  { color: COLORS.brown, pale: COLORS.brownPale, strong: COLORS.brownStrong },
];

export function value(input) {
  return input == null || input === '' ? '' : String(input);
}

export function safeFilename(input) {
  return String(input || 'Compare-Sheets').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function createDocument(title) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 28, right: 28, bottom: 28, left: 28 },
    info: { Title: title, Author: 'Seven Oceans' },
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

function isFixtureSheet(sheet) {
  return Boolean(sheet?.isFvf || sheet?.isFixture);
}

function groupRows(rows = []) {
  const groups = [];
  const seen = new Map();
  (rows || []).forEach((row) => {
    const section = row.section || 'Parameters';
    if (!seen.has(section)) {
      seen.set(section, groups.length);
      groups.push({ section, rows: [] });
    }
    groups[seen.get(section)].rows.push(row);
  });
  return groups;
}

function drawRoundedRect(doc, x, y, w, h, r, fill, stroke) {
  doc.save();
  if (fill) doc.fillColor(fill);
  if (stroke) doc.strokeColor(stroke);
  doc.roundedRect(x, y, w, h, r);
  if (fill && stroke) doc.fillAndStroke();
  else if (fill) doc.fill();
  else doc.stroke();
  doc.restore();
}

function ensureSpace(doc, needed, onNewPage) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    if (onNewPage) onNewPage();
  }
}

function drawHeader(doc, pageWidth, left, title) {
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.textLight)
    .text('SEVEN OCEANS PREFIXTURE PLATFORM', left, doc.y, { characterSpacing: 1.2 });
  doc.moveDown(0.35);
  const titleY = doc.y;
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.navy)
    .text(title, left, titleY);

  const logoX = left + pageWidth - 90;
  doc.circle(logoX + 12, titleY + 8, 11).strokeColor(COLORS.navy).lineWidth(1.2).stroke();
  doc.circle(logoX + 12, titleY + 8, 7.5).strokeColor(COLORS.orange).lineWidth(1.4).stroke();
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.navy)
    .text('S', logoX + 8.5, titleY + 3.5);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy)
    .text('SEVEN', logoX + 28, titleY);
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.textLight)
    .text('OCEANS', logoX + 28, titleY + 11, { characterSpacing: 1 });

  doc.y = titleY + 28;
  doc.moveTo(left, doc.y).lineTo(left + pageWidth, doc.y)
    .dash(3, { space: 3 }).strokeColor(COLORS.lineStrong).lineWidth(1).stroke();
  doc.undash();
  doc.moveDown(0.6);
}

function drawOverview(doc, data, headerFields, left, pageWidth, labelW, valueW) {
  const sheets = data.sheets || [];
  const y0 = doc.y;
  drawRoundedRect(doc, left, y0, pageWidth, 18, 4, COLORS.navy, COLORS.navy);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white)
    .text('MAIN PARTICULARS', left + 10, y0 + 5);

  let y = y0 + 26;
  const facts = (headerFields || []).filter((field) => field?.label);
  if (facts.length) {
    const colW = pageWidth / Math.min(facts.length, 6);
    facts.forEach((field, index) => {
      const x = left + (index % 6) * colW;
      const row = Math.floor(index / 6);
      const fy = y + row * 28;
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.textLight)
        .text(String(field.label).toUpperCase(), x + 4, fy, { width: colW - 8 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.textDark)
        .text(value(field.value) || '—', x + 4, fy + 10, { width: colW - 8 });
    });
    y += Math.ceil(facts.length / 6) * 28 + 6;
  }

  const cardH = 42;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textLight)
    .text('SHEETS', left + 4, y + 14);

  sheets.forEach((sheet, index) => {
    const x = left + labelW + index * valueW + 2;
    const tint = index % 2 === 0 ? COLORS.navyTint : COLORS.blueTint;
    const border = index % 2 === 0 ? COLORS.navy : COLORS.blue;
    drawRoundedRect(doc, x, y, valueW - 4, cardH, 6, tint, border);
    drawRoundedRect(doc, x + (valueW - 4) / 2 - 28, y + 5, 56, 11, 2, border, border);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white)
      .text(isFixtureSheet(sheet) ? 'Fixture' : `Sheet ${index + 1}`, x + 4, y + 7, {
        width: valueW - 12,
        align: 'center',
      });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.textDark)
      .text(sheet.name || '—', x + 4, y + 22, { width: valueW - 12, align: 'center' });
  });

  doc.y = y + cardH + 10;
  drawRoundedRect(doc, left, y0, pageWidth, doc.y - y0, 8, null, COLORS.lineStrong);
}

function drawSectionTitle(doc, left, pageWidth, title, color, tintStrong, onNewPage) {
  ensureSpace(doc, 24, onNewPage);
  const y = doc.y;
  doc.roundedRect(left, y + 4, 6, 6, 1).fill(color);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(color)
    .text(title.toUpperCase(), left + 12, y + 2);
  const textW = doc.widthOfString(title.toUpperCase()) + 12;
  doc.moveTo(left + textW + 8, y + 7).lineTo(left + pageWidth, y + 7)
    .dash(2, { space: 2 }).strokeColor(tintStrong).lineWidth(1).stroke();
  doc.undash();
  doc.y = y + 16;
}

function drawDataRow(doc, left, labelW, valueW, colCount, label, values, opts = {}, onNewPage) {
  const fontSize = opts.sub ? 7.5 : 8;
  const cells = [label, ...(values || [])];
  while (cells.length < colCount + 1) cells.push('');
  let maxH = 16;
  cells.forEach((cell, index) => {
    const width = index === 0 ? labelW - 8 : valueW - 10;
    const h = doc.heightOfString(value(cell) || '—', { width: Math.max(width, 20), fontSize });
    maxH = Math.max(maxH, h + 8);
  });
  ensureSpace(doc, maxH + 2, onNewPage);
  const y = doc.y;

  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.sub ? 7.5 : 8.5)
    .fillColor(opts.sub ? COLORS.textLight : COLORS.textMid)
    .text(label, left + 4, y + 4, { width: labelW - 8 });

  values.forEach((cell, index) => {
    const x = left + labelW + index * valueW;
    const empty = cell == null || cell === '';
    const tone = opts.tones?.[index];
    let fill = COLORS.fieldGrey;
    let textColor = empty ? '#A6ADB6' : COLORS.textDark;
    if (tone === 'negative') {
      fill = COLORS.redTint;
      textColor = COLORS.red;
    } else if (tone === 'positive') {
      fill = COLORS.greenTint;
      textColor = COLORS.green;
    } else if (opts.fills?.[index]) {
      fill = opts.fills[index];
    }
    drawRoundedRect(doc, x + 1, y + 1, valueW - 2, maxH - 2, 3, fill, COLORS.fieldBorder);
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(fontSize)
      .fillColor(textColor)
      .text(empty ? '—' : value(cell), x + 4, y + 4, {
        width: valueW - 8,
        align: 'center',
      });
  });

  doc.moveTo(left, y + maxH).lineTo(left + labelW + valueW * colCount, y + maxH)
    .strokeColor(COLORS.line).lineWidth(0.5).stroke();
  doc.y = y + maxH;
}

function drawResults(doc, data, left, pageWidth, labelW, valueW, colCount, onNewPage) {
  ensureSpace(doc, 70, onNewPage);
  const y0 = doc.y + 8;
  drawRoundedRect(doc, left, y0, pageWidth, 18, 4, COLORS.navy, COLORS.navy);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white)
    .text('RESULTS', left + 10, y0 + 5);

  let y = y0 + 24;
  [
    ['P/L Difference', data.plDifference],
    ['Actual P/L (Calculated - Difference)', data.actualPl],
  ].forEach(([label, amount]) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textMid)
      .text(label, left + 6, y + 6, { width: labelW - 8 });
    const x = left + labelW + (colCount - 2) * valueW + 2;
    drawRoundedRect(doc, x, y, valueW - 4, 20, 4, COLORS.navyTintPale, COLORS.navyTintStrong);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy)
      .text(value(amount) || '—', x, y + 5, { width: valueW - 4, align: 'center' });
    y += 26;
  });

  drawRoundedRect(doc, left, y0, pageWidth, y - y0 + 4, 6, null, COLORS.lineStrong);
  doc.y = y + 10;
}

function drawFooter(doc, left, pageWidth) {
  ensureSpace(doc, 36);
  const y = doc.y + 4;
  doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor(COLORS.line).lineWidth(0.8).stroke();
  const stamp = new Date().toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight)
    .text(`Calculated ${stamp} — Zafira Shipping & Trading SA`, left, y + 8);
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textLight)
    .text('Analysed by Seven Oceans  ·  www.sevenoceans.world', left, y + 8, {
      width: pageWidth,
      align: 'right',
    });
  doc.y = y + 28;
}

function sheetFills(sheets) {
  return (sheets || []).map((sheet, index) => (
    isFixtureSheet(sheet)
      ? COLORS.navyTint
      : (index % 2 === 0 ? COLORS.navyTintPale : COLORS.blueTint)
  ));
}

/**
 * Sensitivity Analysis-style Compare Sheets PDF.
 */
export async function renderCompareSheetsPdf(data, {
  title,
  filename,
  headerFields = [],
} = {}) {
  const sheets = data?.sheets || [];
  const { doc, chunks } = createDocument(title);
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const extraCols = 2;
  const colCount = Math.max(sheets.length + extraCols, 1);
  const labelW = Math.min(150, pageWidth * 0.2);
  const valueW = (pageWidth - labelW) / colCount;
  const fills = [...sheetFills(sheets), COLORS.fieldGrey, COLORS.fieldGrey];
  const groups = groupRows(data?.rows);

  const redrawHeader = () => drawHeader(doc, pageWidth, left, title);

  drawHeader(doc, pageWidth, left, title);
  drawOverview(doc, data, headerFields, left, pageWidth, labelW, valueW);

  const headerValues = [
    ...sheets.map((sheet) => sheet.name),
    'Diff.',
    'Progressive',
  ];
  drawDataRow(doc, left, labelW, valueW, colCount, 'Sheet Name / Parameters', headerValues, {
    bold: true,
    fills,
  }, redrawHeader);

  groups.forEach((group, groupIndex) => {
    const theme = THEMES[groupIndex % THEMES.length];
    drawSectionTitle(doc, left, pageWidth, group.section, theme.color, theme.strong, redrawHeader);
    group.rows.forEach((row) => {
      const values = [
        ...(row.values || []),
        row.difference,
        row.progressive,
      ];
      const tones = Array(sheets.length).fill(null).concat([row.differenceTone, null]);
      drawDataRow(doc, left, labelW, valueW, colCount, row.label, values, {
        fills,
        tones,
      }, redrawHeader);
    });
  });

  drawResults(doc, data, left, pageWidth, labelW, valueW, colCount, redrawHeader);
  drawFooter(doc, left, pageWidth);

  const buffer = await finish(doc, chunks);
  return { buffer, filename };
}
