/** Shared mock rows for Daily Positions Report + Live Map Daily Positions popup. */

export const DAILY_POSITION_STATUS = [
  { id: 'all', name: 'All Positions' },
  { id: 'load-towards', name: 'Towards Load Port' },
  { id: 'load-at', name: 'At Load Port' },
  { id: 'disch-towards', name: 'Towards Discharge Port' },
  { id: 'disch-at', name: 'At Discharge Port' },
];

export const CHIP_LABEL = {
  spot: 'SPOT',
  tc: 'TC',
  coa: 'COA',
  period: 'PERIOD',
  relet: 'RELET',
};

export const ACCENT = {
  spot: '#f4652c',
  tc: '#14919b',
  coa: '#6c47ff',
  period: '#3b82f6',
  relet: '#5b6472',
};

const AREA_CODES = ['+44 20', '+65 6', '+971 4', '+91 22', '+81 3', '+30 210', '+1 212', '+7 812', '+55 11', '+82 2'];
const CONTACT_PEOPLE = ['R. Alonso', 'T. Duval', 'K. Meyer', 'S. Osei', 'P. Chatterjee', 'L. Novak', 'M. Suzuki', 'A. Farouk', 'C. Dimitriou', 'N. Haddad'];

const ACTIVITY_BY_STATUS = {
  'load-towards': { activity: 'sea', activityLabel: 'At Sea' },
  'load-at': { activity: 'loading', activityLabel: 'Loading' },
  'disch-towards': { activity: 'sea', activityLabel: 'At Sea' },
  'disch-at': { activity: 'discharging', activityLabel: 'Discharging' },
};

