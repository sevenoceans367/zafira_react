import PDFDocument from 'pdfkit';
import { isDbConfigured } from '../config.js';
import { dbGetAgencyLetterForPdf } from './agencyLetterDb.js';

const BLUE = '#1b77a6';
const TEXT = '#24313A';
const MUTED = '#5b6b75';

const LETTER_TITLES = {
  pda: 'PDA Request Letter',
  nomination: 'Agency Nomination Letter',
  'agent-bunker': 'Letter to Agents - Bunker Stemmed',
  'master-bunker': 'Letter to Master - Bunker Stemmed',
};

function safeFilename(input) {
  return String(input || 'Agency-Letter').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-');
}

function createDocument(title) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, right: 48, bottom: 72, left: 48 },
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

function para(doc, text, opts = {}) {
  doc.x = doc.page.margins.left;
  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.size || 10)
    .fillColor(TEXT)
    .text(String(text || ''), {
      align: opts.align || 'left',
      lineGap: 2,
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });
  doc.moveDown(opts.gap ?? 0.45);
}

function firstContact(data) {
  const entity = (data.entities || []).find((row) => row.name || row.email) || {};
  return {
    name: entity.name || '',
    email: entity.email || data.agentEmail || '',
  };
}

function drawHeader(doc, title) {
  doc.font('Helvetica-Bold').fontSize(16).fillColor(BLUE).text(title, { align: 'center' });
  doc.moveDown(0.35);
  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#c5cdd3')
    .stroke();
  doc.moveDown(0.8);
}

function drawFooter(doc, data) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const savedBottom = doc.page.margins.bottom;
  // Temporarily allow writing into the bottom strip (PHP Footer / SetY(-20)).
  doc.page.margins.bottom = 28;
  const y0 = doc.page.height - 58;
  if (doc.y > y0 - 12) {
    doc.page.margins.bottom = savedBottom;
    return;
  }

  const lines = [
    data.companyAddress,
    [data.companyPhone ? `Tel: ${data.companyPhone}` : '', data.companyEmail ? `email: ${data.companyEmail}` : '']
      .filter(Boolean)
      .join('  '),
    data.companyWebsite || '',
  ].filter(Boolean);

  doc.moveTo(left, y0 - 8)
    .lineTo(left + width, y0 - 8)
    .strokeColor('#b1afaf')
    .stroke();
  doc.x = left;
  doc.y = y0;
  doc.font('Helvetica').fontSize(8).fillColor(BLUE);
  lines.forEach((line) => {
    doc.text(line, { width, align: 'center', lineGap: 1 });
  });
  doc.x = left;
  doc.page.margins.bottom = savedBottom;
}

function drawSignOff(doc, data) {
  para(doc, 'Best regards,');
  doc.moveDown(0.3);
  para(doc, 'Operations', { bold: true, gap: 0.2 });
  if (data.companyName) para(doc, data.companyName, { gap: 0.15 });
  if (data.contactPerson) para(doc, data.contactPerson, { gap: 0.15 });
  if (data.contactAddress) para(doc, data.contactAddress, { gap: 0.15 });
  if (data.contactPhone) para(doc, data.contactPhone, { gap: 0.15 });
  if (data.contactEmail) para(doc, data.contactEmail, { gap: 0.15 });
}

function kv(doc, label, value) {
  para(doc, `${label} : ${value == null || value === '' ? '' : String(value)}`, { gap: 0.1, size: 9 });
}

function drawBunkerTable(doc, bunkers) {
  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const lines = [
    ['FUEL GRADE/SPEC', 'SUPPLIER', 'PHYSICAL', 'QUANTITY(MT)'].join('  |  '),
    ...(bunkers || []).map((row) => [row.grade, row.supplier, row.physical, row.quantity]
      .map((v) => String(v ?? ''))
      .join('  |  ')),
  ];
  lines.forEach((line, index) => {
    doc.x = left;
    doc.font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor(TEXT)
      .text(line, left, doc.y, { width: usable, align: 'left' });
    doc.x = left;
  });
  doc.x = left;
  doc.moveDown(0.3);
}

