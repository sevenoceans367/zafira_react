import PDFDocument from 'pdfkit';
import { getCommercialParameters } from './commercialParametersService.js';
import { dbGetCommercialParametersSlaveRows } from './commercialParametersDb.js';

const BRAND = '#1B77A6';
const HEADER_BG = '#1B77A6';
const BORDER = '#EEEEEE';
const MUTED = '#B1AFAF';

const AT_SEA_COLUMNS = [
  'FO_BALAST_ATSEA_SECA_CONSP_FS',
  'FO_LADEN_ATSEA_SECA_CONSP_FS',
  'FO_BALAST_ATSEA_NONSECA_CONSP_FS',
  'FO_LADEN_ATSEA_NONSECA_CONSP_FS',
  'FO_BALAST_ATSEA_SECA_CONSP_SS',
  'FO_LADEN_ATSEA_SECA_CONSP_SS',
  'FO_BALAST_ATSEA_NONSECA_CONSP_SS',
  'FO_LADEN_ATSEA_NONSECA_CONSP_SS',
  'FO_BALAST_ATSEA_SECA_CONSP_MES',
  'FO_LADEN_ATSEA_SECA_CONSP_MES',
  'FO_BALAST_ATSEA_NONSECA_CONSP_MES',
  'FO_LADEN_ATSEA_NONSECA_CONSP_MES',
];

const AT_SEA_SUB_HEADERS = [
  'SECA (Ballast)',
  'SECA (Laden)',
  'NON-SECA (Ballast)',
  'NON-SECA (Laden)',
  'SECA (Ballast)',
  'SECA (Laden)',
  'NON-SECA (Ballast)',
  'NON-SECA (Laden)',
  'SECA (Ballast)',
  'SECA (Laden)',
  'NON-SECA (Ballast)',
  'NON-SECA (Laden)',
];

const IN_PORT_LEGACY_COLUMNS = [
  'FO_INPORT_SECA_CONSP_WORKING',
  'FO_INPORT_NONSECA_CONSP_WORKING',
  'FO_INPORT_SECA_CONSP_IDLE',
  'FO_INPORT_NONSECA_CONSP_IDLE',
  'FO_INPORT_SECA_CONSP_OTHER',
  'FO_INPORT_NONSECA_CONSP_OTHER',
];

function formatPdfDate() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(now.getDate()).padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
}

function buildFilename() {
  return `Commercial Parameters${formatPdfDate()}.pdf`;
}

function bunkerName(lookups, bunkerId) {
  return lookups?.bunkers?.find((item) => item.id === String(bunkerId))?.name || String(bunkerId || '');
}

function str(value) {
  return value == null || value === '' ? '' : String(value);
}

function emptyAtSeaCols() {
  return Object.fromEntries(AT_SEA_COLUMNS.map((key) => [key, '']));
}

function mergeRawAtSeaRows(slaveRows, identify, lookups) {
  const rows = slaveRows.filter((row) => row.IDENTIFY === identify && row.FO_TYPE === 'AT SEA');
  const byBunker = new Map();

  rows.forEach((row) => {
    if (!row.BUNKERID) return;
    if (!byBunker.has(row.BUNKERID)) {
      byBunker.set(row.BUNKERID, {
        bunkerName: bunkerName(lookups, row.BUNKERID),
        ...emptyAtSeaCols(),
      });
    }
    const target = byBunker.get(row.BUNKERID);
    AT_SEA_COLUMNS.forEach((column) => {
      if (row[column]) target[column] = str(row[column]);
    });
  });

  return [...byBunker.values()];
}

