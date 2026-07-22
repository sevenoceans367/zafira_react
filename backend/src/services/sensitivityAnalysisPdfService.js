import PDFDocument from 'pdfkit';

const BLUE = '#3c8dbc';
const SECTION = '#eef2f7';
const BORDER = '#D7E1E6';
const TEXT = '#24313A';
const WHITE = '#FFFFFF';

function value(input) {
  return input == null || input === '' ? '' : String(input);
}

function formatAmount(input) {
  if (input == null || input === '') return '';
  const num = Number(input);
  if (!Number.isFinite(num) || num === 0) return value(input);
  return num.toFixed(2);
}

function safeFilename(input) {
  return String(input || 'Sensitivity-Analysis').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function createDocument(title) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 28, right: 20, bottom: 28, left: 20 },
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

function buildRows(payload = {}) {
  const columns = Array.isArray(payload.columns) ? payload.columns : [];
  const bunkerGrades = Array.isArray(payload.bunkerGrades) ? payload.bunkerGrades : [];
  const isTanker = String(payload.businessType ?? '2') === '2';
  const rows = [];

  const pushSection = (label) => rows.push({ type: 'section', label });
  const pushRow = (label, values, { bold = false, blue = false } = {}) => {
    rows.push({ type: 'row', label, values, bold, blue });
  };

  pushRow('Vessel', columns.map((c) => c.vesselName || ''), { bold: true });
  pushRow('Voyage No./Parameters', columns.map((c) => c.voyageNo || ''), { bold: true });

  pushSection('Cargo Type');
  pushRow('', columns.map((c) => c.cargoType || ''));

  pushSection('Sensitivity Analysis');
  if (isTanker) {
    pushRow('Min Cargo', columns.map((c) => {
      const parts = (c.freightAdjustments || []).map((item) => (
        `Qty ${value(item.minCargoQty)} | Flat ${value(item.minFlatRate)} | WS ${value(item.minWSRate)}`
      ));
      return parts.join('\n');
    }), { blue: true });
    pushRow('Overage', columns.map((c) => {
      const parts = (c.freightAdjustments || []).map((item) => (
        `Qty ${value(item.overageQty)} | Flat ${value(item.overageFlatRate)} | WS ${value(item.overageWSRate)}`
      ));
      return parts.join('\n');
    }), { blue: true });
  } else {
    pushRow('Freight / MT', columns.map((c) => (c.chkLumpSum ? '' : value(c.freight))), { blue: true });
    pushRow('QTY (MT)', columns.map((c) => (c.chkLumpSum ? '' : value(c.qty))), { blue: true });
  }
  pushRow('Lumpsum', columns.map((c) => (c.chkLumpSum ? value(c.lumpsumAmt) : '')), { blue: true });

  pushRow('Loading Port', columns.map((c) => (
    (c.loadPorts || []).map((p) => `${p.portName || ''}: ${value(p.cost)}`).join('\n')
  )), { blue: true });
  pushRow('Discharge Port', columns.map((c) => (
    (c.discPorts || []).map((p) => `${p.portName || ''}: ${value(p.cost)}`).join('\n')
  )), { blue: true });
  pushRow('Transit Port', columns.map((c) => (
    (c.transitPorts || []).map((p) => `${p.portName || ''}: ${value(p.cost)}`).join('\n')
  )), { blue: true });
  pushRow('Bunkering Port', columns.map((c) => (
    (c.bunkeringPorts || []).map((p) => `${p.portName || ''}: ${value(p.cost)}`).join('\n')
  )), { blue: true });

  for (const grade of bunkerGrades) {
    pushRow(`${grade} (PRICE/MT)`, columns.map((c) => {
      const bunker = (c.bunkerExpenses || []).find((item) => item.grade === grade);
      return bunker?.estPrice ? value(bunker.estPrice) : '';
    }), { blue: true });
  }

  pushRow('Hire / Day', columns.map((c) => value(c.hire?.rate)), { blue: true });

  pushSection('Revenue');
  pushRow('Gross freight', columns.map((c) => formatAmount(c.metrics?.grossFreight)), { blue: true });
  pushRow('Brokerage', columns.map((c) => formatAmount(c.metrics?.brokerageAmt)), { blue: true });
  pushRow('Add Comm', columns.map((c) => {
    const per = c.addCommPer;
    const amt = c.metrics?.addressCommAmt;
    if (!per) return '';
    return `${per}% (-)${formatAmount(amt)}`;
  }), { blue: true });
  pushRow('Other Income', columns.map((c) => formatAmount(c.metrics?.otherIncome)), { blue: true });
  pushRow('Net Receivable', columns.map((c) => formatAmount(c.metrics?.netReceivable)), { bold: true, blue: true });

  pushSection('Expenses - Cargo');
  pushRow('Loading Port', columns.map((c) => formatAmount(c.metrics?.loadPortCost)), { blue: true });
  pushRow('Discharge Port', columns.map((c) => formatAmount(c.metrics?.discPortCost)), { blue: true });
  pushRow('Transit Port', columns.map((c) => formatAmount(c.metrics?.transitPortCost)), { blue: true });
  pushRow('Bunkering Port', columns.map((c) => formatAmount(c.metrics?.bunkeringPortCost)), { blue: true });
  pushRow('Operational Cost', columns.map((c) => formatAmount(c.metrics?.operationalCost)), { blue: true });
  pushRow('Total Expenses - Cargo', columns.map((c) => formatAmount(c.metrics?.totalExpense)), { bold: true, blue: true });

  pushSection('Bunker Expenses (Qty / Price / Amount)');
  for (const grade of bunkerGrades) {
    pushRow(grade, columns.map((c) => {
      const bunker = (c.metrics?.bunkerExpenses || c.bunkerExpenses || [])
        .find((item) => item.grade === grade);
      if (!bunker || !Number(bunker.estPrice)) return '';
      return `${formatAmount(bunker.estMt)} / ${formatAmount(bunker.estPrice)} / ${formatAmount(bunker.estCost)}`;
    }), { blue: true });
  }
  pushRow('Total Bunker Expense', columns.map((c) => formatAmount(c.metrics?.totalBunkerExpense)), { bold: true, blue: true });

  pushSection('Hireage');
  pushRow('Estimated Hire', columns.map((c) => formatAmount(c.metrics?.estimatedHire)), { blue: true });
  pushRow('Net Daily Profit (TCE)', columns.map((c) => formatAmount(c.metrics?.nettDailyProfit)), { bold: true, blue: true });
  pushRow('P/L', columns.map((c) => formatAmount(c.metrics?.profitLoss)), { bold: true, blue: true });

  return rows;
}

