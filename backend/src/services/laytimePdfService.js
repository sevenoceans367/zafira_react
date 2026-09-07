import PDFDocument from 'pdfkit';
import { getLaytimeForm } from './laytimeService.js';

const BLUE = '#1b77a6';
const HEADER_FILL = '#31a0e1';
const YELLOW = '#ede608';
const TEXT = '#111111';
const MUTED = '#444444';

function safeFilename(input) {
  return String(input || 'Laytime-Report').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function num(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '') || '-';
  return n.toFixed(digits);
}

function dash(value) {
  const s = String(value ?? '').trim();
  return s || '-';
}

function createDocument(title) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 36, right: 28, bottom: 36, left: 28 },
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

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function ensureSpace(doc, needed = 40) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function drawBanner(doc, title) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const y = doc.y;
  doc.rect(left, y, width, 18).fill(HEADER_FILL);
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(11)
    .text(title, left, y + 3, { width, align: 'center' });
  doc.y = y + 22;
}

function kvRow(doc, cells) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const colW = width / Math.max(cells.length, 1);
  const y = doc.y;
  let maxH = 12;
  cells.forEach((cell, idx) => {
    const x = left + idx * colW;
    const text = String(cell.text ?? '');
    doc.font(cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(TEXT);
    maxH = Math.max(maxH, doc.heightOfString(text, { width: colW - 4 }));
    doc.text(text, x + 2, y, { width: colW - 4, lineBreak: false });
  });
  doc.y = y + maxH + 3;
}

function tableHeader(doc, columns) {
  ensureSpace(doc, 24);
  const left = doc.page.margins.left;
  const y = doc.y;
  const total = columns.reduce((sum, col) => sum + col.width, 0);
  const scale = contentWidth(doc) / total;
  let x = left;
  doc.rect(left, y, contentWidth(doc), 16).fill(YELLOW);
  columns.forEach((col) => {
    const w = col.width * scale;
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7)
      .text(col.label, x + 2, y + 4, { width: w - 4, align: col.align || 'center' });
    x += w;
  });
  doc.y = y + 18;
  return scale;
}

function tableRow(doc, columns, values, scale) {
  ensureSpace(doc, 18);
  const left = doc.page.margins.left;
  const y = doc.y;
  let x = left;
  let maxH = 11;
  const heights = columns.map((col, idx) => {
    const w = col.width * scale;
    doc.font('Helvetica').fontSize(7).fillColor(TEXT);
    return doc.heightOfString(String(values[idx] ?? ''), { width: w - 4 });
  });
  maxH = Math.max(maxH, ...heights);
  columns.forEach((col, idx) => {
    const w = col.width * scale;
    doc.font('Helvetica').fontSize(7).fillColor(TEXT)
      .text(String(values[idx] ?? ''), x + 2, y, { width: w - 4, align: col.align || 'left' });
    x += w;
  });
  doc.moveTo(left, y + maxH + 2)
    .lineTo(left + contentWidth(doc), y + maxH + 2)
    .strokeColor('#dddddd')
    .stroke();
  doc.y = y + maxH + 4;
}

