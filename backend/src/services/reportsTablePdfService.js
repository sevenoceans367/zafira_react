import PDFDocument from 'pdfkit';

const BLUE = '#3c8dbc';
const BORDER = '#D7E1E6';
const TEXT = '#24313A';
const HEADER_BG = '#E8EEF2';

function value(input) {
  return input == null || input === '' ? '' : String(input);
}

function safeFilename(input) {
  return String(input || 'Report').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function createDocument(title) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 28, right: 18, bottom: 28, left: 18 },
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

function measureHeight(doc, text, width, fontSize = 7) {
  return Math.min(
    Math.max(
      doc.heightOfString(value(text), { width: Math.max(width - 6, 16), fontSize }) + 8,
      16,
    ),
    56,
  );
}

/**
 * Generic landscape table PDF for report exports.
 * payload: { title, filename, columns:[{key,label}], rows:[{...}] }
 */
export async function generateReportTablePdf(payload = {}) {
  const title = value(payload.title) || 'Report';
  const columns = Array.isArray(payload.columns) ? payload.columns : [];
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (!columns.length) {
    const error = new Error('No columns to export.');
    error.status = 400;
    throw error;
  }

  const { doc, chunks } = createDocument(title);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / columns.length;
  const left = doc.page.margins.left;

  doc.font('Helvetica-Bold').fontSize(13).fillColor(BLUE).text(title, { align: 'center' });
  doc.moveDown(0.5);

  const drawHeader = () => {
    let x = left;
    const y = doc.y;
    const height = 20;
    columns.forEach((col) => {
      doc.rect(x, y, colWidth, height).fillAndStroke(HEADER_BG, BORDER);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(TEXT)
        .text(value(col.label), x + 3, y + 5, { width: colWidth - 6, height: height - 6 });
      x += colWidth;
    });
    doc.y = y + height;
  };

  drawHeader();

  for (const row of rows) {
    const cells = columns.map((col) => value(row?.[col.key]));
    const height = Math.max(...cells.map((cell) => measureHeight(doc, cell, colWidth)), 16);

    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }

    let x = left;
    const y = doc.y;
    cells.forEach((cell) => {
      doc.rect(x, y, colWidth, height).fillAndStroke('#FFFFFF', BORDER);
      doc.font('Helvetica').fontSize(7).fillColor(TEXT)
        .text(cell, x + 3, y + 3, { width: colWidth - 6, height: height - 6 });
      x += colWidth;
    });
    doc.y = y + height;
  }

  const buffer = await finish(doc, chunks);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = safeFilename(payload.filename || title);
  return {
    buffer,
    filename: `${base}-${stamp}.pdf`,
  };
}
