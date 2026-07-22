import PDFDocument from 'pdfkit';

const BLUE = '#3c8dbc';
const SECTION = '#eef2f7';
const BORDER = '#D7E1E6';
const TEXT = '#24313A';
const WHITE = '#FFFFFF';
const LABEL_BG = '#f8fafc';

/** Match frontend sensitivityAnalysisCalculations.formatAmount */
function formatAmount(input, digits = 2) {
  if (!input) return '';
  const num = Number(input);
  if (!Number.isFinite(num)) return '';
  return num.toFixed(digits);
}

function value(input) {
  return input == null || input === '' ? '' : String(input);
}

function toNumber(input) {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

function freightAmount(qty, flatRate, wsRate) {
  return (toNumber(qty) * toNumber(flatRate) * toNumber(wsRate)) / 100;
}

function formatAddComm(per, amount) {
  if (!per) return '';
  return `${per}% (-)${formatAmount(amount)}`;
}

function safeFilename(input) {
  return String(input || 'Sensitivity-Analysis').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function createDocument(title) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 24, right: 16, bottom: 24, left: 16 },
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

function formatMinCargoCell(item) {
  const amount = freightAmount(item.minCargoQty, item.minFlatRate, item.minWSRate);
  return [
    `Qty: ${value(item.minCargoQty)}`,
    `Flat Rate: ${value(item.minFlatRate)}`,
    `WS: ${value(item.minWSRate)}`,
    `Amount: ${formatAmount(amount)}`,
  ].join('\n');
}

function formatOverageCell(item) {
  const amount = freightAmount(item.overageQty, item.overageFlatRate, item.overageWSRate);
  return [
    `Qty: ${value(item.overageQty)}`,
    `Flat Rate: ${value(item.overageFlatRate)}`,
    `WS: ${value(item.overageWSRate)}`,
    `Amount: ${formatAmount(amount)}`,
  ].join('\n');
}

function formatPortCell(ports = []) {
  return ports
    .map((port) => `${value(port.portName)}\n${value(port.cost)}`)
    .join('\n\n');
}

function formatBunkerResult(bunker) {
  if (!bunker || !toNumber(bunker.estPrice)) return '';
  return `${formatAmount(bunker.estMt)} / ${formatAmount(bunker.estPrice)} / ${formatAmount(bunker.estCost)}`;
}

/**
 * Build table rows to mirror SensitivityAnalysisModal on-screen layout/values.
 */
function buildRows(payload = {}) {
  const columns = Array.isArray(payload.columns) ? payload.columns : [];
  const bunkerGrades = Array.isArray(payload.bunkerGrades) ? payload.bunkerGrades : [];
  const isTanker = String(payload.businessType ?? '2') === '2';
  const rows = [];

  const pushSection = (label) => rows.push({ type: 'section', label });
  const pushRow = (label, values, { bold = false, blue = true } = {}) => {
    rows.push({ type: 'row', label, values, bold, blue });
  };

  pushRow('Vessel', columns.map((c) => value(c.vesselName)), { bold: true });
  pushRow('Voyage No./Parameters', columns.map((c) => value(c.voyageNo)), { bold: true });

  pushSection('Cargo Type');
  pushRow('', columns.map((c) => value(c.cargoType)));

  pushSection('Sensitivity Analysis');
  if (isTanker) {
    pushRow('Min Cargo', columns.map((c) => (
      (c.freightAdjustments || []).map(formatMinCargoCell).join('\n----------\n')
    )));
    pushRow('Overage', columns.map((c) => (
      (c.freightAdjustments || []).map(formatOverageCell).join('\n----------\n')
    )));
  } else {
    pushRow('Freight / MT', columns.map((c) => (c.chkLumpSum ? '' : value(c.freight))));
    pushRow('QTY (MT)', columns.map((c) => (c.chkLumpSum ? '' : value(c.qty))));
  }
  pushRow('Lumpsum', columns.map((c) => (c.chkLumpSum ? value(c.lumpsumAmt) : '')));

  pushRow('Loading Port', columns.map((c) => formatPortCell(c.loadPorts)));
  pushRow('Discharge Port', columns.map((c) => formatPortCell(c.discPorts)));
  pushRow('Transit Port', columns.map((c) => formatPortCell(c.transitPorts)));
  pushRow('Bunkering Port', columns.map((c) => formatPortCell(c.bunkeringPorts)));

  for (const grade of bunkerGrades) {
    pushRow(`${grade} (PRICE/MT)`, columns.map((c) => {
      const bunker = (c.bunkerExpenses || []).find((item) => item.grade === grade);
      return bunker && toNumber(bunker.estPrice) ? value(bunker.estPrice) : '';
    }));
  }

  pushRow('Hire / Day', columns.map((c) => value(c.hire?.rate)));

  pushSection('Revenue');
  pushRow('Gross freight', columns.map((c) => formatAmount(c.metrics?.grossFreight)));
  pushRow('Brokerage', columns.map((c) => formatAmount(c.metrics?.brokerageAmt)));
  pushRow('Add Comm', columns.map((c) => formatAddComm(c.addCommPer, c.metrics?.addressCommAmt)));
  pushRow('Other Income', columns.map((c) => formatAmount(c.metrics?.otherIncome)));
  pushRow('Net Receivable', columns.map((c) => formatAmount(c.metrics?.netReceivable)), { bold: true });

  pushSection('Expenses - Cargo');
  pushRow('Loading Port', columns.map((c) => formatAmount(c.metrics?.loadPortCost)));
  pushRow('Discharge Port', columns.map((c) => formatAmount(c.metrics?.discPortCost)));
  pushRow('Transit Port', columns.map((c) => formatAmount(c.metrics?.transitPortCost)));
  pushRow('Bunkering Port', columns.map((c) => formatAmount(c.metrics?.bunkeringPortCost)));
  pushRow('Operational Cost', columns.map((c) => formatAmount(c.metrics?.operationalCost)));
  pushRow('Total Expenses - Cargo', columns.map((c) => formatAmount(c.metrics?.totalExpense)), { bold: true });

  pushSection('Bunker Expenses (Qty / Price / Amount)');
  for (const grade of bunkerGrades) {
    pushRow(grade, columns.map((c) => {
      const bunker = (c.metrics?.bunkerExpenses || c.bunkerExpenses || [])
        .find((item) => item.grade === grade);
      return formatBunkerResult(bunker);
    }));
  }
  pushRow('Total Bunker Expense', columns.map((c) => formatAmount(c.metrics?.totalBunkerExpense)), { bold: true });

  pushSection('Hireage');
  pushRow('Estimated Hire', columns.map((c) => formatAmount(c.metrics?.estimatedHire)));
  pushRow('Net Daily Profit (TCE)', columns.map((c) => formatAmount(c.metrics?.nettDailyProfit)), { bold: true });
  pushRow('P/L', columns.map((c) => formatAmount(c.metrics?.profitLoss)), { bold: true });

  return rows;
}

function measureRowHeight(doc, cells, widths, fontSize = 7) {
  let max = 18;
  cells.forEach((cell, index) => {
    const height = doc.heightOfString(value(cell), {
      width: Math.max(widths[index] - 6, 20),
      fontSize,
    });
    max = Math.max(max, height + 10);
  });
  // Allow tall multi-line port / min-cargo cells (page shows full stacks).
  return Math.min(Math.max(max, 18), 220);
}

function drawTable(doc, columns, rows) {
  const colCount = Math.max(columns.length, 1);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = Math.min(140, pageWidth * 0.18);
  const valueWidth = (pageWidth - labelWidth) / colCount;
  const widths = [labelWidth, ...Array(colCount).fill(valueWidth)];
  const left = doc.page.margins.left;

  const ensureSpace = (needed) => {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  };

  doc.font('Helvetica-Bold').fontSize(14).fillColor(BLUE)
    .text('Sensitivity Analysis', { align: 'center' });
  doc.moveDown(0.5);

  for (const row of rows) {
    if (row.type === 'section') {
      ensureSpace(18);
      const y = doc.y;
      doc.rect(left, y, pageWidth, 16).fillAndStroke(SECTION, BORDER);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT)
        .text(value(row.label), left + 4, y + 3.5, { width: pageWidth - 8 });
      doc.y = y + 16;
      continue;
    }

    const cells = [row.label, ...(row.values || [])];
    while (cells.length < widths.length) cells.push('');
    const height = measureRowHeight(doc, cells, widths, row.bold ? 7.5 : 7);
    ensureSpace(height);

    let x = left;
    const y = doc.y;
    cells.forEach((cell, index) => {
      const isLabel = index === 0;
      let fill = WHITE;
      let textColor = TEXT;
      if (!isLabel && row.blue) {
        fill = BLUE;
        textColor = WHITE;
      } else if (isLabel) {
        fill = LABEL_BG;
      }
      doc.rect(x, y, widths[index], height).fillAndStroke(fill, BORDER);
      doc.font(row.bold || isLabel ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isLabel ? 7.5 : 7)
        .fillColor(textColor)
        .text(value(cell), x + 3, y + 4, {
          width: widths[index] - 6,
          height: height - 6,
          align: isLabel ? 'left' : 'center',
        });
      x += widths[index];
    });
    doc.y = y + height;
  }
}

/**
 * Build Sensitivity Analysis PDF from the live modal payload
 * (edited column values + computed metrics) — aligned with on-screen table.
 */
export async function generateSensitivityAnalysisPdf(payload = {}) {
  const columns = Array.isArray(payload.columns) ? payload.columns : [];
  if (!columns.length) {
    const error = new Error('No sensitivity analysis columns to export.');
    error.status = 400;
    throw error;
  }

  const rows = buildRows(payload);
  const { doc, chunks } = createDocument('Sensitivity Analysis');
  drawTable(doc, columns, rows);
  const buffer = await finish(doc, chunks);
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    buffer,
    filename: `${safeFilename(`Sensitivity-Analysis-${stamp}`)}.pdf`,
  };
}
