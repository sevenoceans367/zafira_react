import PDFDocument from 'pdfkit';
import { TANKER_PARTICULARS_LAYOUT } from '../../../frontend/pages/internal-user/fleet/tankerParticularsLayout.js';
import { getTankerParticulars } from './vesselTankerParticularsService.js';

const BRAND = '#1B77A6';
const BORDER = '#EEEEEE';
const MUTED = '#B1AFAF';

const SELECT_LOOKUPS = {
  selFlag: 'countries',
  selRegistryPort: 'ports',
  selCLASS_SOC: 'classSocieties',
  selPrevCLASS_SOC: 'classSocieties',
  selDryDockPort: 'ports',
  selSirePort: 'ports',
  selCDIPort: 'ports',
};

const VESSEL_DESCRIPTION_FIELDS = [
  { key: 'txtVPName', label: "Vessel's Previous Name(S)" },
  { key: 'txtDOC', label: 'Date (S) Of Change' },
  { key: 'txtDateDelivered', label: 'Date delivered' },
  { key: 'txtBuilder', label: 'Builder (where built)' },
  { key: 'selFlag', label: 'Flag', lookup: 'countries' },
  { key: 'selRegistryPort', label: 'Port Of Registry', lookup: 'ports' },
  { key: 'txtCallSign', label: 'Call sign' },
  { key: 'txtPhoneNo', label: "Vessel's satcom phone number" },
  { key: 'txtFaxNo', label: "Vessel's fax number" },
  { key: 'txtTelexNo', label: "Vessel's telex number" },
  { key: 'txtEmailAddress', label: "Vessel's email address" },
  { key: 'txtTypeOfVessel', label: 'Type of vessel' },
  { key: 'txtHullType', label: 'Type of hull' },
];

const TAB_SECTION_NUMBERS = {
  certification: 2,
  crew: 3,
  helicopters: 4,
  usa: 5,
  cargo: 6,
  inert: 7,
  mooring: 8,
  misc: 9,
};

function lookupLabel(lookups, lookupName, value) {
  if (!value) return '';
  const options = lookups?.[lookupName] ?? [];
  return options.find((option) => option.id === String(value))?.name || String(value);
}

function formatFieldValue(field, value, lookups) {
  if (field.key === 'rdoPitch') {
    if (value === '1') return 'Fixed Pitch';
    if (value === '2') return 'Controllable Pitch';
    return value || '';
  }
  if (field.type === 'radio') {
    if (value === '1') return 'Yes';
    if (value === '2') return 'No';
    return value || '';
  }
  const lookupName = field.lookup || SELECT_LOOKUPS[field.key];
  if (lookupName) {
    return lookupLabel(lookups, lookupName, value);
  }
  return value || '';
}

function formatPdfDate() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(now.getDate()).padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
}

function buildFilename(vesselName) {
  const safeName = String(vesselName || 'VESSEL').toUpperCase();
  return `VESSEL PARTICULARS FOR ${safeName} ${formatPdfDate()}.pdf`;
}

class TankerParticularsPdfBuilder {
  constructor(data) {
    this.data = data;
    this.fields = data.fields ?? {};
    this.lookups = data.lookups ?? {};
    this.subCounter = 0;
    this.chunks = [];
    this.doc = new PDFDocument({
      size: 'LEGAL',
      margins: { top: 48, bottom: 56, left: 40, right: 40 },
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
      this.doc.addPage();
    }
  }

  drawTopRule() {
    this.ensureSpace(12);
    const x = this.doc.page.margins.left;
    const width = this.contentWidth;
    this.doc.strokeColor(MUTED).lineWidth(0.5).moveTo(x, this.doc.y).lineTo(x + width, this.doc.y).stroke();
    this.doc.moveDown(0.6);
  }

  drawMainTitle() {
    const vesselName = this.data.vessel?.name || this.fields.txtVName || 'Vessel';
    this.ensureSpace(24);
    this.doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND)
      .text(`VESSEL PARTICULARS (${vesselName})`, this.doc.page.margins.left, this.doc.y, {
        width: this.contentWidth,
        align: 'center',
      });
    this.doc.moveDown(0.6);
  }

