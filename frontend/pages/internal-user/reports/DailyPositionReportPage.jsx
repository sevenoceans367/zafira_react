import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import {
  ACCENT,
  CHIP_LABEL,
  DAILY_POSITION_ROWS as ROWS,
  fakeContact,
  fullLineText,
} from './dailyPositionsMock.js';
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

function defaultColumnState() {
  return Object.fromEntries(COLUMN_DEFS.map((col) => [col.key, col.defaultOn]));
}

function formatClock(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let hours = date.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${hours}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm}`;
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
                            <td className={styles.colCopy}>
                              <button
                                type="button"
                                className={styles.iconOnlyBtn}
                                title="Copy full line for email/Teams"
                                onClick={() => copyLine(row)}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect x="9" y="9" width="13" height="13" rx="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