function renderPort(doc, form, port) {
  const rateUnit = form.rateUnit === 'hrs' ? 'HRS' : 'DAYS';
  const isDetention = String(port.detention) === '1';
  const title = isDetention ? 'DETENTION STATEMENT' : 'LAYTIME STATEMENT / PORT';
  const portLabel = port.portType === 'DP' ? 'Discharge Port' : 'Load Port';
  const portName = dash(port.portNameManual || port.portName);
  const cargo = Array.isArray(form.cargo) ? form.cargo.filter(Boolean).join(', ') : dash(form.cargo);
  const demLabel = isDetention ? 'Detention Rate' : 'Demurrage Rate';
  const rateLabel = port.portType === 'DP'
    ? (form.rateUnit === 'hrs' ? 'Discharge rate (MTPH)' : 'Discharge rate (Mts/Day)')
    : (form.rateUnit === 'hrs' ? 'Loading rate (MTPH)' : 'Loading rate (Mts/Day)');

  drawBanner(doc, title);
  doc.font('Helvetica').fontSize(9).fillColor(TEXT)
    .text(`Vessel Name : ${dash(form.vesselName || form.vesselParticulars?.vesselName)}`);
  doc.moveDown(0.3);

  kvRow(doc, [
    { text: `${portLabel} : ${portName}`, bold: true },
    { text: `${demLabel} : ${num(port.demurrageRate)}` },
    { text: `Cargo Type(As per B/L) : ${dash(cargo)}` },
    { text: `Laytime Type - ${String(port.reversible) === '1' ? 'Reversible' : 'Non Reversible'}` },
  ]);
  kvRow(doc, [
    { text: `Vessel Arrived : ${dash(port.vesselArrived)}` },
    { text: `Despatch Rate : ${num(port.despatchRate)}` },
    { text: `Quantity(As per B/L in Mt) : ${num(port.loadedQty)}` },
    { text: '' },
  ]);
  kvRow(doc, [
    { text: `NOR Tendered : ${dash(port.norTendered)}` },
    { text: `Turn Time : ${dash(port.turnTime)}` },
    { text: `${rateLabel} : ${num(port.loadedRate)}` },
    { text: dash(port.loadedTerms) },
  ]);
  kvRow(doc, [
    { text: `NOR Accepted/Validated : ${dash(port.norAccepted)}` },
    { text: '' },
    { text: `Allowed Laytime(${rateUnit}) : ${dash(port.laytimeAllowed)}` },
    { text: '' },
  ]);
  kvRow(doc, [
    { text: `Laytime to start counting : ${dash(port.startCounting)}` },
    { text: '' },
    { text: '' },
    { text: '' },
  ]);
  kvRow(doc, [
    { text: `Vessel Sailed On : ${dash(port.vesselSailed)}` },
    { text: `Total Days in Port : ${dash(port.totalDaysAtPort)}` },
    { text: '' },
    { text: '' },
  ]);

  doc.moveDown(0.4);
  const activityCols = [
    { label: 'S.NO.', width: 28, align: 'center' },
    { label: 'DATE/TIME FROM', width: 95 },
    { label: 'DATE/TIME TO', width: 95 },
    { label: 'Time (Hrs)', width: 55, align: 'center' },
    { label: '%', width: 35, align: 'center' },
    { label: 'Time Used (Hrs)', width: 70, align: 'center' },
    { label: 'Laytime Used (Days)', width: 80, align: 'center' },
    { label: 'Remark', width: 120 },
  ];
  const scale = tableHeader(doc, activityCols);

  let usedDays = 0;
  const activities = (port.activities || []).filter((row) => (
    row.activity || row.start || row.end || row.duration || row.notes
  ));
  if (!activities.length) {
    tableRow(doc, activityCols, ['', '-', '-', '-', '-', '-', '-', 'No activity rows'], scale);
  } else {
    activities.forEach((row, idx) => {
      const duration = Number(row.duration) || 0;
      const partial = Number(row.ltPartial);
      const pct = Number.isFinite(partial) && partial > 0 ? partial : 100;
      const timeUsed = (duration * pct) / 100;
      usedDays += timeUsed / 24;
      tableRow(doc, activityCols, [
        String(idx + 1),
        dash(row.start),
        dash(row.end),
        dash(row.duration),
        Number.isFinite(partial) && String(row.ltPartial).trim() !== '' ? String(row.ltPartial) : '',
        num(timeUsed, 4),
        num(usedDays, 4),
        dash(row.notes || row.activity),
      ], scale);
    });
  }

  ensureSpace(doc, 20);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT)
    .text(`TOTAL TIME USED: ${num(usedDays, 4)} DAYS`, { align: 'right' });
  doc.moveDown(0.6);

  if (String(port.reversible) !== '1') {
    ensureSpace(doc, 90);
    const boxLeft = doc.page.margins.left + 20;
    const boxWidth = 220;
    doc.rect(boxLeft, doc.y, boxWidth, 16).fill(HEADER_FILL);
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9)
      .text('Laytime Summary', boxLeft, doc.y + 3, { width: boxWidth, align: 'center' });
    doc.y += 20;

    const summary = [
      ['Laytime Allowed', dash(port.laytimeAllowed), rateUnit],
      ['Laytime Used', dash(port.actualLaytime), rateUnit],
    ];
    if (Number(port.timeToDespatch) > 0) {
      summary.push(['Time on Despatch', dash(port.timeToDespatch), rateUnit]);
      summary.push(['Despatch Rate', num(port.despatchRate), '']);
      summary.push(['TTL Despatch', dash(port.ttlDespatchManual || port.ttlDespatch), '']);
    }
    if (Number(port.timeToDemurrage) > 0) {
      summary.push([isDetention ? 'Time on Detention' : 'Time on Demurrage', dash(port.timeToDemurrage), rateUnit]);
      summary.push([isDetention ? 'Detention Rate' : 'Demurrage Rate', num(port.demurrageRate), '']);
      summary.push([isDetention ? 'TTL Detention' : 'TTL Demurrage', dash(port.ttlDemurrageManual || port.ttlDemurrage), '']);
    }

    summary.forEach(([label, value, unit]) => {
      doc.font('Helvetica').fontSize(8).fillColor(TEXT)
        .text(`${label}`, boxLeft, doc.y, { width: 90, continued: false });
      doc.text(`${value}${unit ? `  ${unit}` : ''}`, boxLeft + 95, doc.y - 10, { width: 120 });
      doc.moveDown(0.25);
    });
  }

  if (port.remarks) {
    doc.moveDown(0.5);
    ensureSpace(doc, 40);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BLUE).text('Remarks');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(String(port.remarks));
  }
}