function mergeRawInPortRows(slaveRows, identify, lookups) {
  const rows = slaveRows.filter((row) => row.IDENTIFY === identify && row.FO_TYPE === 'IN PORT');
  const byBunker = new Map();

  rows.forEach((row) => {
    if (!row.BUNKERID) return;
    if (!byBunker.has(row.BUNKERID)) {
      byBunker.set(row.BUNKERID, {
        bunkerName: bunkerName(lookups, row.BUNKERID),
        secaLp: '',
        nonSecaLp: '',
        secaDp: '',
        nonSecaDp: '',
        secaIdleBallast: '',
        nonSecaIdleBallast: '',
        secaIdleLaden: '',
        nonSecaIdleLaden: '',
        legacyWorkingSeca: '',
        legacyWorkingNonSeca: '',
        legacyIdleSeca: '',
        legacyIdleNonSeca: '',
        legacyOtherSeca: '',
        legacyOtherNonSeca: '',
      });
    }
    const target = byBunker.get(row.BUNKERID);

    if (row.FO_INPORT_SECA_CONSP_WORKING_LP || row.FO_INPORT_NONSECA_CONSP_WORKING_LP) {
      target.secaLp = str(row.FO_INPORT_SECA_CONSP_WORKING_LP);
      target.nonSecaLp = str(row.FO_INPORT_NONSECA_CONSP_WORKING_LP);
      target.secaDp = str(row.FO_INPORT_SECA_CONSP_WORKING_DP);
      target.nonSecaDp = str(row.FO_INPORT_NONSECA_CONSP_WORKING_DP);
      target.secaIdleBallast = str(row.FO_INPORT_SECA_CONSP_IDLE_BALLAST);
      target.nonSecaIdleBallast = str(row.FO_INPORT_NONSECA_CONSP_IDLE_BALLAST);
      target.secaIdleLaden = str(row.FO_INPORT_SECA_CONSP_IDLE_LADEN);
      target.nonSecaIdleLaden = str(row.FO_INPORT_NONSECA_CONSP_IDLE_LADEN);
    } else {
      target.legacyWorkingSeca = str(row.FO_INPORT_SECA_CONSP_WORKING);
      target.legacyWorkingNonSeca = str(row.FO_INPORT_NONSECA_CONSP_WORKING);
      target.legacyIdleSeca = str(row.FO_INPORT_SECA_CONSP_IDLE);
      target.legacyIdleNonSeca = str(row.FO_INPORT_NONSECA_CONSP_IDLE);
      target.legacyOtherSeca = str(row.FO_INPORT_SECA_CONSP_OTHER);
      target.legacyOtherNonSeca = str(row.FO_INPORT_NONSECA_CONSP_OTHER);
    }
  });

  return [...byBunker.values()];
}

function mergeVariousRows(slaveRows, lookups) {
  const rows = slaveRows.filter((row) => row.FO_TYPE === 'VARIOUS');
  const byBunker = new Map();

  rows.forEach((row) => {
    if (!row.BUNKERID) return;
    if (!byBunker.has(row.BUNKERID)) {
      byBunker.set(row.BUNKERID, {
        bunkerName: bunkerName(lookups, row.BUNKERID),
        coldWash: '',
        hotWash: '',
        inertGasFree: '',
        purgeGasFree: '',
        heatingMaintain: '',
        heatingRaise: '',
      });
    }
    const target = byBunker.get(row.BUNKERID);
    if (row.FO_OTHER_SECA_CONSP_TK || row.FO_OTHER_NONSECA_CONSP_TK) {
      target.coldWash = str(row.FO_OTHER_SECA_CONSP_TK || row.FO_OTHER_NONSECA_CONSP_TK);
      target.hotWash = str(row.FO_OTHER_SECA_CONSP_INERT || row.FO_OTHER_NONSECA_CONSP_INERT);
      target.inertGasFree = str(row.FO_OTHER_SECA_CONSP_GF || row.FO_OTHER_NONSECA_CONSP_GF);
      target.purgeGasFree = str(row.FO_OTHER_SECA_CONSP_HEAT || row.FO_OTHER_NONSECA_CONSP_HEAT);
    }
    if (row.FO_OTHER_SECA_CONSP_HEAT_1) target.heatingMaintain = str(row.FO_OTHER_SECA_CONSP_HEAT_1);
    if (row.FO_OTHER_NONSECA_CONSP_HEAT_1) target.heatingRaise = str(row.FO_OTHER_NONSECA_CONSP_HEAT_1);
  });

  return [...byBunker.values()];
}

