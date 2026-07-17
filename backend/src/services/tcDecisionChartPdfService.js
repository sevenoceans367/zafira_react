import PDFDocument from 'pdfkit';
import { getTcDecisionChartDetails, listTcDecisionCharts } from './tcEstimateService.js';

const BLUE = '#1B77A6';
const BORDER = '#D7E1E6';
const TEXT = '#24313A';

function value(input) {
  return input == null || input === '' ? '—' : String(input);
}

function safeFilename(input) {
  return String(input || 'TC Decision Charts').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function createDocument(title, landscape = false) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: landscape ? 'landscape' : 'portrait',
    margins: { top: 42, right: 30, bottom: 38, left: 30 },
    info: { Title: title, Author: 'Zafira' },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  return { doc, chunks };
}

function drawTitle(doc, title) {
  doc.font('Helvetica-Bold').fontSize(15).fillColor(BLUE).text(title, { align: 'center' });
  doc.moveDown(0.7);
}

function drawTable(doc, headers, rows, widths) {
  const left = doc.page.margins.left;
  const rowHeight = 27;
  const headerHeight = 28;

  const drawHeader = () => {
    let x = left;
    const y = doc.y;
    headers.forEach((header, index) => {
      doc.rect(x, y, widths[index], headerHeight).fillAndStroke(BLUE, BLUE);
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF')
        .text(header, x + 4, y + 6, { width: widths[index] - 8, height: headerHeight - 8 });
      x += widths[index];
    });
    doc.y = y + headerHeight;
  };

  drawHeader();
  rows.forEach((row) => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    let x = left;
    const y = doc.y;
    row.forEach((cell, index) => {
      doc.rect(x, y, widths[index], rowHeight).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(7).fillColor(TEXT)
        .text(value(cell), x + 4, y + 5, { width: widths[index] - 8, height: rowHeight - 7 });
      x += widths[index];
    });
    doc.y = y + rowHeight;
  });
}

function finish(doc, chunks) {
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

async function loadAllCharts() {
  const first = await listTcDecisionCharts({ page: 1, pageSize: 100 });
  const records = [...(first.records || [])];
  const pages = Math.ceil(Number(first.recordsTotal || 0) / 100);
  for (let page = 2; page <= pages; page += 1) {
    const next = await listTcDecisionCharts({ page, pageSize: 100 });
    records.push(...(next.records || []));
  }
  return records;
}

export async function generateTcDecisionChartsPdf() {
  const records = await loadAllCharts();
  const { doc, chunks } = createDocument('TC Decision Chart List', true);
  drawTitle(doc, 'TC DECISION CHART LIST');
  drawTable(
    doc,
    ['#', 'Decision Chart', 'Chart No.', 'TC No.', 'Vessel', 'Del / Redel Port', 'Add On Date', 'Added By'],
    records.map((row, index) => [
      index + 1,
      row.message,
      row.messageNo,
      row.tcNo,
      row.vesselName,
      row.ports,
      row.addOnDate,
      row.addedBy,
    ]),
    [28, 76, 58, 75, 125, 145, 75, 90],
  );
  return {
    buffer: await finish(doc, chunks),
    filename: 'TC Decision Chart List.pdf',
  };
}

export async function generateTcDecisionChartPdf(message) {
  const chart = await getTcDecisionChartDetails(message);
  if (!chart) return null;
  const { doc, chunks } = createDocument(`TC Decision Chart ${chart.message}`, true);
  drawTitle(doc, `TC DECISION CHART ${chart.message}`);
  drawTable(
    doc,
    ['#', 'Vessel', 'Type', 'TC No.', 'CP Date', 'DWT', 'Del Port', 'Redel Port', 'TC Days', 'Daily Hire', 'Total Rev', 'Status', 'Remarks', 'Final'],
    chart.fixtures.map((row, index) => [
      index + 1,
      row.vesselName,
      row.vesselType,
      row.tcNo,
      row.cpDate,
      row.dwt,
      row.delPort,
      row.reDelPort,
      row.tcDays,
      row.dailyGrossHire,
      row.totalRev,
      row.status,
      row.remarks,
      row.isFinal ? 'Yes' : '',
    ]),
    [22, 74, 55, 58, 52, 48, 66, 66, 42, 57, 60, 52, 85, 32],
  );
  return {
    buffer: await finish(doc, chunks),
    filename: `${safeFilename(`TC Decision Chart ${chart.message}`)}.pdf`,
  };
}
