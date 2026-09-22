import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import styles from './DailyPositionReportPage.module.css';

const TRADE_OPTIONS = [
  { id: 'all', name: 'All Trades' },
  { id: 'tc', name: 'TC' },
  { id: 'spot', name: 'Spot' },
  { id: 'period', name: 'Period' },
  { id: 'coa', name: 'COA' },
  { id: 'relet', name: 'Cargo Relet' },
];

const BIZ_OPTIONS = [
  { id: 'all', name: 'All Business Types' },
  { id: 'Tanker', name: 'Tankers' },
  { id: 'Dry Cargo', name: 'Dry' },
  { id: 'Gas', name: 'Gas' },
];

const SECTIONS = [
  { key: 'load-towards', label: 'Towards Load Port', towards: true },
  { key: 'load-at', label: 'At Load Port', towards: false },
  { key: 'disch-towards', label: 'Towards Discharge Port', towards: true },
  { key: 'disch-at', label: 'At Discharge Port', towards: false },
];

const COLUMN_DEFS = [
  { key: 'biz', label: 'Business Type', defaultOn: false },
  { key: 'operator', label: 'Operator', defaultOn: true },
  { key: 'charterer', label: 'Charterer', defaultOn: true },
  { key: 'shipper', label: 'Shipper', defaultOn: false },
  { key: 'owner', label: 'Owner', defaultOn: true },
  { key: 'port', label: 'Port', defaultOn: true },
  { key: 'eta', label: 'ETA / ETC', defaultOn: true },
  { key: 'cargo', label: 'Cargo', defaultOn: true },
  { key: 'qtyMt', label: 'Qty (MT)', defaultOn: true },
  { key: 'laycan', label: 'Laycan', defaultOn: true },
  { key: 'agent', label: 'Agent', defaultOn: true },
  { key: 'broker', label: 'Broker', defaultOn: true },
  { key: 'demRate', label: 'Dem. Rate ($/Day)', defaultOn: false },
  { key: 'disPorts', label: 'Dis. Port(s)', defaultOn: true },
  { key: 'remarks', label: 'Remarks', defaultOn: false },
];

const CHIP_LABEL = {
  spot: 'SPOT',
  tc: 'TC',
  coa: 'COA',
  period: 'PERIOD',
  relet: 'RELET',
};

const ACCENT = {
  spot: '#f4652c',
  tc: '#14919b',
  coa: '#6c47ff',
  period: '#3b82f6',
  relet: '#5b6472',
};

const AREA_CODES = ['+44 20', '+65 6', '+971 4', '+91 22', '+81 3', '+30 210', '+1 212', '+7 812', '+55 11', '+82 2'];
const CONTACT_PEOPLE = ['R. Alonso', 'T. Duval', 'K. Meyer', 'S. Osei', 'P. Chatterjee', 'L. Novak', 'M. Suzuki', 'A. Farouk', 'C. Dimitriou', 'N. Haddad'];

