import PDFDocument from 'pdfkit';

const BLUE = '#3c8dbc';
const BORDER = '#D7E1E6';
const TEXT = '#24313A';
const HEADER_BG = '#E8EEF2';
const SECTION_BG = '#F3F7FB';

function value(input) {
  return input == null || input === '' ? '—' : String(input);
}

function safeFilename(input) {
  return String(input || 'Compare-Vessels').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
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
    64,
  );
}

/**
 * PDF for fleet Compare Vessels (PHP allPdf.php?id=56).
 * payload: { vessels:[{id,name}], sections:[{title, rows:[{label, values}]}] }
 */
export async function generateFleetComparePdf(payload = {}) {
  const vessels = Array.isArray(payload.vessels) ? payload.vessels : [];
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  const title = 'Compare Vessels';

  if (!vessels.length) {
    const error = new Error('No vessels to export.');
    error.status = 400;
    throw error;
  }

  const { doc, chunks } = createDocument(title);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = Math.min(220, pageWidth * 0.28);
  const valueWidth = (pageWidth - labelWidth) / vessels.length;
  const left = doc.page.margins.left;

  doc.font('Helvetica-Bold').fontSize(13).fillColor(BLUE).text(title, { align: 'center' });
  doc.moveDown(0.45);

  const drawHeader = () => {
    let x = left;
    const y = doc.y;
    const height = 22;
    doc.rect(x, y, labelWidth, height).fillAndStroke(HEADER_BG, BORDER);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(TEXT)
      .text('Vessel Name / Commercial Parameters', x + 3, y + 6, {
        width: labelWidth - 6,
        height: height - 8,
      });
    x += labelWidth;
    vessels.forEach((vessel) => {
      doc.rect(x, y, valueWidth, height).fillAndStroke(HEADER_BG, BORDER);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(TEXT)
        .text(value(vessel.name), x + 3, y + 6, { width: valueWidth - 6, height: height - 8 });
      x += valueWidth;
    });
    doc.y = y + height;
  };

  drawHeader();

  const ensureSpace = (height) => {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
  };

  for (const section of sections) {
    if (section.title) {
      const height = 18;
      ensureSpace(height);
      const y = doc.y;
      doc.rect(left, y, pageWidth, height).fillAndStroke(SECTION_BG, BORDER);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE)
        .text(section.title, left + 4, y + 5, { width: pageWidth - 8 });
      doc.y = y + height;
    }

    for (const row of section.rows || []) {
      const cells = [row.label, ...(row.values || [])];
      const heights = [
        measureHeight(doc, cells[0], labelWidth),
        ...cells.slice(1).map((cell) => measureHeight(doc, cell, valueWidth)),
      ];
      const height = Math.max(...heights, 16);
      ensureSpace(height);

      let x = left;
      const y = doc.y;
      doc.rect(x, y, labelWidth, height).fillAndStroke('#FFFFFF', BORDER);
      doc.font('Helvetica').fontSize(7).fillColor(TEXT)
        .text(value(cells[0]), x + 3, y + 3, { width: labelWidth - 6, height: height - 6 });
      x += labelWidth;

      cells.slice(1).forEach((cell) => {
        doc.rect(x, y, valueWidth, height).fillAndStroke('#FFFFFF', BORDER);
        doc.font('Helvetica').fontSize(7).fillColor(TEXT)
          .text(value(cell), x + 3, y + 3, { width: valueWidth - 6, height: height - 6 });
        x += valueWidth;
      });
      doc.y = y + height;
    }
  }

  const buffer = await finish(doc, chunks);
  const stamp = new Date().toISOString().slice(0, 10);
  const names = vessels.map((v) => safeFilename(v.name || v.id)).join('_').slice(0, 80);
  return {
    buffer,
    filename: `Compare-Vessels-${names || 'export'}-${stamp}.pdf`,
  };
}
