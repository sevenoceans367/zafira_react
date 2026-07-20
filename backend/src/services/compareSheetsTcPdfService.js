import PDFDocument from 'pdfkit';
import { getCompareSheetsTc } from './compareSheetsTcService.js';

const BLUE = '#3c8dbc';
const FIXTURE = '#cce6ff';
const BORDER = '#D7E1E6';
const TEXT = '#24313A';

function value(input) {
  return input == null || input === '' ? '' : String(input);
}

function safeFilename(input) {
  return String(input || 'Compare-Sheet-Tc').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function createDocument(title) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 36, right: 24, bottom: 32, left: 24 },
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

function drawHeaderBlock(doc, data) {
  const h = data.header;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(BLUE).text('TC - COMPARE SHEETS', { align: 'center' });
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9).fillColor(TEXT);
  const lines = [
    `Vessel: ${value(h.vesselName)}   Type: ${value(h.vesselType)}   DWT: ${value(h.dwtSummer)}`,
    `Fixture Date: ${value(h.fixtureDate)}   CP Date: ${value(h.cpDate)}   TC No: ${value(h.tcNo)}`,
  ];
  lines.forEach((line) => doc.text(line, { align: 'center' }));
  doc.moveDown(0.8);
}

function drawCompareTable(doc, data) {
  const sheetCount = data.sheets.length;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const paramWidth = Math.min(150, pageWidth * 0.18);
  const diffWidth = 58;
  const progWidth = 58;
  const sheetWidth = (pageWidth - paramWidth - diffWidth - progWidth) / Math.max(sheetCount, 1);
  const widths = [paramWidth, ...Array(sheetCount).fill(sheetWidth), diffWidth, progWidth];

  const headers = [
    'Parameters',
    ...data.sheets.map((s) => s.name),
    'Diff.',
    'Progressive',
  ];

  const left = doc.page.margins.left;
  const rowHeight = 20;
  const headerHeight = 22;

  const drawTableHeader = () => {
    let x = left;
    const y = doc.y;
    headers.forEach((header, index) => {
      const fill = index > 0 && index <= sheetCount
        ? (data.sheets[index - 1]?.isFixture ? FIXTURE : BLUE)
        : '#E8EEF2';
      const textColor = index > 0 && index <= sheetCount && !data.sheets[index - 1]?.isFixture
        ? '#FFFFFF'
        : TEXT;
      doc.rect(x, y, widths[index], headerHeight).fillAndStroke(fill, BORDER);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(textColor)
        .text(header, x + 3, y + 5, { width: widths[index] - 6, height: headerHeight - 6 });
      x += widths[index];
    });
    doc.y = y + headerHeight;
  };

  const drawRow = (cells, { bold = false, section = false } = {}) => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawTableHeader();
    }
    let x = left;
    const y = doc.y;
    const height = section ? 18 : rowHeight;
    cells.forEach((cell, index) => {
      let fill = '#FFFFFF';
      if (section) fill = '#F3F6FA';
      else if (index > 0 && index <= sheetCount) {
        fill = data.sheets[index - 1]?.isFixture ? FIXTURE : BLUE;
      }
      const textColor = !section && index > 0 && index <= sheetCount && !data.sheets[index - 1]?.isFixture
        ? '#FFFFFF'
        : TEXT;
      doc.rect(x, y, widths[index], height).fillAndStroke(fill, BORDER);
      doc.font(bold || section ? 'Helvetica-Bold' : 'Helvetica').fontSize(section ? 8 : 7).fillColor(textColor)
        .text(value(cell), x + 3, y + 4, { width: widths[index] - 6, height: height - 6 });
      x += widths[index];
    });
    doc.y = y + height;
  };

  drawTableHeader();

  let currentSection = '';
  for (const row of data.rows) {
    if (row.section && row.section !== currentSection) {
      currentSection = row.section;
      const sectionCells = [row.section, ...Array(sheetCount + 2).fill('')];
      drawRow(sectionCells, { section: true });
    }
    drawRow([row.label, ...row.values, row.difference, row.progressive]);
  }

  drawRow(['P/L Difference', ...Array(sheetCount).fill(''), data.plDifference, ''], { bold: true });
  drawRow(['Actual P/L (Calculated - Difference)', ...Array(sheetCount).fill(''), data.actualPl, ''], { bold: true });
}

export async function generateCompareSheetsTcPdf(comId) {
  const data = await getCompareSheetsTc(comId);
  const title = `Compare Sheets TC ${data.header.tcNo || comId}`;
  const { doc, chunks } = createDocument(title);
  drawHeaderBlock(doc, data);
  drawCompareTable(doc, data);
  const buffer = await finish(doc, chunks);
  const filename = `${safeFilename(data.header.tcNo || `COM-${comId}`)}-Compare-Sheet-Tc.pdf`;
  return { buffer, filename };
}