/**
 * Laytime PDF — parity-lite vs PHP allPdf.php?id=85 (getLaytimePDFNew).
 * Port mode when port/portId/randomId (or laytimeId) is provided; otherwise all saved ports.
 */
export async function generateLaytimePdf({
  comId,
  laytimeId = '',
  portType = '',
  portId = '',
  randomId = '',
} = {}) {
  if (!comId) {
    const error = new Error('comId is required.');
    error.status = 400;
    throw error;
  }

  const form = await getLaytimeForm(comId);
  const ports = Array.isArray(form?.ports) ? form.ports : [];

  let selected = ports;
  if (portType && portId && randomId) {
    selected = ports.filter((port) => (
      String(port.portType) === String(portType)
      && String(port.portId) === String(portId)
      && String(port.randomId) === String(randomId)
    ));
  } else if (laytimeId) {
    selected = ports.filter((port) => String(port.laytimeId) === String(laytimeId));
  } else {
    selected = ports.filter((port) => port.laytimeId);
  }

  if (!selected.length) {
    const error = new Error('No saved laytime found for PDF.');
    error.status = 404;
    throw error;
  }

  const title = 'Laytime Report Pdf';
  const { doc, chunks } = createDocument(title);

  selected.forEach((port, idx) => {
    if (idx > 0) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BLUE)
      .text(`Voyage ${dash(form.voyageNo)}`, { align: 'center' });
    doc.moveDown(0.3);
    renderPort(doc, form, port);
  });

  const buffer = await finish(doc, chunks);
  const portTag = selected.length === 1
    ? `${selected[0].portType || 'PORT'}-${selected[0].portName || selected[0].portId || ''}`
    : 'Consolidated';
  const filename = `${safeFilename(`Laytime-${form.voyageNo || comId}-${portTag}`)}.pdf`;
  return { buffer, filename };
}