export const DAILY_POSITION_ROWS = [
  { status: 'load-towards', biz: 'Tanker', contractType: 'spot', vessel: 'BALTIC', id: '26-017/Baltic3', masterContract: 'COA-088-2026', operator: 'Oreanna Acosta A.', charterer: 'Rubis Energie SAS', shipper: 'Bagadiya Brothers Pvt Ltd', owner: 'Cosmoship Management SA', port: 'Odessa (UKR)', eta: '21-Sep-2026 06:00', cargo: 'Palm Fatty Acid Distillate (PFAD)', qtyMt: 10200, laycan: '21-Sep/23-Sep-2026', agent: 'ACF Trade SA', broker: 'Scorpio Kamsarmax Pool Ltd', demRate: 12500, disPorts: 'Fos (FRA)', remarks: 'NOR tendered on arrival' },
  { status: 'load-towards', biz: 'Tanker', contractType: 'period', vessel: 'STELLAR HORIZON', id: 'PERIOD-2026-04', operator: 'Oreanna Acosta A.', charterer: 'Trident Energy Marine', shipper: '—', owner: 'Solstice Tanker Owners', port: 'Fujairah (UAE)', eta: '23-Sep-2026 11:00', cargo: 'Crude Oil (period employment)', qtyMt: 75000, laycan: '23-Sep/24-Sep-2026', agent: 'Gulf Agency Company', broker: 'Poten & Partners', demRate: 0, disPorts: '—', remarks: 'On-subs period fixture' },
  { status: 'load-towards', biz: 'Dry Cargo', contractType: 'coa', vessel: 'NORD PIONEER', id: 'COA-088-2026-L2', operator: 'Ayrton Senna', charterer: 'Continental Grain Traders', shipper: 'Meridian Agri Exports', owner: 'Atlas Bulk Owners', port: 'Paranagua (BRA)', eta: '24-Sep-2026 14:00', cargo: 'Soybean Meal', qtyMt: 55000, laycan: '24-Sep/26-Sep-2026', agent: 'Inchcape Shipping Services', broker: 'Braemar ACM', demRate: 18000, disPorts: 'Qingdao (CHN)', remarks: '—' },
  { status: 'load-towards', biz: 'Gas', contractType: 'tc', vessel: 'GAS PIONEER', id: 'TC-3311', operator: 'Harvey Specter', charterer: 'Helios Gas Chartering', shipper: '—', owner: 'Neptune Gas Carriers', port: 'Ras Laffan (QAT)', eta: '22-Sep-2026 09:30', cargo: 'LPG', qtyMt: 22000, laycan: '22-Sep/23-Sep-2026', agent: 'Qatar Shipping Agency', broker: 'SSY Gas Desk', demRate: 9500, disPorts: 'Chiba (JPN)', remarks: 'Awaiting berth confirmation' },
  { status: 'load-at', biz: 'Tanker', contractType: 'spot', vessel: 'BALTIC', id: '26-023/Baltic2', operator: 'Oreanna Acosta A.', charterer: 'Soreidom, Le Robert (Martinique)', shipper: 'Bagadiya Brothers Pvt Ltd', owner: 'Thenamaris Ships Management Ltd', port: 'Odessa (UKR)', eta: '16-Sep-2026 (ARRVD)', cargo: 'RBD Palm Oil', qtyMt: 10200, laycan: '19-Sep/20-Sep-2026', agent: 'Ikaros Shipping and Brokerage Co.', broker: 'Aberdeen Intertrade Co.', demRate: 0, disPorts: 'Fos (FRA)', remarks: '—' },
  { status: 'load-at', biz: 'Dry Cargo', contractType: 'coa', vessel: 'CORAL ISLAND', id: 'COA-091-2026-L5', operator: 'Donna Paulsen', charterer: 'Zafira Grain Trading', shipper: 'Global Agri Commodities', owner: 'Blue Horizon Bulkers', port: 'Santos (BRA)', eta: '17-Sep-2026 (ARRVD)', cargo: 'Soybean', qtyMt: 62000, laycan: '17-Sep/19-Sep-2026', agent: 'Wilhelmsen Port Services', broker: 'Clarksons Platou', demRate: 15000, disPorts: 'Rizhao (CHN)', remarks: '—' },
  { status: 'load-at', biz: 'Gas', contractType: 'tc', vessel: 'POLAR MIST', id: 'TC-3298', operator: 'Mike Ross', charterer: 'Trident Gas Chartering', shipper: '—', owner: 'Solaris Gas Owners', port: 'Ain Sukhna (EGY)', eta: '16-Sep-2026 (ARRVD)', cargo: 'LNG', qtyMt: 45000, laycan: '16-Sep/18-Sep-2026', agent: 'Suez Canal Shipping Agency', broker: 'Fearnleys', demRate: 21000, disPorts: 'Rotterdam (NLD)', remarks: '—' },
  { status: 'disch-towards', biz: 'Tanker', contractType: 'spot', vessel: 'GISELE', id: '26-006/777', operator: 'Oreanna Acosta A.', charterer: 'Rubis - Total - BP', shipper: 'Bagadiya Brothers Pvt Ltd', owner: 'Med Net Shipping Trading Inc', port: 'Oslo (NOR)', eta: '19-Sep-2026 15:00', cargo: 'Butane', qtyMt: 70000, laycan: '23-Sep/23-Sep-2026', agent: 'Arabian Gulf Shipping Company', broker: 'Akasaka Maritime Inc', demRate: 0, disPorts: 'Oslo (NOR)', remarks: '—' },
  { status: 'disch-towards', biz: 'Dry Cargo', contractType: 'coa', vessel: 'SILVER HORIZON', id: 'COA-072-2026-D9', operator: 'Cameron Dennis', charterer: 'Orient Bulk Traders', shipper: 'Prairie Grain Exports', owner: 'Trident Shipowning Ltd', port: 'Ningbo (CHN)', eta: '25-Sep-2026 08:00', cargo: 'Wheat', qtyMt: 58000, laycan: '25-Sep/27-Sep-2026', agent: 'Sinotrans Shipping', broker: 'SSY Dry', demRate: 16500, disPorts: 'Ningbo (CHN)', remarks: '—' },
  { status: 'disch-towards', biz: 'Gas', contractType: 'tc', vessel: 'ARCTIC FLAME', id: 'TC-3345', operator: 'Daniel Hardman', charterer: 'BlueWave Gas Trading', shipper: '—', owner: 'Continental Marine Owners', port: 'Yosu (KOR)', eta: '20-Sep-2026 20:00', cargo: 'LPG', qtyMt: 19500, laycan: '20-Sep/21-Sep-2026', agent: 'Korea Marine Agency', broker: 'Poten & Partners', demRate: 11000, disPorts: 'Yosu (KOR)', remarks: 'Subject to berth availability' },
  { status: 'disch-at', biz: 'Tanker', contractType: 'spot', vessel: 'NORDIC', id: '26-018/Nor3', operator: 'Oreanna Acosta A.', charterer: 'CSSA Chartering and Shipping Services SA', shipper: 'Sideris Shipping S.A.', owner: 'Star Alta LLC', port: 'Marseille (FRA)', eta: '18-Sep-2026 (ARRVD)', cargo: 'RBD Palm Olein', qtyMt: 10500, laycan: '19-Sep/19-Sep-2026', agent: 'Inchcape Shipping Services (Japan) Ltd', broker: 'Marinero S.A.', demRate: 0, disPorts: 'Marseille (FRA)', remarks: '—' },
  { status: 'disch-at', biz: 'Dry Cargo', contractType: 'coa', vessel: 'EASTERN GLORY', id: 'COA-065-2026-D3', operator: 'Shantanu Saxena', charterer: 'Meridian Chartering Ltd', shipper: 'Global Grain Exports', owner: 'Neptune Ship Management', port: 'Busan (KOR)', eta: '18-Sep-2026 (ARRVD)', cargo: 'Corn', qtyMt: 60000, laycan: '18-Sep/18-Sep-2026', agent: 'Busan Shipping Agency', broker: 'Howe Robinson', demRate: 14000, disPorts: 'Busan (KOR)', remarks: '—' },
  { status: 'disch-at', biz: 'Gas', contractType: 'tc', vessel: 'NORTHERN COMET', id: 'TC-3210', operator: 'Nigel Nesbitt', charterer: 'Falcon Gas Chartering', shipper: '—', owner: 'Orient Fleet Owners', port: 'Dahej (IND)', eta: '17-Sep-2026 (ARRVD)', cargo: 'LNG', qtyMt: 41000, laycan: '17-Sep/17-Sep-2026', agent: 'Dahej Port Agency', broker: 'Affinity LNG', demRate: 19500, disPorts: 'Dahej (IND)', remarks: '—' },
  { status: 'disch-at', biz: 'Tanker', contractType: 'relet', vessel: 'CRIMSON HORIZON', id: 'RELET-4401', masterContract: 'PERIOD-2026-04', operator: 'Oreanna Acosta A.', charterer: 'Orient Bulk Pte Ltd', shipper: 'Bagadiya Brothers Pvt Ltd', owner: 'Solstice Tanker Owners', port: 'Fujairah (UAE)', eta: '18-Sep-2026 (ARRVD)', cargo: 'Crude Oil', qtyMt: 15000, laycan: '18-Sep/18-Sep-2026', agent: 'Gulf Agency Company', broker: 'Poten & Partners', demRate: 8500, disPorts: 'Fujairah (UAE)', remarks: 'Relet under the period fixture above' },
];