function mergeLegacyInPortRows(slaveRows, identify, lookups) {
  const rows = slaveRows.filter((row) => row.IDENTIFY === identify && row.FO_TYPE === 'IN PORT');
  const byBunker = new Map();

  rows.forEach((row) => {
    if (!row.BUNKERID) return;
    if (!byBunker.has(row.BUNKERID)) {
      byBunker.set(row.BUNKERID, {
        bunkerName: bunkerName(lookups, row.BUNKERID),
        ...Object.fromEntries(IN_PORT_LEGACY_COLUMNS.map((column) => [column, ''])),
      });
    }
    const target = byBunker.get(row.BUNKERID);
    IN_PORT_LEGACY_COLUMNS.forEach((column) => {
      if (row[column]) target[column] = str(row[column]);
    });
  });

  return [...byBunker.values()];
}

class CommercialParametersPdfBuilder {
  constructor(data, slaveRows) {
    this.data = data;
    this.slaveRows = slaveRows;
    this.chunks = [];
    this.doc = new PDFDocument({
      size: [1008, 612],
      margins: { top: 44, bottom: 44, left: 32, right: 32 },
      bufferPages: true,
    });
    this.doc.on('data', (chunk) => this.chunks.push(chunk));
  }

  get contentWidth() {
    return this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right;
  }

  get bottomLimit() {
    return this.doc.page.height - this.doc.page.margins.bottom;
  }

  ensureSpace(height) {
    if (this.doc.y + height > this.bottomLimit) {
      this.doc.addPage({ size: [1008, 612], margins: this.doc.page.margins });
    }
  }

  drawTopRule() {
    const x = this.doc.page.margins.left;
    this.doc.strokeColor(MUTED).lineWidth(0.5).moveTo(x, this.doc.y).lineTo(x + this.contentWidth, this.doc.y).stroke();
    this.doc.moveDown(0.5);
  }