function drawPdaBody(doc, data) {
  const contact = firstContact(data);
  para(doc, `To : ${data.agentName || '-'}${data.portName ? ` (${data.portName})` : ''}`
    + `${contact.name || contact.email ? ` /att. ${[contact.name, contact.email ? `(${contact.email})` : ''].filter(Boolean).join(' ')}` : ''}`);
  para(doc, `From : ${data.companyName || '-'}`);
  doc.moveDown(0.3);
  para(doc, 'Good day,');
  para(doc, 'Dear Sirs,');
  para(doc, `Re. ${String(data.vesselName || '').toUpperCase() || '-'}`, { bold: true });
  para(
    doc,
    `We are working on a possible loading at your facility for (${data.cargoName || '-'}`
    + `${data.qty ? `) ${data.qty} MT.` : ').'}`,
  );
  para(doc, "Please revert with your best Proforma DA on basis following vessel's particulars:");
  para(doc, `LOA(M) : ${data.vessel?.loa || '-'}`, { gap: 0.15 });
  para(doc, `MAX S.DRAFT(M) : ${data.vessel?.draft || '-'}`, { gap: 0.15 });
  para(doc, `DWT(MT) : ${data.vessel?.dwt || '-'}`, { gap: 0.15 });
  para(doc, `GRT : ${data.vessel?.grt || '-'}`, { gap: 0.15 });
  para(doc, `NRT : ${data.vessel?.nrt || '-'}`, { gap: 0.35 });
  para(doc, 'Please quote ALL IN agency fee.');
  para(doc, 'In addition, please advise the usual port restrictions for this vessel type.');
  drawSignOff(doc, data);
}

function drawNominationBody(doc, data) {
  const contact = firstContact(data);
  const portKind = String(data.portType || '').toUpperCase().startsWith('DP') ? 'discharge' : 'load';
  para(doc, `To : ${data.agentName || '-'}${data.portName ? ` (${data.portName})` : ''}`
    + `${contact.name || contact.email ? ` / att. ${[contact.name, contact.email ? `(${contact.email})` : ''].filter(Boolean).join(' ')}` : ''}`);
  if (data.nomId) para(doc, `Nom ID : ${data.nomId}`);
  doc.moveDown(0.2);
  para(doc, 'Good day,');
  para(
    doc,
    `We are glad to appoint you as our agents for handling cargo operations for subject vessel,`
    + ` which shows ETA on/around ${data.etaDate1 || '_____________'} IAGW.`,
  );
  para(
    doc,
    `Vessel expected to ${portKind} about ${data.qty || '____'} MTS (subject to master's stow plan) of `
    + `${data.cargoName || 'cargo'} in Bulk at the port of ${data.portName || '-'}.`,
  );
  if (data.cargoDetails) para(doc, `Cargo packing / details: ${data.cargoDetails}`);
  if (data.tolerance) para(doc, `Tolerance: ${data.tolerance}%`);
  if (data.masterName) para(doc, `Master / terms: ${data.masterName}`);
  if (data.shipOwnerName) {
    doc.moveDown(0.2);
    para(doc, 'Owners / Disponent Owners:', { bold: true, gap: 0.2 });
    para(doc, data.shipOwnerName, { gap: 0.15 });
    if (data.shipOwnerPerson) para(doc, data.shipOwnerPerson, { gap: 0.15 });
    if (data.shipOwnerAddress) para(doc, data.shipOwnerAddress, { gap: 0.15 });
    if (data.shipOwnerPhone) para(doc, data.shipOwnerPhone, { gap: 0.15 });
    if (data.shipOwnerEmail) para(doc, data.shipOwnerEmail, { gap: 0.15 });
  }
  drawSignOff(doc, data);
}