export function hashStr(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

export function fakeContact(name, role = 'Agent') {
  const hash = hashStr(name);
  const area = AREA_CODES[hash % AREA_CODES.length];
  const num = String(4000000 + (hash % 5999999));
  return {
    role,
    org: name,
    person: CONTACT_PEOPLE[hash % CONTACT_PEOPLE.length],
    phone: `${area} ${num.slice(0, 3)} ${num.slice(3)}`,
    email: `${CONTACT_PEOPLE[hash % CONTACT_PEOPLE.length].toLowerCase().replace(/[^a-z]+/g, '.')}@${String(name).toLowerCase().replace(/[^a-z]+/g, '').slice(0, 16) || 'agency'}.com`,
  };
}

export function fullLineText(row) {
  const lines = [`Vessel: ${row.vessel}`, `Voyage No.: ${row.id}`];
  if (row.masterContract) lines.push(`Master Contract: ${row.masterContract}`);
  lines.push(
    `Trade Type: ${String(row.contractType).toUpperCase()}`,
    `Business Type: ${row.biz}`,
    `Operator: ${row.operator}`,
    `Charterer: ${row.charterer}`,
    `Shipper: ${row.shipper}`,
    `Owner: ${row.owner}`,
    `Port: ${row.port}`,
    `ETA/ETC: ${row.eta}`,
    `Cargo: ${row.cargo}`,
    `Qty (MT): ${row.qtyMt.toLocaleString('en-US')}`,
    `Laycan: ${row.laycan}`,
    `Agent: ${row.agent}`,
    `Broker: ${row.broker}`,
    `Dem. Rate ($/Day): ${row.demRate ? row.demRate.toLocaleString('en-US') : '—'}`,
    `Dis. Port(s): ${row.disPorts}`,
    `Remarks: ${row.remarks}`,
  );
  return lines.join('\n');
}

/** Flatten report rows into the Live Map Daily Positions popup shape. */
export function toPopupRows(rows = DAILY_POSITION_ROWS) {
  return rows.map((row) => {
    const activity = ACTIVITY_BY_STATUS[row.status] || { activity: 'sea', activityLabel: 'At Sea' };
    const position = row.disPorts && row.disPorts !== '—'
      ? `${row.port} – ${row.disPorts}`
      : row.port;
    return {
      ...row,
      type: row.contractType,
      voyageNo: row.id,
      position,
      ...activity,
    };
  });
}

export function uniqueOperators(rows = DAILY_POSITION_ROWS) {
  const names = [...new Set(rows.map((row) => row.operator).filter(Boolean))].sort();
  return [{ id: 'all', name: 'All Operators' }, ...names.map((name) => ({ id: name, name }))];
}
