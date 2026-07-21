import PDFDocument from 'pdfkit';
import { getTcEstimate, getTcLookups } from './tcEstimateService.js';

const BLUE = '#1B77A6';
const LIGHT_BLUE = '#EAF4F8';
const BORDER = '#D7E1E6';
const TEXT = '#24313A';
const MUTED = '#667781';

function text(value, fallback = '') {
  return value == null || value === '' ? fallback : String(value);
}

function money(value) {
  if (value == null || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
}

function lookupName(options, id) {
  if (id == null || id === '') return '';
  return options?.find((option) => String(option.id) === String(id))?.name || String(id);
}

function safeFilename(value) {
  return String(value || 'TC-Estimate').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

class TcEstimatePdfBuilder {
  constructor(detail, lookups) {
    this.detail = detail;
    this.lookups = lookups;
    this.doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, right: 38, bottom: 42, left: 38 },
      info: {
        Title: `TC Fixture Note ${text(detail.tcNo)}`,
        Author: 'Zafira',
      },
    });
    this.chunks = [];
    this.doc.on('data', (chunk) => this.chunks.push(chunk));
  }

  contentWidth() {
    return this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right;
  }

  ensureSpace(height = 50) {
    if (this.doc.y + height > this.doc.page.height - this.doc.page.margins.bottom) {
      this.doc.addPage();
      this.drawPageHeader();
    }
  }

  drawPageHeader() {
    const { doc } = this;
    const left = doc.page.margins.left;
    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(BLUE)
      .text('TIME CHARTER FIXTURE NOTE', left, 28, { align: 'center' });
    doc
      .moveTo(left, 51)
      .lineTo(left + this.contentWidth(), 51)
      .lineWidth(1.2)
      .strokeColor(BLUE)
      .stroke();
    doc.y = 62;
  }

  drawSectionTitle(title) {
    this.ensureSpace(32);
    const { doc } = this;
    const x = doc.page.margins.left;
    const y = doc.y;
    doc.rect(x, y, this.contentWidth(), 23).fill(BLUE);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#FFFFFF')
      .text(title, x + 8, y + 6, { width: this.contentWidth() - 16 });
    doc.y = y + 28;
  }

  drawFields(fields, columns = 2) {
    const { doc } = this;
    const width = this.contentWidth() / columns;
    const rowHeight = 29;
    for (let index = 0; index < fields.length; index += columns) {
      this.ensureSpace(rowHeight);
      const y = doc.y;
      for (let column = 0; column < columns; column += 1) {
        const field = fields[index + column];
        if (!field) continue;
        const x = doc.page.margins.left + (column * width);
        doc.rect(x, y, width, rowHeight).strokeColor(BORDER).lineWidth(0.5).stroke();
        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(MUTED)
          .text(field[0], x + 6, y + 5, { width: width * 0.39 - 8 });
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(TEXT)
          .text(text(field[1], '—'), x + (width * 0.4), y + 5, {
            width: (width * 0.6) - 8,
            height: rowHeight - 8,
          });
      }
      doc.y = y + rowHeight;
    }
    doc.moveDown(0.45);
  }

  drawTable(headers, rows, widths, numericFrom = headers.length) {
    const { doc } = this;
    const x = doc.page.margins.left;
    const totalWidth = this.contentWidth();
    const drawRow = (values, header = false) => {
      const rowHeight = 23;
      this.ensureSpace(rowHeight);
      const y = doc.y;
      let cursor = x;
      values.forEach((value, index) => {
        const cellWidth = totalWidth * widths[index];
        doc
          .rect(cursor, y, cellWidth, rowHeight)
          .fillAndStroke(header ? LIGHT_BLUE : '#FFFFFF', BORDER);
        doc
          .font(header ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(header ? 7.5 : 8)
          .fillColor(header ? BLUE : TEXT)
          .text(text(value, header ? '' : '—'), cursor + 4, y + 6, {
            width: cellWidth - 8,
            align: index >= numericFrom ? 'right' : 'left',
            ellipsis: true,
          });
        cursor += cellWidth;
      });
      doc.y = y + rowHeight;
    };

    drawRow(headers, true);
    if (rows.length) rows.forEach((row) => drawRow(row));
    else drawRow(['No records', ...Array(headers.length - 1).fill('')]);
    doc.moveDown(0.55);
  }

  drawBunkers() {
    const headers = ['Type', 'Bunker Grade', 'Qty (MT)', 'Date', 'Price USD/MT', 'Amount (USD)'];
    const widths = [0.12, 0.2, 0.14, 0.16, 0.18, 0.2];
    const row = (item, type) => [
      type,
      lookupName(this.lookups.bunkers, item.bunkerId),
      text(item.qty),
      text(item.bunkerDate),
      money(item.price),
      money(item.amount || ((Number(item.qty) || 0) * (Number(item.price) || 0))),
    ];
    const rows = [
      ...(this.detail.deliveryBunkers || []).map((item) => row(item, 'Delivery')),
      ...(this.detail.redeliveryBunkers || []).map((item) => row(item, 'Re-Delivery')),
    ];
    this.drawTable(headers, rows, widths, 2);
  }

  buildDocument() {
    const { detail, lookups } = this;
    const calc = detail.calc || {};
    this.drawPageHeader();

    this.drawSectionTitle('Fixture Summary');
    this.drawFields([
      ['TC No.', detail.tcNo],
      ['Date', detail.tcDate],
      ['Vessel', detail.vesselName],
      ['Vessel Type', detail.vesselType],
      ['Flag', detail.flag],
      ['IMO No.', detail.imoNo],
    ]);

    this.drawSectionTitle('CP / Parties');
    this.drawFields([
      ['CP Date', detail.cpDate],
      ['CP Type', lookupName(lookups.cpTypes, detail.cpType)],
      ['Charterers', lookupName(lookups.charterers, detail.charterer)],
      ['Charterers Operations', lookupName(lookups.vendors, detail.charOperation)],
      ['Chartering Team', lookupName(lookups.charteringTeams, detail.charteringTeam)],
      ['Chartering PIC 1', lookupName(lookups.charteringPics, detail.charteringPic1)],
      ['Chartering PIC 2', lookupName(lookups.charteringPics, detail.charteringPic2)],
      ['Law / Arbitration', lookupName(lookups.lawArbitration, detail.lawArbit)],
      ['Address', detail.charOperAdd],
    ]);

    this.drawSectionTitle('Vessel Details');
    this.drawFields([
      ['Build Yard', detail.buildYard],
      ['Year Built', detail.yearBuild],
      ['Port of Registry', detail.portOfReg],
      ['Class ID', detail.classId],
      ['Summer DWT', detail.summerDwt],
      ['Summer Draft', detail.summerDraft],
      ['LOA', detail.loa1],
      ['Breadth', detail.breadth],
      ['TPC', detail.tpc1],
      ['Gross / Net Tonnage', `${text(detail.grossTonn)} / ${text(detail.netTonn)}`],
      ['Grain / Bale Capacity', `${text(detail.grainCap)} / ${text(detail.baleCap)}`],
      ['Cranes / Grabs', `${text(detail.cranes)} / ${text(detail.grabs)}`],
    ]);

    this.drawSectionTitle('Fixture Terms');
    this.drawFields([
      ['Delivery Port / Range', detail.delRangePort],
      ['Re-Delivery Port / Range', detail.reDelRange],
      ['Delivery Date', detail.delDate],
      ['Re-Delivery Date', detail.reDelDate],
      ['Trip TC', detail.tripTc],
      ['Period', detail.period],
      ['No. of Trips', detail.noOfTrip],
      ['Hire Fix / Day', money(detail.hireFixPer)],
      ['Exchange Currency', detail.exchangeCurrency],
      ['Exchange Rate', detail.exchangeRate],
      ['CVE / Month', money(detail.cveMonth)],
      ['ILOHC', money(detail.ilohcUsd)],
      ['Add Commission %', detail.addComm],
      ['Broker Commission %', detail.brokerComm],
      ['Broker Commission Payable By', detail.broCommPayable],
      ['Fuel Specifications', detail.fuelSpecs],
    ]);

    this.drawSectionTitle('Bunker Details');
    this.drawBunkers();

    if (calc.slave1Id || calc.totalRev || calc.totalExp) {
      this.drawSectionTitle('Estimate Calculation');
      this.drawFields([
        ['TC Days', calc.tcDays],
        ['Utilisation Days', calc.utilisationDays],
        ['Daily Gross Hire', money(calc.dailyGrossHire)],
        ['Net Revenue', money(calc.nettRev)],
        ['Bunker Difference', money(calc.bunkerDiffAmt)],
        ['Total Revenue', money(calc.totalRev)],
        ['Total Expenses', money(calc.totalExp)],
        ['TC Earnings', money(calc.voyageEarn)],
        ['Profit / Day', money(calc.profitPerDay)],
        ['Less Off Hire', money(calc.lessOffHire)],
      ]);
    }

    this.ensureSpace(45);
    this.doc
      .font('Helvetica-Oblique')
      .fontSize(7)
      .fillColor(MUTED)
      .text(`Generated by Zafira on ${new Date().toLocaleString('en-GB')}`, {
        align: 'right',
      });
  }

  toBuffer() {
    return new Promise((resolve, reject) => {
      this.doc.on('end', () => resolve(Buffer.concat(this.chunks)));
      this.doc.on('error', reject);
      this.buildDocument();
      this.doc.end();
    });
  }
}

export async function generateTcEstimatePdf(tcOutId) {
  const [detail, lookups] = await Promise.all([
    getTcEstimate(tcOutId),
    getTcLookups(),
  ]);
  if (!detail) return null;

  const builder = new TcEstimatePdfBuilder(detail, lookups);
  const buffer = await builder.toBuffer();
  const suffix = detail.tcNo || tcOutId;
  return {
    buffer,
    filename: `${safeFilename(`TC Fixture Note ${suffix}`)}.pdf`,
  };
}