function drawBunkerAgentBody(doc, data) {
  // PHP getBunkeringAgentPDF — bunkeringport already includes "Port(Country)" when from PortCode.
  const bunkerPort = data.bunkeringPort || data.portName || '';
  const eta = data.etaDate && data.etaDate !== '00:00' ? data.etaDate : '00:00';
  const v = data.vessel || {};
  const biz = String(v.businessTypeId || '');

  para(doc, `Letter to Agents for ${data.vesselName || '-'} at ${bunkerPort} for bunkering`, {
    bold: true,
    align: 'center',
    size: 11,
    gap: 0.55,
  });

  para(doc, 'To :', { gap: 0.15 });
  para(doc, data.agentName || '-', { gap: 0.12 });
  (data.agentAddressLines || []).forEach((line) => para(doc, line, { gap: 0.08 }));
  if (data.agentStreet2) para(doc, data.agentStreet2, { gap: 0.12 });

  para(doc, 'From :', { gap: 0.2 });
  para(doc, data.companyName || '-', { gap: 0.25 });
  para(doc, 'Good day,', { gap: 0.3 });
  para(
    doc,
    `As owners/disponent owners of the captioned vessel, we are pleased to consign the vessel to your agency during her bunker supply at ${bunkerPort}. Vessel ETA at ${bunkerPort} around ${eta} LT.`,
  );
  para(doc, '1)Please declare the vessel to port and contact master for pre-arrival formalities without delay.');
  para(doc, '2) Vessel particulars are stated below:');

  kv(doc, 'VESSEL NAME', String(data.vesselName || '').toUpperCase());
  kv(doc, 'FLAG', String(v.flag || '').toUpperCase());
  kv(doc, 'CLASS', String(v.classSoc || '').toUpperCase());
  kv(doc, 'BUILT (WHEN/WHERE)', `${v.yearBuilt || ''}/${String(v.builtWhere || '').toUpperCase()}`);
  kv(doc, 'IMO NUMBER', v.imoNo || '');
  kv(doc, 'PORT OF REGISTRY', String(v.portOfRegistry || '').toUpperCase());
  kv(
    doc,
    'SUMMER: DEADWEIGHT / DISPLACEMENT / DRAFT / TPC',
    `${v.dwt || ''} MT / ${v.displacement || ''} MT / ${v.draft || ''} M / ${v.tpc || ''} MT`,
  );
  if (biz === '3') {
    kv(doc, 'CARGO HOLD CAPACITY (GRAINS)', `${v.grain || ''} MT`);
    kv(doc, 'NO.OF HOLDS / NO. OF HATCHES', `${v.noh || ''}/${v.noha || ''}`);
  }
  if (biz === '1') {
    kv(doc, 'CARGO TANK CAPACITY (98PCT)', `${v.cargoTankCapacity || ''} CBM`);
  }
  if (biz === '2') {
    kv(doc, 'CARGO TANK CAPACITY (TANKER)', `${v.cargoTankCapacity || ''} CBM`);
    kv(doc, 'NO. OF CARGO PUMPS / NO. OF GRADES(DOUBLE V/V SEG)', `${v.cargoPumps || ''}/${v.noOfGrades || ''}`);
  }
  kv(doc, 'GROSS TONNAGE', v.grt || '');
  kv(doc, 'NET TONNAGE', v.nrt || '');
  kv(doc, 'PANAMA TONNAGE', v.panamaGt || '');
  kv(doc, 'SUEZ CANAL TONNAGE', v.suezGt || '');
  kv(doc, 'LENGTH (O.A.)', `${v.loa || ''} M`);
  kv(doc, 'LENGTH (P.P)', `${v.lbp || ''} M`);
  kv(doc, 'BREADTH(MLD.)', `${v.breadth || ''} M`);
  kv(doc, 'DEPTH (MLD.)', `${v.depth || ''} M`);

  doc.moveDown(0.15);
  para(doc, 'Vsl communication details:', { gap: 0.18 });
  kv(doc, 'CALL SIGN', v.callSign || '');
  if (biz === '3' && v.mmsi) kv(doc, 'MMSI NO', v.mmsi);
  kv(doc, 'E-MAIL', v.email || '');
  if (biz === '1' || biz === '2') {
    kv(doc, 'INM-F TEL', [v.phone, v.telex].filter(Boolean).join('/') || '');
  } else {
    kv(doc, 'INM-F TEL', v.telex || v.phone || '');
  }
  kv(doc, 'INM-F FAX', v.fax || '');
  if (biz === '3' && v.inmarsat) kv(doc, 'INM-C', v.inmarsat);

  doc.moveDown(0.15);
  para(doc, '3) Please contact vessel master directly for regular updates on ETA. Keep us in copy.');
  para(doc, 'Bunker supply details', { bold: true, gap: 0.2 });
  drawBunkerTable(doc, data.bunkers || []);

  para(doc, '4) Notices: Once bunker supplier details are received, please send relevant notices to bunker suppliers with copy to us. The barge schedule and activity should also be shared with us regularly.');
  para(doc, `5)Please appoint bunker surveyor stated below at ${bunkerPort} Our operations department will contact the surveyor for necessary guidelines.`);
  para(doc, `  Bunker Surveyor (Name) :${data.bunkerSurveyor || ''}`, { gap: 0.12 });
  para(doc, `  Bunker Surveyor (Company and Contact) :${data.bunkerSurveyorCom || ''}`, { gap: 0.22 });
  para(doc, '6) Please advise bunker survey fees in the PDA/FDA submission.');
  para(doc, '7) Please send all bunker related vouchers, receipts and survey report to our operations department, within 30 days. Meanwhile, PDFs of these to be sent to us via email, upon completion.');
  para(doc, '8) Details of boarding officer, if any, to be shared with us.');
  para(doc, 'Please confirm safe receipt of our message by return email.');
  para(doc, 'Many thanks and we look forward to a speedy and cost-effective turnaround of the vessel under your agency.');
  para(doc, 'Kind regards,');
  para(doc, data.companyName || '-', { bold: true });
  doc.moveDown(0.35);
  para(doc, `Username: ${data.username || ''}          Password: ${data.password || ''}`, { gap: 0.25, size: 11 });
  if (data.agentLoginUrl) {
    const abs = /^https?:\/\//i.test(data.agentLoginUrl)
      ? data.agentLoginUrl
      : `https://zafira.sevenoceansgenesis.com${data.agentLoginUrl.startsWith('/') ? '' : '/'}${data.agentLoginUrl}`;
    const left = doc.page.margins.left;
    const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.x = left;
    doc.fillColor(BLUE).font('Helvetica').fontSize(10)
      .text('Click here to login', { width: usable, link: abs, underline: true });
    doc.fillColor(TEXT);
    doc.x = left;
  }
}

