import PDFDocument from 'pdfkit';

const COLORS = {
  navy: '#274670',
  navyTint: '#E6EAF1',
  navyTintStrong: '#D3DAE7',
  navyTintPale: '#F1F3F7',
  orange: '#F4652C',
  blue: '#3B82F6',
  blueTint: '#EAF1FE',
  purple: '#6C47FF',
  purpleTintPale: '#F7F4FF',
  brown: '#8B5E3C',
  brownTintPale: '#FAF6F2',
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
  pageBg: '#EBEDF0',
};

/** Match frontend sensitivityAnalysisCalculations.formatAmount */
function formatAmount(input, digits = 2) {
  if (input === 0 || input === '0') return (0).toFixed(digits);
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

function formatMoney(num, digits = 2) {
  return toNumber(num).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function safeFilename(input) {
  return String(input || 'Sensitivity-Analysis').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
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

function joinAdjustment(items, formatter) {
  return (items || []).map(formatter).filter(Boolean).join(' | ') || '';
}

function firstPortCost(ports = []) {
  if (!ports.length) return '';
  const total = ports.reduce((sum, port) => sum + toNumber(port.cost), 0);
  return total ? formatAmount(total) : value(ports[0]?.cost);
}

function portNames(ports = []) {
  return ports.map((port) => port.portName).filter(Boolean).join(' / ');
}

function buildLayout(payload = {}) {
  const columns = Array.isArray(payload.columns) ? payload.columns : [];
  const bunkerGrades = Array.isArray(payload.bunkerGrades) ? payload.bunkerGrades : [];
  const isTanker = String(payload.businessType ?? '2') === '2';
  const tradeLabel = payload.tradeLabel || (isTanker ? 'Tankers' : 'Dry Bulk');

  const colData = columns.map((c) => {
    const metrics = c.metrics || {};
    const adjustments = c.freightAdjustments || [];
    return {
      voyage: value(c.voyageNo),
      vessel: value(c.vesselName),
      tce: toNumber(metrics.nettDailyProfit),
      pnl: toNumber(metrics.profitLoss),
      minCargoQty: joinAdjustment(adjustments, (item) => value(item.minCargoQty)),
      minCargoFlat: joinAdjustment(adjustments, (item) => value(item.minFlatRate)),
      minCargoWs: joinAdjustment(adjustments, (item) => value(item.minWSRate)),
      overageQty: joinAdjustment(adjustments, (item) => value(item.overageQty)),
      overageFlat: joinAdjustment(adjustments, (item) => value(item.overageFlatRate)),
      overageWs: joinAdjustment(adjustments, (item) => value(item.overageWSRate)),
      overageAmt: joinAdjustment(adjustments, (item) => formatAmount(
        freightAmount(item.overageQty, item.overageFlatRate, item.overageWSRate),
      )),
      freight: c.chkLumpSum ? '' : value(c.freight),
      qty: c.chkLumpSum ? '' : value(c.qty),
      lumpsum: c.chkLumpSum ? value(c.lumpsumAmt) : '',
      loadPort: firstPortCost(c.loadPorts),
      loadPortName: portNames(c.loadPorts),
      dischPort: firstPortCost(c.discPorts),
      dischPortName: portNames(c.discPorts),
      transitPort: firstPortCost(c.transitPorts),
      bunkeringPort: firstPortCost(c.bunkeringPorts),
      hireDay: value(c.hire?.rate),
      grossFreight: formatAmount(metrics.grossFreight),
      brokerage: formatAmount(metrics.brokerageAmt),
      addComm: formatAddComm(c.addCommPer, metrics.addressCommAmt),
      otherIncome: formatAmount(metrics.otherIncome),
      nettReceivable: formatAmount(metrics.netReceivable),
      expLoad: formatAmount(metrics.loadPortCost),
      expDisch: formatAmount(metrics.discPortCost),
      expTransit: formatAmount(metrics.transitPortCost),
      expBunkering: formatAmount(metrics.bunkeringPortCost),
      opCost: formatAmount(metrics.operationalCost),
      totalCargoExp: formatAmount(metrics.totalExpense),
      totalBunker: formatAmount(metrics.totalBunkerExpense),
      estHire: formatAmount(metrics.estimatedHire),
      bunkers: bunkerGrades.map((grade) => {
        const bunker = (metrics.bunkerExpenses || c.bunkerExpenses || [])
          .find((item) => item.grade === grade);
        const has = bunker && toNumber(bunker.estPrice);
        return {
          grade,
          price: has ? formatAmount(bunker.estPrice) : '',
          qty: has ? formatAmount(bunker.estMt) : '',
          amount: has ? formatAmount(bunker.estCost ?? toNumber(bunker.estMt) * toNumber(bunker.estPrice)) : '',
        };
      }),
      bunkerPrices: bunkerGrades.map((grade) => {
        const bunker = (c.bunkerExpenses || []).find((item) => item.grade === grade);
        return bunker && toNumber(bunker.estPrice) ? formatAmount(bunker.estPrice) : '';
      }),
    };
  });

  return { columns: colData, bunkerGrades, isTanker, tradeLabel };
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

function drawHeader(doc, pageWidth, left) {
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.textLight)
    .text('SEVEN OCEANS PREFIXTURE PLATFORM', left, doc.y, { characterSpacing: 1.2 });
  doc.moveDown(0.35);
  const titleY = doc.y;
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.navy)
    .text('Estimate - Sensitivity Analysis', left, titleY);

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

function drawOverview(doc, layout, left, pageWidth, labelW, valueW) {
  const y0 = doc.y;
  drawRoundedRect(doc, left, y0, pageWidth, 18, 4, COLORS.navy, COLORS.navy);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white)
    .text('VOYAGE COMPARISON', left + 10, y0 + 5);
  const badge = layout.tradeLabel.toUpperCase();
  const badgeW = doc.widthOfString(badge) + 14;
  drawRoundedRect(doc, left + 150, y0 + 3, badgeW, 12, 6, '#3a5a88', '#8FA1C2');
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white)
    .text(badge, left + 157, y0 + 5.5);

  let y = y0 + 26;
  const cardH = 62;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textLight)
    .text('QUICK READ', left + 4, y + 22);

  layout.columns.forEach((col, index) => {
    const x = left + labelW + index * valueW + 2;
    const tint = index % 2 === 0 ? COLORS.navyTint : COLORS.blueTint;
    const border = index % 2 === 0 ? COLORS.navy : COLORS.blue;
    drawRoundedRect(doc, x, y, valueW - 4, cardH, 6, tint, border);

    const chipColor = border;
    drawRoundedRect(doc, x + (valueW - 4) / 2 - 28, y + 5, 56, 11, 2, chipColor, chipColor);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white)
      .text(`Voy ${col.voyage || '—'}`, x + 4, y + 7, { width: valueW - 12, align: 'center' });

    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.textDark)
      .text(col.vessel || '—', x + 4, y + 20, { width: valueW - 12, align: 'center' });

    const chipY = y + 36;
    const half = (valueW - 16) / 2;
    drawRoundedRect(doc, x + 6, chipY, half, 20, 3, col.tce >= 0 ? COLORS.greenTint : COLORS.redTint, COLORS.white);
    drawRoundedRect(doc, x + 8 + half, chipY, half, 20, 3, col.pnl >= 0 ? COLORS.greenTint : COLORS.redTint, COLORS.white);
    doc.font('Helvetica-Bold').fontSize(6).fillColor(COLORS.textMid)
      .text('TCE', x + 6, chipY + 2, { width: half, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(col.tce >= 0 ? COLORS.green : COLORS.red)
      .text(`$${formatMoney(col.tce, 0)}`, x + 6, chipY + 9, { width: half, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(6).fillColor(COLORS.textMid)
      .text('P&L', x + 8 + half, chipY + 2, { width: half, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(col.pnl >= 0 ? COLORS.green : COLORS.red)
      .text(`$${formatMoney(col.pnl, 0)}`, x + 8 + half, chipY + 9, { width: half, align: 'center' });
  });

  doc.y = y + cardH + 10;
  drawRoundedRect(doc, left, y0, pageWidth, doc.y - y0, 8, null, COLORS.lineStrong);
}

function drawSectionTitle(doc, left, pageWidth, title, color, tintStrong) {
  ensureSpace(doc, 24);
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

function drawGroupHeader(doc, left, pageWidth, labelW, valueW, cols, label, themePale, themeColor) {
  ensureSpace(doc, 16);
  const y = doc.y;
  drawRoundedRect(doc, left, y, labelW - 4, 14, 3, themePale, themePale);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(themeColor)
    .text(label.toUpperCase(), left + 4, y + 3.5);
  doc.y = y + 16;
}

function drawDataRow(doc, left, labelW, valueW, cols, label, values, opts = {}) {
  const fontSize = opts.sub ? 7.5 : 8;
  const cells = [label, ...(values || [])];
  while (cells.length < cols.length + 1) cells.push('');
  let maxH = 16;
  cells.forEach((cell, index) => {
    const width = index === 0 ? labelW - 8 : valueW - 10;
    const h = doc.heightOfString(value(cell) || '—', { width: Math.max(width, 20), fontSize });
    maxH = Math.max(maxH, h + 8);
  });
  ensureSpace(doc, maxH + 2);
  const y = doc.y;

  doc.font(opts.bold || opts.subtotal ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.sub ? 7.5 : 8.5)
    .fillColor(opts.subtotal ? (opts.themeColor || COLORS.textMid) : (opts.sub ? COLORS.textLight : COLORS.textMid))
    .text(label, left + 4, y + 4, { width: labelW - 8 });

  values.forEach((cell, index) => {
    const x = left + labelW + index * valueW;
    const empty = !cell;
    const fill = opts.sub && !opts.amt ? '#F8F9FA' : COLORS.fieldGrey;
    drawRoundedRect(doc, x + 1, y + 1, valueW - 2, maxH - 2, 3, fill, COLORS.fieldBorder);
    doc.font(opts.bold || opts.subtotal || opts.amt ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(fontSize)
      .fillColor(
        empty
          ? '#A6ADB6'
          : (opts.subtotal || opts.amt ? (opts.themeColor || COLORS.textDark) : COLORS.textDark),
      )
      .text(empty ? '—' : value(cell), x + 4, y + 4, {
        width: valueW - 8,
        align: 'center',
      });
  });

  doc.moveTo(left, y + maxH).lineTo(left + labelW + valueW * cols.length, y + maxH)
    .strokeColor(COLORS.line).lineWidth(0.5).stroke();
  doc.y = y + maxH;
}

function drawResults(doc, layout, left, pageWidth, labelW, valueW) {
  ensureSpace(doc, 70);
  const y0 = doc.y + 8;
  drawRoundedRect(doc, left, y0, pageWidth, 18, 4, COLORS.navy, COLORS.navy);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white)
    .text('RESULTS', left + 10, y0 + 5);

  let y = y0 + 24;
  [['TCE $', 'tce'], ['P&L $', 'pnl']].forEach(([label, key]) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.textMid)
      .text(label, left + 6, y + 6);
    layout.columns.forEach((col, index) => {
      const num = col[key];
      const x = left + labelW + index * valueW + 2;
      drawRoundedRect(
        doc,
        x,
        y,
        valueW - 4,
        20,
        4,
        num >= 0 ? COLORS.greenTint : COLORS.redTint,
        num >= 0 ? COLORS.greenTint : COLORS.redTint,
      );
      doc.font('Helvetica-Bold').fontSize(10)
        .fillColor(num >= 0 ? COLORS.green : COLORS.red)
        .text(formatMoney(num, 2), x, y + 5, { width: valueW - 4, align: 'center' });
    });
    y += 26;
  });

  drawRoundedRect(doc, left, y0, pageWidth, y - y0 + 4, 6, null, COLORS.lineStrong);
  doc.y = y + 10;
}

function drawFooter(doc, left, pageWidth, calculatedAt) {
  ensureSpace(doc, 36);
  const y = doc.y + 4;
  doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor(COLORS.line).lineWidth(0.8).stroke();
  const stamp = calculatedAt
    ? new Date(calculatedAt).toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    : new Date().toLocaleString();

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight)
    .text(`Calculated ${stamp} — Zafira Shipping & Trading SA`, left, y + 8);

  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textLight)
    .text('Analysed by Seven Oceans  ·  www.sevenoceans.world', left, y + 8, {
      width: pageWidth,
      align: 'right',
    });
  doc.y = y + 28;
}

/**
 * Build Sensitivity Analysis PDF matching the client export mockup layout.
 */
export async function generateSensitivityAnalysisPdf(payload = {}) {
  const sourceColumns = Array.isArray(payload.columns) ? payload.columns : [];
  if (!sourceColumns.length) {
    const error = new Error('No sensitivity analysis columns to export.');
    error.status = 400;
    throw error;
  }

  const layout = buildLayout(payload);
  const { doc, chunks } = createDocument('Estimate - Sensitivity Analysis');
  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelW = Math.min(110, pageWidth * 0.16);
  const valueW = (pageWidth - labelW) / layout.columns.length;
  const themes = {
    navy: { color: COLORS.navy, pale: COLORS.navyTintPale, strong: COLORS.navyTintStrong },
    orange: { color: COLORS.orange, pale: '#FEF6F1', strong: '#FBD9C9' },
    blue: { color: COLORS.blue, pale: COLORS.blueTint, strong: '#D3E3FD' },
    purple: { color: COLORS.purple, pale: COLORS.purpleTintPale, strong: '#DED4FF' },
    brown: { color: COLORS.brown, pale: COLORS.brownTintPale, strong: '#E9D8C6' },
  };

  drawHeader(doc, pageWidth, left);
  drawOverview(doc, layout, left, pageWidth, labelW, valueW);

  // Vessel OPEX
  drawSectionTitle(doc, left, pageWidth, 'Vessel OPEX', themes.navy.color, themes.navy.strong);
  if (layout.isTanker) {
    drawGroupHeader(doc, left, pageWidth, labelW, valueW, layout.columns, 'Min Cargo', themes.navy.pale, themes.navy.color);
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'Qty', layout.columns.map((c) => c.minCargoQty), { sub: true });
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'Flat Rate', layout.columns.map((c) => c.minCargoFlat), { sub: true });
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'WS', layout.columns.map((c) => c.minCargoWs), { sub: true });
    drawGroupHeader(doc, left, pageWidth, labelW, valueW, layout.columns, 'Overage', themes.navy.pale, themes.navy.color);
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'Qty', layout.columns.map((c) => c.overageQty), { sub: true });
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'Flat Rate', layout.columns.map((c) => c.overageFlat), { sub: true });
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'WS', layout.columns.map((c) => c.overageWs), { sub: true });
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'Amount', layout.columns.map((c) => c.overageAmt), {
      sub: true,
      amt: true,
      themeColor: themes.navy.color,
    });
  } else {
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'Freight / MT', layout.columns.map((c) => c.freight));
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'QTY (MT)', layout.columns.map((c) => c.qty));
  }
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Lumpsum', layout.columns.map((c) => c.lumpsum));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Loading Port', layout.columns.map((c) => c.loadPort));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Discharge Port', layout.columns.map((c) => c.dischPort));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Transit Port', layout.columns.map((c) => c.transitPort));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Bunkering Port', layout.columns.map((c) => c.bunkeringPort));
  layout.bunkerGrades.forEach((grade, gradeIndex) => {
    drawDataRow(
      doc,
      left,
      labelW,
      valueW,
      layout.columns,
      `${grade} (Price/MT)`,
      layout.columns.map((c) => c.bunkerPrices[gradeIndex] || ''),
    );
  });
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Hire/Day ($)', layout.columns.map((c) => c.hireDay), {
    bold: true,
    themeColor: themes.navy.color,
  });

  // Revenue
  drawSectionTitle(doc, left, pageWidth, 'Revenue', themes.orange.color, themes.orange.strong);
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Gross Freight', layout.columns.map((c) => c.grossFreight));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Brokerage', layout.columns.map((c) => c.brokerage));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Add Comm', layout.columns.map((c) => c.addComm));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Other Income', layout.columns.map((c) => c.otherIncome));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Net Receivable', layout.columns.map((c) => c.nettReceivable), {
    subtotal: true,
    themeColor: themes.orange.color,
  });

  // Cargo Expenses
  drawSectionTitle(doc, left, pageWidth, 'Cargo Expenses', themes.blue.color, themes.blue.strong);
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Loading Port', layout.columns.map((c) => c.expLoad));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Discharge Port', layout.columns.map((c) => c.expDisch));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Transit Port', layout.columns.map((c) => c.expTransit));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Bunkering Port', layout.columns.map((c) => c.expBunkering));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Operational Cost', layout.columns.map((c) => c.opCost));
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Total Cargo Expense', layout.columns.map((c) => c.totalCargoExp), {
    subtotal: true,
    themeColor: themes.blue.color,
  });

  // Bunker Expenses
  drawSectionTitle(doc, left, pageWidth, 'Bunker Expenses', themes.purple.color, themes.purple.strong);
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.textLight)
    .text('Qty / Price / Amount', left + 12, doc.y);
  doc.moveDown(0.4);
  layout.bunkerGrades.forEach((grade, gradeIndex) => {
    drawGroupHeader(doc, left, pageWidth, labelW, valueW, layout.columns, grade, themes.purple.pale, themes.purple.color);
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'Qty', layout.columns.map((c) => c.bunkers[gradeIndex]?.qty || ''), { sub: true });
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'Price', layout.columns.map((c) => c.bunkers[gradeIndex]?.price || ''), { sub: true });
    drawDataRow(doc, left, labelW, valueW, layout.columns, 'Amount', layout.columns.map((c) => c.bunkers[gradeIndex]?.amount || ''), {
      sub: true,
      amt: true,
      themeColor: themes.purple.color,
    });
  });
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Total Bunker Expense', layout.columns.map((c) => c.totalBunker), {
    subtotal: true,
    themeColor: themes.purple.color,
  });

  // Hireage
  drawSectionTitle(doc, left, pageWidth, 'Hireage', themes.brown.color, themes.brown.strong);
  drawDataRow(doc, left, labelW, valueW, layout.columns, 'Estimated Hire', layout.columns.map((c) => c.estHire));

  drawResults(doc, layout, left, pageWidth, labelW, valueW);
  drawFooter(doc, left, pageWidth, payload.calculatedAt);

  const buffer = await finish(doc, chunks);
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    buffer,
    filename: `${safeFilename(`Sensitivity-Analysis-${stamp}`)}.pdf`,
  };
}