function measureRowHeight(doc, cells, widths, fontSize = 7) {
  let max = 16;
  cells.forEach((cell, index) => {
    const height = doc.heightOfString(value(cell), {
      width: Math.max(widths[index] - 6, 20),
      fontSize,
    });
    max = Math.max(max, height + 8);
  });
  return Math.min(Math.max(max, 16), 72);
}

function drawTable(doc, columns, rows) {
  const colCount = Math.max(columns.length, 1);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = Math.min(130, pageWidth * 0.16);
  const valueWidth = (pageWidth - labelWidth) / colCount;
  const widths = [labelWidth, ...Array(colCount).fill(valueWidth)];
  const left = doc.page.margins.left;

  const ensureSpace = (needed) => {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  };

  // Title
  doc.font('Helvetica-Bold').fontSize(14).fillColor(BLUE)
    .text('Sensitivity Analysis', { align: 'center' });
  doc.moveDown(0.6);

  for (const row of rows) {
    if (row.type === 'section') {
      ensureSpace(18);
      const y = doc.y;
      doc.rect(left, y, pageWidth, 16).fillAndStroke(SECTION, BORDER);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT)
        .text(value(row.label), left + 4, y + 4, { width: pageWidth - 8 });
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
        fill = '#f8fafc';
      }
      doc.rect(x, y, widths[index], height).fillAndStroke(fill, BORDER);
      doc.font(row.bold || isLabel ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isLabel ? 7.5 : 7)
        .fillColor(textColor)
        .text(value(cell), x + 3, y + 3, {
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
 * (edited column values + computed metrics).
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