function drawBunkerMasterBody(doc, data) {
  para(doc, `To : Master of ${data.vesselName || 'M/V ________'}`);
  para(doc, `From : ${data.companyName || '-'}`);
  if (data.portName) para(doc, `Port : ${data.portName}`);
  doc.moveDown(0.2);
  para(doc, 'Good day, Captain,');
  para(doc, `Re. ${String(data.vesselName || '').toUpperCase() || '-'} — Bunker Stemmed`, { bold: true });
  para(
    doc,
    `Please be advised that bunkers have been stemmed for your good vessel`
    + `${data.portName ? ` at ${data.portName}` : ''}.`,
  );
  if (data.etaDate) para(doc, `ETA : ${data.etaDate}`);
  doc.moveDown(0.2);
  para(doc, 'Bunker stemmed details:', { bold: true, gap: 0.25 });
  const bunkers = data.bunkers?.length ? data.bunkers : [{ grade: '-', supplier: '-', physical: '-', quantity: '-', bunkerPort: '-' }];
  bunkers.forEach((row, index) => {
    para(doc, `${index + 1}. Grade: ${row.grade || '-'}  |  Qty: ${row.quantity || '-'} MT`, { gap: 0.1 });
    para(doc, `   Supplier: ${row.supplier || '-'}  |  Physical: ${row.physical || '-'}`, { gap: 0.1 });
    if (row.bunkerPort) para(doc, `   Bunker port: ${row.bunkerPort}`, { gap: 0.2 });
  });
  if (data.bunkerSurveyor) para(doc, `Bunker surveyor: ${data.bunkerSurveyor}`);
  drawSignOff(doc, data);
}