  drawSectionHeading(text) {
    this.ensureSpace(22);
    this.doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND).text(text, {
      width: this.contentWidth,
    });
    this.doc.moveDown(0.35);
  }

  drawSubSectionHeading(text) {
    this.ensureSpace(18);
    this.doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND).text(text, {
      width: this.contentWidth,
    });
    this.doc.moveDown(0.2);
  }

  nextFieldNumber(sectionNum) {
    this.subCounter += 1;
    return `${sectionNum}.${this.subCounter}`;
  }

  resetCounter() {
    this.subCounter = 0;
  }

  drawLabelValueRow(numberPrefix, label, value) {
    const labelText = `${numberPrefix}   ${label}`;
    const labelWidth = this.contentWidth * 0.62;
    const valueWidth = this.contentWidth - labelWidth;
    const startX = this.doc.page.margins.left;
    const valueText = String(value ?? '');

    this.doc.font('Helvetica').fontSize(9).fillColor('#000000');
    const labelHeight = this.doc.heightOfString(labelText, { width: labelWidth, lineGap: 1 });
    const valueHeight = this.doc.heightOfString(valueText, { width: valueWidth, lineGap: 1 });
    const rowHeight = Math.max(labelHeight, valueHeight, 12) + 6;

    this.ensureSpace(rowHeight);
    const y = this.doc.y;

    this.doc.text(labelText, startX, y, { width: labelWidth, lineGap: 1 });
    this.doc.text(valueText, startX + labelWidth, y, { width: valueWidth, lineGap: 1 });

    const rowBottom = y + rowHeight - 2;
    this.doc.strokeColor(BORDER).lineWidth(0.5)
      .moveTo(startX, rowBottom)
      .lineTo(startX + this.contentWidth, rowBottom)
      .stroke();
    this.doc.y = rowBottom + 2;
  }

  drawMultiColumnRow(cells, widths) {
    const startX = this.doc.page.margins.left;
    const normalizedWidths = widths.map((width) => width * this.contentWidth);
    const texts = cells.map((cell) => String(cell ?? ''));

    this.doc.font('Helvetica').fontSize(9).fillColor('#000000');
    const heights = texts.map((text, index) => this.doc.heightOfString(text, {
      width: normalizedWidths[index],
      lineGap: 1,
    }));
    const rowHeight = Math.max(...heights, 12) + 6;

    this.ensureSpace(rowHeight);
    const y = this.doc.y;
    let x = startX;
    texts.forEach((text, index) => {
      this.doc.text(text, x, y, { width: normalizedWidths[index], lineGap: 1 });
      x += normalizedWidths[index];
    });

    const rowBottom = y + rowHeight - 2;
    this.doc.strokeColor(BORDER).lineWidth(0.5)
      .moveTo(startX, rowBottom)
      .lineTo(startX + this.contentWidth, rowBottom)
      .stroke();
    this.doc.y = rowBottom + 2;
  }

  drawFields(sectionNum, fields) {
    fields.forEach((field) => {
      const value = formatFieldValue(field, this.fields[field.key], this.lookups);
      this.drawLabelValueRow(this.nextFieldNumber(sectionNum), field.label, value);
    });
  }

  buildGeneralInformation() {
    const sectionNum = 1;
    this.resetCounter();
    this.drawSectionHeading('1. GENERAL INFORMATION');
    this.drawSubSectionHeading('Vessel Description');

    this.drawLabelValueRow(this.nextFieldNumber(sectionNum), 'Date updated', this.data.updateOnDate || '');

    const vesselName = this.fields.txtVName || this.data.vessel?.name || '';
    const imoNo = this.fields.txtIMONumber || this.data.vessel?.imoNo || '';
    const nameImo = imoNo ? `${vesselName} (${imoNo})` : vesselName;
    this.drawLabelValueRow(this.nextFieldNumber(sectionNum), "Vessel's name (IMO number)", nameImo);

    VESSEL_DESCRIPTION_FIELDS.forEach((field) => {
      const value = formatFieldValue(field, this.fields[field.key], this.lookups);
      this.drawLabelValueRow(this.nextFieldNumber(sectionNum), field.label, value);
    });

    TANKER_PARTICULARS_LAYOUT.mainSections.forEach((section) => {
      this.doc.moveDown(0.2);
      this.drawSubSectionHeading(section.title);
      this.drawFields(sectionNum, section.fields);
    });
  }

  buildCertificationSection(sectionNum, tab) {
    this.drawMultiColumnRow(
      ['', 'Certificate Name', 'Date Of Issue', 'Date Of Last Annual Endorsement', 'Date Of Expiry'],
      [0.08, 0.3, 0.2, 0.22, 0.2],
    );

    (this.data.certificates ?? []).forEach((certificate) => {
      this.drawMultiColumnRow(
        [
          this.nextFieldNumber(sectionNum),
          certificate.certificateName || certificate.certificateId || '',
          certificate.dateIssue || '',
          certificate.dateLastAnnual || '',
          certificate.dateExpiry || '',
        ],
        [0.08, 0.3, 0.2, 0.22, 0.2],
      );
    });

    tab.sections?.forEach((section) => {
      if (section.title && section.title !== tab.label) {
        this.doc.moveDown(0.2);
        this.drawSubSectionHeading(section.title);
      }
      this.drawFields(sectionNum, section.fields ?? []);
    });
  }

  buildTabSections() {
    TANKER_PARTICULARS_LAYOUT.tabs.forEach((tab) => {
      const sectionNum = TAB_SECTION_NUMBERS[tab.id];
      if (!sectionNum) return;

      this.doc.moveDown(0.4);
      this.resetCounter();
      this.drawSectionHeading(`${sectionNum}. ${tab.label}`);

      if (tab.certificates) {
        this.buildCertificationSection(sectionNum, tab);
        return;
      }

      tab.sections?.forEach((section) => {
        if (section.title && section.title !== tab.label) {
          this.drawSubSectionHeading(section.title);
        }
        this.drawFields(sectionNum, section.fields ?? []);
      });
    });
  }

  buildDocument() {
    this.doc.info.Title = 'FLEET VESSEL PARTICULARS FOR TANKER';
    this.doc.info.Author = 'Zafira';
    this.doc.info.Subject = 'FLEET VESSEL PARTICULARS FOR TANKER';

    this.drawTopRule();
    this.drawMainTitle();
    this.buildGeneralInformation();
    this.buildTabSections();
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

export async function generateTankerParticularsPdf(vesselId) {
  const data = await getTankerParticulars(vesselId);
  if (!data) return null;

  const builder = new TankerParticularsPdfBuilder(data);
  const buffer = await builder.toBuffer();
  const filename = buildFilename(data.vessel?.name || data.fields?.txtVName);

  return { buffer, filename };
}