  drawSectionTitle(text) {
    this.ensureSpace(20);
    this.doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND).text(text);
    this.doc.moveDown(0.35);
  }

  drawLabelValueGrid(pairs) {
    const colWidth = this.contentWidth / 3;
    let x = this.doc.page.margins.left;
    let y = this.doc.y;
    let rowHeight = 0;

    pairs.forEach((pair, index) => {
      if (index > 0 && index % 3 === 0) {
        y += rowHeight + 6;
        x = this.doc.page.margins.left;
        rowHeight = 0;
        this.ensureSpace(18);
      }

      this.doc.font('Helvetica').fontSize(9).fillColor('#000000');
      this.doc.text(`${pair.label}:`, x, y, { width: colWidth * 0.38 });
      const valueHeight = this.doc.heightOfString(pair.value || '', { width: colWidth * 0.58 });
      this.doc.text(pair.value || '', x + colWidth * 0.4, y, { width: colWidth * 0.58 });
      rowHeight = Math.max(rowHeight, valueHeight, 12);
      x += colWidth;
    });

    this.doc.y = y + rowHeight + 8;
  }

  drawTableRow(cells, widths, options = {}) {
    const { header = false, alignRightFrom = 1, fontSize = 8 } = options;
    const startX = this.doc.page.margins.left;
    const normalizedWidths = widths.map((width) => width * this.contentWidth);
    const texts = cells.map((cell) => String(cell ?? ''));

    this.doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    const heights = texts.map((text, index) => this.doc.heightOfString(text, {
      width: normalizedWidths[index] - 6,
    }));
    const rowHeight = Math.max(...heights, header ? 14 : 12) + (header ? 4 : 6);
    this.ensureSpace(rowHeight);

    let x = startX;
    const y = this.doc.y;
    texts.forEach((text, index) => {
      if (header) {
        this.doc.rect(x, y, normalizedWidths[index], rowHeight).fill(HEADER_BG);
        this.doc.fillColor('#FFFFFF');
      } else {
        this.doc.fillColor('#000000');
      }
      const align = index >= alignRightFrom ? 'right' : (header ? 'center' : 'left');
      this.doc.text(text, x + 3, y + 3, {
        width: normalizedWidths[index] - 6,
        align,
      });
      x += normalizedWidths[index];
    });

    if (!header) {
      this.doc.strokeColor(BORDER).lineWidth(0.5)
        .moveTo(startX, y + rowHeight)
        .lineTo(startX + this.contentWidth, y + rowHeight)
        .stroke();
    }

    this.doc.y = y + rowHeight;
  }

  drawAtSeaSection(title, rows) {
    this.drawSectionTitle(title);
    const widths = [0.1, ...Array(12).fill(0.075)];
    const startX = this.doc.page.margins.left;
    const normalizedWidths = widths.map((width) => width * this.contentWidth);
    const groupLabels = ['Full Speed', 'Service Speed', 'Most Eco Speed'];
    const groupHeight = 16;

    this.ensureSpace(groupHeight + 18);
    let y = this.doc.y;
    let x = startX + normalizedWidths[0];

    groupLabels.forEach((label, index) => {
      const spanWidth = normalizedWidths.slice(1 + index * 4, 1 + (index + 1) * 4)
        .reduce((sum, width) => sum + width, 0);
      this.doc.rect(x, y, spanWidth, groupHeight).fill(HEADER_BG);
      this.doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
        .text(label, x + 3, y + 4, { width: spanWidth - 6, align: 'center' });
      x += spanWidth;
    });

    this.doc.y = y + groupHeight;
    this.drawTableRow(['Bunker', ...AT_SEA_SUB_HEADERS], widths, { header: true, alignRightFrom: 99 });
    rows.forEach((row) => {
      this.drawTableRow([row.bunkerName, ...AT_SEA_COLUMNS.map((column) => row[column])], widths, {
        alignRightFrom: 1,
      });
    });
    this.doc.moveDown(0.4);
  }

  drawModernInPortSection(title, rows) {
    this.drawSectionTitle(title);
    const widths = [0.14, ...Array(8).fill(0.1075)];
    this.drawTableRow(
      [
        'Bunker',
        'SECA Ldg+DeBall',
        'NON-SECA Ldg+DeBall',
        'SECA Dis+IG/COW',
        'NON-SECA Dis+IG/COW',
        'SECA Idle Ballast',
        'NON-SECA Idle Ballast',
        'SECA Idle Laden',
        'NON-SECA Idle Laden',
      ],
      widths,
      { header: true, alignRightFrom: 99 },
    );
    rows.forEach((row) => {
      this.drawTableRow(
        [
          row.bunkerName,
          row.secaLp || row.legacyWorkingSeca,
          row.nonSecaLp || row.legacyWorkingNonSeca,
          row.secaDp || row.legacyIdleSeca,
          row.nonSecaDp || row.legacyIdleNonSeca,
          row.secaIdleBallast || row.legacyOtherSeca,
          row.nonSecaIdleBallast || row.legacyOtherNonSeca,
          row.secaIdleLaden,
          row.nonSecaIdleLaden,
        ],
        widths,
        { alignRightFrom: 1 },
      );
    });
    this.doc.moveDown(0.4);
  }

  drawLegacyInPortSection(title, rows) {
    this.drawSectionTitle(title);
    const widths = [0.14, ...Array(6).fill(0.143)];
    this.drawTableRow(['', 'Working', 'Working', 'Idle', 'Idle', 'Others', 'Others'], widths, {
      header: true,
      alignRightFrom: 99,
    });
    this.drawTableRow(['Bunker', 'SECA', 'NON-SECA', 'SECA', 'NON-SECA', 'SECA', 'NON-SECA'], widths, {
      header: true,
      alignRightFrom: 99,
    });
    rows.forEach((row) => {
      this.drawTableRow(
        [
          row.bunkerName,
          row.FO_INPORT_SECA_CONSP_WORKING,
          row.FO_INPORT_NONSECA_CONSP_WORKING,
          row.FO_INPORT_SECA_CONSP_IDLE,
          row.FO_INPORT_NONSECA_CONSP_IDLE,
          row.FO_INPORT_SECA_CONSP_OTHER,
          row.FO_INPORT_NONSECA_CONSP_OTHER,
        ],
        widths,
        { alignRightFrom: 1 },
      );
    });
    this.doc.moveDown(0.4);
  }

  buildDocument() {
    const { vessel, main, speed, lookups } = this.data;
    const foAtSea = mergeRawAtSeaRows(this.slaveRows, 'FO', lookups);
    const doAtSea = mergeRawAtSeaRows(this.slaveRows, 'DO', lookups);
    const foInPort = mergeRawInPortRows(this.slaveRows, 'FO', lookups);
    const doInPort = mergeRawInPortRows(this.slaveRows, 'DO', lookups);
    const variousRows = mergeVariousRows(this.slaveRows, lookups);
    const usesModernInPort = foInPort.some((row) => row.secaLp || row.nonSecaLp || row.secaDp || row.nonSecaDp);

    this.doc.info.Title = 'Commercial Parameter Pdf';
    this.doc.info.Subject = 'Commercial Parameter Report Pdf';

    this.drawTopRule();
    this.doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND)
      .text('COMMERCIAL - PARAMETERS', { align: 'center' });
    this.doc.moveDown(0.6);

    this.drawSectionTitle('Main Data');
    this.drawLabelValueGrid([
      { label: 'Vessel Name', value: vessel?.name },
      { label: 'Vessel Type', value: vessel?.type },
      { label: 'Date', value: main?.date },
      { label: 'DWT (Summer)', value: main?.dwt },
      { label: 'Draft (Summer)', value: main?.draft },
      { label: 'TPC', value: main?.tpc },
    ]);

    this.drawSectionTitle('Speed Data');
    const speedWidths = [0.28, 0.24, 0.24, 0.24];
    this.drawTableRow(['', 'Full Speed', 'Service Speed', 'Most Eco Speed'], speedWidths, {
      header: true,
      alignRightFrom: 99,
    });
    this.drawTableRow(
      ['Ballast Speed (Knots)', speed?.ballastFull, speed?.ballastService, speed?.ballastEco],
      speedWidths,
      { alignRightFrom: 1 },
    );
    this.drawTableRow(
      ['Laden Speed (Knots)', speed?.ladenFull, speed?.ladenService, speed?.ladenEco],
      speedWidths,
      { alignRightFrom: 1 },
    );
    this.doc.moveDown(0.4);

    this.drawAtSeaSection('FO Consp/day(MT) - At Sea', foAtSea);
    if (doAtSea.length) {
      this.drawAtSeaSection('DO Consp/day(MT) - At Sea', doAtSea);
    }

    if (usesModernInPort) {
      this.drawModernInPortSection('FO Consp/day(MT) - In Port', foInPort);
    } else {
      this.drawLegacyInPortSection('FO Consp/day(MT) - In Port', mergeLegacyInPortRows(this.slaveRows, 'FO', lookups));
    }

    if (doInPort.length) {
      const doUsesModern = doInPort.some((row) => row.secaLp || row.nonSecaLp || row.secaDp || row.nonSecaDp);
      if (doUsesModern) {
        this.drawModernInPortSection('DO Consp/day(MT) - In Port', doInPort);
      } else {
        this.drawLegacyInPortSection('DO Consp/day(MT) - In Port', mergeLegacyInPortRows(this.slaveRows, 'DO', lookups));
      }
    }

    if (Number(vessel?.businessTypeId) === 2 && variousRows.length) {
      this.drawSectionTitle('FO Consp/day(MT) - Various');
      const widths = [0.14, 0.143, 0.143, 0.143, 0.143, 0.143, 0.145];
      this.drawTableRow(
        [
          'Bunker',
          'Cold Wash',
          'Hot Wash',
          'Inert from Gas Free',
          'Purge/Gas Free',
          'Heating (Maintain)',
          'Heating (Raise 3 Deg)',
        ],
        widths,
        { header: true, alignRightFrom: 99 },
      );
      variousRows.forEach((row) => {
        this.drawTableRow(
          [
            row.bunkerName,
            row.coldWash,
            row.hotWash,
            row.inertGasFree,
            row.purgeGasFree,
            row.heatingMaintain,
            row.heatingRaise,
          ],
          widths,
          { alignRightFrom: 1 },
        );
      });
    }
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

export async function generateCommercialParametersPdf(vesselId) {
  const data = await getCommercialParameters(vesselId);
  if (!data) return null;

  const slaveRows = await dbGetCommercialParametersSlaveRows(vesselId);
  const builder = new CommercialParametersPdfBuilder(data, slaveRows);
  const buffer = await builder.toBuffer();
  return { buffer, filename: buildFilename() };
}