function mockPdfData(genAgencyId, opts = {}) {
  return {
    genAgencyId,
    portType: opts.portType || 'LP',
    portName: opts.portName || 'Singapore',
    vesselName: 'POLYAIGOS',
    vessel: {
      loa: '225', draft: '14.5', dwt: '82000', grt: '45000', nrt: '28000',
      flag: 'Liberia', classSoc: 'LR', yearBuilt: '2010', builtWhere: 'JAPAN/YARD',
      imoNo: '1234567', portOfRegistry: 'Monrovia', displacement: '95000', tpc: '65',
      cargoTankCapacity: '90000', cargoPumps: '3', noOfGrades: '6',
      panamaGt: '44000', suezGt: '43000', lbp: '215', breadth: '32.2', depth: '20.5',
      callSign: 'ABCD', email: 'master@vessel.example', phone: '870771234', telex: '870771235',
      fax: '870771236', businessTypeId: '2',
    },
    bunkeringPort: 'Kukup / Tanjung Piai(Malaysia)',
    agentName: 'MITSUI & CO. ENERGY TRADING SINGAPORE PTE LTD',
    agentAddressLines: ['12 Marina View', 'Asia Square Tower 2'],
    agentStreet2: 'OPERATIONS E-MAIL: ops@example.com',
    username: 'ZAF/001/1',
    password: '12345',
    etaDate: '12-08-2026 08:00',
    companyName: 'Zafira Shipping & Trading S.A.',
    companyAddress: 'Greece',
    companyPhone: '+30 210 0000000',
    companyEmail: 'ops@zafirast.com',
    companyWebsite: 'www.zafirast.com',
    agentLoginUrl: 'https://zafira.sevenoceansgenesis.com/agentlogin.php',
    bunkerSurveyor: 'John Surveyor',
    bunkerSurveyorCom: 'Survey Co / +65 1234',
    bunkers: [
      { grade: 'VLSFO 0.5%', supplier: 'Supplier A', physical: 'Physical A', quantity: '500' },
      { grade: 'LSMGO', supplier: 'Supplier B', physical: 'Physical B', quantity: '100' },
    ],
    entities: [],
  };
}

/**
 * Port-related letter PDFs (parity-lite vs allPdf.php id=2/51/63/65).
 */
export async function generateAgencyLetterPdf(genAgencyId, opts = {}) {
  const type = String(opts.type || 'pda').toLowerCase();
  if (!LETTER_TITLES[type]) {
    const error = new Error('Unknown agency letter PDF type.');
    error.status = 400;
    throw error;
  }

  const data = isDbConfigured()
    ? await dbGetAgencyLetterForPdf(genAgencyId, opts)
    : mockPdfData(genAgencyId, opts);

  const title = LETTER_TITLES[type];
  const { doc, chunks } = createDocument(title);

  // Agent bunker letter uses its own centered subject line (matches PHP layout).
  if (type !== 'agent-bunker') {
    drawHeader(doc, title);
  } else {
    doc.moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor('#b1afaf')
      .stroke();
    doc.moveDown(0.6);
  }

  if (type === 'pda') drawPdaBody(doc, data);
  else if (type === 'nomination') drawNominationBody(doc, data);
  else if (type === 'agent-bunker') drawBunkerAgentBody(doc, data);
  else drawBunkerMasterBody(doc, data);

  drawFooter(doc, data);

  const buffer = await finish(doc, chunks);
  const today = new Date();
  const dmy = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
  const filename = type === 'agent-bunker'
    ? `Letter to Agents - Bunker Stemmed ( ${safeFilename(data.vesselName || 'Vessel')} - ${safeFilename(data.agentName || 'Agent')} ) ${dmy}.pdf`
    : `${safeFilename(title)}-${safeFilename(data.vesselName || 'Vessel')}-${genAgencyId}.pdf`;
  return { buffer, filename };
}