const ROWS = [
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

function defaultColumnState() {
  return Object.fromEntries(COLUMN_DEFS.map((col) => [col.key, col.defaultOn]));
}

function hashStr(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

function fakeContact(name, role) {
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

function formatClock(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let hours = date.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${hours}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm}`;
}

function fullLineText(row) {
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

function LiveClock() {
  const [clock, setClock] = useState(() => formatClock(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className={styles.liveClock}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
      Positions as of {clock}
    </span>
  );
}

function DirIcon({ towards }) {
  return towards ? (
    <svg className={styles.dirIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  ) : (
    <svg className={styles.dirIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

function Trunc({ text }) {
  if (!text || text === '—') return <span className={styles.dash}>—</span>;
  return <span title={text}>{text}</span>;
}

export default function DailyPositionReportPage() {
  const setHeading = usePageHeaderHeading();
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('all');
  const [bizFilter, setBizFilter] = useState('all');
  const [columnState, setColumnState] = useState(defaultColumnState);
  const [exportOpen, setExportOpen] = useState(false);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [contact, setContact] = useState(null);
  const exportRef = useRef(null);
  const colPickerRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    setHeading({
      title: (
        <span className={styles.headerTitleStack}>
          <span className={styles.headerTitleText}>Daily Positions Report</span>
          <LiveClock />
        </span>
      ),
    });
    return () => setHeading(null);
  }, [setHeading]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) setExportOpen(false);
      if (colPickerRef.current && !colPickerRef.current.contains(event.target)) setColPickerOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((col) => columnState[col.key]),
    [columnState],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ROWS.filter((row) => {
      if (tradeFilter !== 'all' && row.contractType !== tradeFilter) return false;
      if (bizFilter !== 'all' && row.biz !== bizFilter) return false;
      if (query) {
        const hay = `${row.vessel} ${row.id} ${row.operator} ${row.charterer} ${row.owner} ${row.agent} ${row.broker}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [search, tradeFilter, bizFilter]);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };

  const copyLine = async (row) => {
    const text = fullLineText(row);
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // toast still confirms
    }
    showToast(`Full line copied for ${row.vessel} (${row.id}) — paste into email or Teams.`);
  };

  const handleExport = (format) => {
    const action = format === 'Email'
      ? `Attaching a ${filteredRows.length}-position report`
      : `Downloading as ${format}`;
    showToast(
      `${action} — Vessel/Voyage + ${visibleColumns.length} selected field${visibleColumns.length === 1 ? '' : 's'} for ${filteredRows.length} position${filteredRows.length === 1 ? '' : 's'} — illustrative only in this mockup.`,
    );
    setExportOpen(false);
  };

  const renderCell = (key, row) => {
    if (key === 'qtyMt') return row.qtyMt.toLocaleString('en-US');
    if (key === 'demRate') return row.demRate ? row.demRate.toLocaleString('en-US') : '—';
    if (key === 'agent' || key === 'broker') {
      const name = row[key];
      if (!name || name === '—') return <span className={styles.dash}>—</span>;
      return (
        <button
          type="button"
          className={styles.contactTrigger}
          onMouseEnter={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const left = Math.min(rect.left, window.innerWidth - 266);
            setContact({
              ...fakeContact(name, key === 'agent' ? 'Agent' : 'Broker'),
              left: Math.max(8, left),
              top: rect.bottom + 8,
            });
          }}
          onMouseLeave={() => setContact(null)}
        >
          <Trunc text={name} />
        </button>
      );
    }
    if (['operator', 'charterer', 'shipper', 'owner', 'cargo', 'remarks'].includes(key)) {
      return <Trunc text={row[key]} />;
    }
    return row[key] || '—';
  };

  const tableMinWidth = Math.max(960, (visibleColumns.length + 3) * 120);

  return (
    <>
      <PageHeaderActions deps={[search, tradeFilter, bizFilter]}>
        <HeaderFilterControls align="end">
          <div className={styles.headerFiltersRow}>
            <PageHeaderSearch
              value={search}
              onChange={setSearch}
              placeholder="Search"
            />
            <CardSelect
              options={TRADE_OPTIONS}
              value={tradeFilter}
              onChange={setTradeFilter}
              placeholder="Trade type"
              ariaLabel="Trade type"
            />
            <CardSelect
              options={BIZ_OPTIONS}
              value={bizFilter}
              onChange={setBizFilter}
              placeholder="All Business Types"
              ariaLabel="Business type"
            />
          </div>
        </HeaderFilterControls>
      </PageHeaderActions>

      <div className={`zafira-page ${styles.page}`}>
        <ScrollableTable
          toolbarStart={(
            <>
              <div className={styles.exportMenu} ref={exportRef}>
                <button
                  type="button"
                  className={styles.iconOnlyBtn}
                  title="Export this report"
                  aria-label="Export this report"
                  onClick={(event) => {
                    event.stopPropagation();
                    setColPickerOpen(false);
                    setExportOpen((open) => !open);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.9" />
                    <circle cx="12" cy="12" r="1.9" />
                    <circle cx="12" cy="19" r="1.9" />
                  </svg>
                </button>
                {exportOpen ? (
                  <div className={styles.exportMenuList}>
                    <div className={styles.exportMenuTitle}>Export this report</div>
                    {['Excel', 'CSV', 'PDF', 'Email'].map((format) => (
                      <button
                        key={format}
                        type="button"
                        className={styles.exportMenuItem}
                        onClick={() => handleExport(format)}
                      >
                        {format === 'Email' ? 'Attach to Email' : `Download as ${format}`}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={styles.colPicker} ref={colPickerRef}>
                <button
                  type="button"
                  className={styles.footerBtn}
                  onClick={(event) => {
                    event.stopPropagation();
                    setExportOpen(false);
                    setColPickerOpen((open) => !open);
                  }}
                >
                  Columns ({visibleColumns.length + 2})
                </button>
                {colPickerOpen ? (
                  <div className={styles.colPickerMenu}>
                    <div className={styles.colPickerMenuTitle}>Choose the fields to show in this report</div>
                    <div className={styles.colPickerListWrap}>
                      {COLUMN_DEFS.map((col) => (
                        <label key={col.key} className={styles.colPickerItem}>
                          <input
                            type="checkbox"
                            checked={!!columnState[col.key]}
                            onChange={(event) => {
                              setColumnState((prev) => ({ ...prev, [col.key]: event.target.checked }));
                            }}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                    <div className={styles.colPickerMenuFooter}>
                      <button
                        type="button"
                        className={styles.colPickerReset}
                        onClick={() => setColumnState(defaultColumnState())}
                      >
                        Reset to default
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
          toolbarRight={(
            <span>Showing {filteredRows.length} of {ROWS.length} positions</span>
          )}
        >
          <div className={styles.sections}>
            {SECTIONS.map((section) => {
              const sectionRows = filteredRows.filter((row) => row.status === section.key);
              return (
                <section key={section.key} className={styles.section} style={{ minWidth: tableMinWidth }}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionLabel}>
                      <DirIcon towards={section.towards} />
                      {section.label}
                    </span>
                    <span className={styles.count}>{sectionRows.length}</span>
                  </div>
                  <table className={styles.grid} style={{ minWidth: tableMinWidth }}>
                    <thead>
                      <tr>
                        <th className={styles.colCopy} aria-label="Copy" />
                        <th className={styles.colIndex}>#</th>
                        <th className={styles.colVessel}>Vessel / Voyage</th>
                        {visibleColumns.map((col) => <th key={col.key}>{col.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {sectionRows.length ? sectionRows.map((row) => {
                        const index = ROWS.indexOf(row) + 1;
                        return (
                          <tr key={`${row.status}-${row.id}`}>
                            <td>
                              <button
                                type="button"
                                className={styles.iconOnlyBtn}
                                title="Copy full line for email/Teams"
                                onClick={() => copyLine(row)}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect x="8" y="8" width="12" height="12" rx="2" />
                                  <path d="M4 16V5a1 1 0 0 1 1-1h11" />
                                </svg>
                              </button>
                            </td>
                            <td className={styles.accentCell} style={{ borderLeftColor: ACCENT[row.contractType] || ACCENT.relet }}>
                              {index}
                            </td>
                            <td>
                              <div className={styles.identity}>
                                <span className={styles.cellId}>{row.vessel}</span>
                                <span className={styles.dash}>{row.id}</span>
                                {row.masterContract ? (
                                  <span className={styles.master}>Master: {row.masterContract}</span>
                                ) : null}
                                <span className={`${styles.typeChip} ${styles[`chip_${row.contractType}`] || ''}`}>
                                  {CHIP_LABEL[row.contractType] || row.contractType}
                                </span>
                              </div>
                            </td>
                            {visibleColumns.map((col) => (
                              <td key={col.key} className={['eta', 'qtyMt', 'laycan', 'demRate'].includes(col.key) ? styles.cellNum : undefined}>
                                {renderCell(col.key, row)}
                              </td>
                            ))}
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td className={styles.empty} colSpan={visibleColumns.length + 3}>
                            No positions in this stage match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              );
            })}
          </div>
        </ScrollableTable>
      </div>

      {contact ? (
        <div className={styles.popover} style={{ left: contact.left, top: contact.top }} role="tooltip">
          <div className={styles.popHead}>
            <span className={styles.avatar} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.4" />
                <path d="M4.5 20.2c0-4.3 3.4-7.7 7.5-7.7s7.5 3.4 7.5 7.7" />
              </svg>
            </span>
            <div>
              <div className={styles.popRole}>{contact.role} contact</div>
              <div className={styles.popName}>{contact.org}</div>
            </div>
          </div>
          <div className={styles.popRow}>{contact.person}</div>
          <div className={styles.popRow}>{contact.phone}</div>
          <div className={styles.popRow}>{contact.email}</div>
        </div>
      ) : null}

      {toast ? <div className={styles.toast} role="status">{toast}</div> : null}
    </>
  );
}
