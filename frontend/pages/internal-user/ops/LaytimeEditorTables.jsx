import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LAYTIME_TANKER_PAGE_SIZE,
  applyLaytimeActivityLtToggle,
  filterRowsByQuery,
  formatMoneyDisplay,
  isLaytimeActivityCounting,
} from './laytimeTankerHelpers.js';
import { isValidLtPartialPercent, validateDateRangeOrder } from './laytimeTankerValidation.js';
import { hoursDurationToDays, paginateRows } from './sofTankerHelpers.js';
import styles from './OpsVcLaytimePage.module.css';

function rowDateInvalid(row) {
  return !validateDateRangeOrder(row.start, row.end, { allowIncomplete: true }).ok;
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SectionHeadRight({
  search,
  onSearch,
  searchPlaceholder,
  count,
  page,
  totalPages,
  onPrev,
  onNext,
}) {
  return (
    <div className={styles.sectionHeadRight}>
      <div className={styles.sectionSearchBox} data-laytime-interactive>
        <SearchIcon />
        <input
          type="text"
          className={styles.sectionSearchInp}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </div>
      <span className={styles.cfSectionBadge}>{count}</span>
      <div className={styles.sectionPagination}>
        <button type="button" className={styles.pgBtn} disabled={page <= 1} onClick={onPrev} title="Previous page" aria-label="Previous page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className={styles.pgLabel}>{page} / {totalPages}</span>
        <button type="button" className={styles.pgBtn} disabled={page >= totalPages} onClick={onNext} title="Next page" aria-label="Next page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function RowActions({ locked, onInsert, onDelete }) {
  if (locked) return null;
  return (
    <div className={styles.rowActionsCell}>
      <button type="button" className={`${styles.sqBtn} ${styles.sqAdd}`} title="Insert row below" onClick={onInsert} aria-label="Insert row below">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button type="button" className={`${styles.sqBtn} ${styles.sqDel}`} title="Delete row" onClick={onDelete} aria-label="Delete row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function LtToggle({ counting, disabled, onToggle }) {
  return (
    <div className={styles.ltToggleWrap}>
      <span className={`${styles.ltToggleLbl} ${counting ? styles.ltToggleLblActiveC : ''}`} aria-hidden>C</span>
      <label className={styles.ltToggle}>
        <input
          type="checkbox"
          className={styles.ltToggleInp}
          checked={!counting}
          disabled={disabled}
          onChange={(e) => onToggle(!e.target.checked)}
          aria-label="Not counting"
          aria-checked={!counting}
        />
        <span className={styles.ltToggleTrack} aria-hidden>
          <span className={styles.ltToggleThumb} />
        </span>
      </label>
      <span className={`${styles.ltToggleLbl} ${!counting ? styles.ltToggleLblActiveNc : ''}`} aria-hidden>NC</span>
    </div>
  );
}

function usePagedSearch(rows, fields, entity = '') {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const matches = filterRowsByQuery(rows, search, fields);
  const filtered = entity ? matches.filter(({ row }) => row.entity === entity) : matches;
  const paged = paginateRows(filtered, page, LAYTIME_TANKER_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, rows?.length]);

  useEffect(() => {
    if (page > paged.totalPages) setPage(paged.totalPages);
  }, [page, paged.totalPages]);

  return {
    search,
    setSearch,
    page: paged.safePage,
    setPage,
    totalPages: paged.totalPages,
    items: paged.items,
    filteredCount: filtered.length,
  };
}

const DIALOGUE_FIELDS = ['entity', 'date', 'reason', 'agreedDemm', 'status', 'notes'];
const ENTITY_FILTERS = [
  { value: '', label: 'All', title: 'All entities' },
  { value: 'Charterer', label: 'C', title: 'Charterer only' },
  { value: 'Owner', label: 'O', title: 'Owner only' },
];
const STATUS_STYLES = {
  'On Hold': styles.statusOnhold,
  'Under Nego': styles.statusUnderNego,
  Completed: styles.statusCompleted,
};
const INITIAL_DIALOGUES = [emptyDialogue()];

function emptyDialogue(id = 0, entity = 'Charterer') {
  return { id, entity, date: '', reason: '', agreedDemm: '', status: 'On Hold', notes: '' };
}

function readMockAmount(value) {
  const raw = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) return null;
  const amount = Number(raw.replaceAll(',', ''));
  return Number.isFinite(amount) ? amount : null;
}

function NegoDialogues({ portKey, locked, LtDateField }) {
  const [rowsByPort, setRowsByPort] = useState({});
  const [entity, setEntity] = useState('');
  const nextId = useRef(1);
  const rows = rowsByPort[portKey] ?? INITIAL_DIALOGUES;
  const page = usePagedSearch(rows, DIALOGUE_FIELDS, entity);
  const total = rows.reduce((sum, row) => sum + (readMockAmount(row.agreedDemm) ?? 0), 0);

  const editRows = (edit) => setRowsByPort((current) => ({
    ...current,
    [portKey]: edit(current[portKey] ?? INITIAL_DIALOGUES),
  }));

  const change = (id, field, value) => editRows((current) => current.map((row) => (
    row.id === id ? { ...row, [field]: value } : row
  )));

  const insert = (index, rowEntity) => {
    const row = emptyDialogue(nextId.current++, rowEntity);
    editRows((current) => [...current.slice(0, index + 1), row, ...current.slice(index + 1)]);
  };

  const remove = (id) => editRows((current) => (
    current.length === 1 ? [emptyDialogue(id, current[0].entity)] : current.filter((row) => row.id !== id)
  ));

  return (
    <>
      <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadBlue} ${styles.subRibbon}`}>
        <div className={styles.cfSectionTitleWrap}>
          <div className={`${styles.sectionIco} ${styles.sectionIcoBlue}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
              <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
              <path d="M5 6h.01M8 6h.01M11 6h.01" />
            </svg>
          </div>
          <div>
            <div className={styles.cfSectionTitle}>Nego Dialogues</div>
            <div className={styles.cfSectionSub}>Mock entries for UI testing. Changes reset when you leave the page.</div>
          </div>
        </div>
        <SectionHeadRight
          search={page.search}
          onSearch={page.setSearch}
          searchPlaceholder="Search dialogues..."
          count={page.filteredCount}
          page={page.page}
          totalPages={page.totalPages}
          onPrev={() => page.setPage(page.page - 1)}
          onNext={() => page.setPage(page.page + 1)}
        />
      </div>
      <div className={styles.tableWrap}>
        <table className={`${styles.cfTable} ${styles.negoTable}`}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th style={{ minWidth: 110 }}>
                Entity
                <span className={styles.negoEntityFilter} role="group" aria-label="Filter dialogues by entity">
                  {ENTITY_FILTERS.map(({ value, label, title }) => (
                    <button
                      key={label}
                      type="button"
                      className={`${styles.negEfBtn} ${entity === value ? styles.negEfBtnActive : ''}`}
                      aria-label={title}
                      aria-pressed={entity === value}
                      onClick={() => { setEntity(value); page.setPage(1); }}
                    >{label}</button>
                  ))}
                </span>
              </th>
              <th style={{ minWidth: 170 }}>Date</th>
              <th style={{ minWidth: 150 }}>Reason</th>
              <th style={{ width: 84 }}>Agreed Demm</th>
              <th style={{ minWidth: 120 }}>Status</th>
              <th style={{ minWidth: 280 }}>Notes</th>
              <th style={{ width: 48 }}><span className={styles.ltHiddenPreserve}>Row actions</span></th>
            </tr>
          </thead>
          <tbody>
            {page.items.length ? page.items.map(({ row, index }) => {
              const label = `Dialogue ${index + 1}`;
              const invalidAmount = Boolean(row.agreedDemm.trim()) && readMockAmount(row.agreedDemm) == null;
              return (
                <tr key={row.id}>
                  <td>{index + 1}.</td>
                  <td>
                    <select
                      className={styles.negoEntitySelect}
                      value={row.entity}
                      onChange={(e) => change(row.id, 'entity', e.target.value)}
                      disabled={locked}
                      aria-label={`${label} entity`}
                    >
                      <option>Charterer</option>
                      <option>Owner</option>
                    </select>
                  </td>
                  <td>
                    <LtDateField
                      value={row.date}
                      onChange={(value) => change(row.id, 'date', value)}
                      disabled={locked}
                      ariaLabel={`${label} date`}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cfInp}
                      value={row.reason}
                      onChange={(e) => change(row.id, 'reason', e.target.value)}
                      disabled={locked}
                      aria-label={`${label} reason`}
                    />
                  </td>
                  <td>
                    <input
                      className={`${styles.cfInp} ${styles.numSm} ${styles.negoAgreedInp} ${invalidAmount ? styles.cfInpInvalid : ''}`}
                      inputMode="decimal"
                      value={row.agreedDemm}
                      onChange={(e) => change(row.id, 'agreedDemm', e.target.value)}
                      disabled={locked}
                      placeholder="USD"
                      aria-label={`${label} mock agreed demurrage in USD`}
                      aria-invalid={invalidAmount}
                    />
                  </td>
                  <td>
                    <select
                      className={`${styles.negoStatusSelect} ${STATUS_STYLES[row.status]}`}
                      value={row.status}
                      onChange={(e) => change(row.id, 'status', e.target.value)}
                      disabled={locked}
                      aria-label={`${label} status`}
                    >
                      {Object.keys(STATUS_STYLES).map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                  <td>
                    <textarea
                      className={styles.ltNotesSm}
                      value={row.notes}
                      onChange={(e) => change(row.id, 'notes', e.target.value)}
                      disabled={locked}
                      aria-label={`${label} notes`}
                    />
                  </td>
                  <td>
                    <RowActions
                      locked={locked}
                      onInsert={() => insert(index, row.entity)}
                      onDelete={() => remove(row.id)}
                    />
                  </td>
                </tr>
              );
            }) : <tr className={styles.cfEmptyRow}><td colSpan={8}>No dialogues match the filters.</td></tr>}
          </tbody>
          <tfoot>
            <tr className={styles.totalsRow}>
              <td colSpan={3} className={styles.negoTotalLabel}>Total Agreed Demurrage (mock)</td>
              <td />
              <td>{formatMoneyDisplay(total)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

export default function LaytimeEditorTables({
  isDry,
  portKey,
  draft,
  locked,
  LtDateField,
  updateListRow,
  insertListRow,
  removeListRow,
  emptyActivityRow,
  emptyDeductionRow,
}) {
  const activities = draft?.activities || [];
  const deductions = draft?.deductions || [];

  const fields = ['activity', 'notes', 'start', 'end'];
  const actPage = usePagedSearch(activities, fields);
  const dedPage = usePagedSearch(deductions, fields);

  const calcUnavailable = Boolean(draft?.calcUnavailable);
  const durationUnit = isDry ? 'Days' : 'Hrs';
  const dedTotals = useMemo(() => {
    if (calcUnavailable) {
      return { dur: '—', net: '—' };
    }
    let dur = 0;
    let net = 0;
    (deductions || []).forEach((row) => {
      dur += Number(row.duration) || 0;
      net += Number(row.cumulative) || 0;
    });
    return isDry
      ? { dur: hoursDurationToDays(dur), net: hoursDurationToDays(net) }
      : { dur: dur.toFixed(2), net: net.toFixed(2) };
  }, [deductions, calcUnavailable, isDry]);

  return (
    <div className={styles.cfSection} id="sect-act-ded">
      {/* ACTIVITIES */}
      <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadGreen}`}>
        <div className={styles.cfSectionTitleWrap}>
          <div className={`${styles.sectionIco} ${styles.sectionIcoGreen}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <div className={styles.cfSectionTitle}>Activities</div>
            <div className={styles.cfSectionSub}>
              {String(draft?.laytimeAllowed ?? '').trim()
                ? 'Activity log & laytime calculation'
                : 'Enter Laytime Allowed in the summary to calculate Cumulative.'}
            </div>
          </div>
        </div>
        <SectionHeadRight
          search={actPage.search}
          onSearch={actPage.setSearch}
          searchPlaceholder="Search activities..."
          count={actPage.filteredCount}
          page={actPage.page}
          totalPages={actPage.totalPages}
          onPrev={() => actPage.setPage(actPage.page - 1)}
          onNext={() => actPage.setPage(actPage.page + 1)}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.cfTable}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th style={{ minWidth: 136 }}>Activity in Port</th>
              <th style={{ minWidth: 158 }}>Date/Time – Start</th>
              <th style={{ minWidth: 158 }}>Date/Time – Finish</th>
              <th style={{ width: 90 }}>Duration ({durationUnit})</th>
              <th style={{ width: 72 }}>LT</th>
              <th style={{ width: 80 }}>LT Partial %</th>
              <th style={{ width: 100 }}>{isDry ? 'Cumulative (Days)' : 'Cumulative'}</th>
              <th style={{ minWidth: 116 }}>Notes</th>
              <th style={{ width: 48 }} scope="col">
                <span className={styles.ltHiddenPreserve}>Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {actPage.items.length ? actPage.items.map(({ row, index }, displayIdx) => {
              const counting = isDry ? Boolean(row.ltCounts) : isLaytimeActivityCounting(row);
              const cumNum = Number(row.cumulative);
              const cumNeg = Number.isFinite(cumNum) && cumNum < 0;
              const partialDisabled = locked || !counting;
              return (
                <tr key={`act-${index}`} data-lt-row={`activities-${index}`}>
                  <td>{(actPage.page - 1) * LAYTIME_TANKER_PAGE_SIZE + displayIdx + 1}.</td>
                  <td>
                    <input
                      className={styles.cfInp}
                      type="text"
                      value={row.activity}
                      onChange={(e) => updateListRow('activities', index, { activity: e.target.value })}
                      disabled={locked}
                      placeholder="Activity"
                      aria-label={`Activity ${index + 1} name`}
                    />
                  </td>
                  <td data-lt-focus="start">
                    <LtDateField
                      value={row.start}
                      onChange={(v) => updateListRow('activities', index, { start: v }, true)}
                      disabled={locked}
                      ariaLabel={`Activity ${index + 1} start`}
                      invalid={rowDateInvalid(row)}
                    />
                  </td>
                  <td data-lt-focus="end">
                    <LtDateField
                      value={row.end}
                      onChange={(v) => updateListRow('activities', index, { end: v }, true)}
                      disabled={locked}
                      ariaLabel={`Activity ${index + 1} finish`}
                      invalid={rowDateInvalid(row)}
                    />
                  </td>
                  <td>
                    <input
                      className={`${styles.cfInp} ${styles.durAuto}`}
                      type="text"
                      value={isDry ? hoursDurationToDays(row.duration) : row.duration}
                      readOnly
                      disabled
                      placeholder="Auto"
                      aria-label={`Activity ${index + 1} duration`}
                    />
                  </td>
                  <td>
                    <LtToggle
                      counting={counting}
                      disabled={locked}
                      onToggle={(nextCounting) => {
                        updateListRow(
                          'activities',
                          index,
                          applyLaytimeActivityLtToggle(row, nextCounting),
                          true,
                        );
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={`${styles.cfInp} ${styles.numSm} ${!isValidLtPartialPercent(row.ltPartial) ? styles.cfInpInvalid : ''}`}
                      type="text"
                      inputMode="decimal"
                      data-lt-focus="ltPartial"
                      value={row.ltPartial ?? ''}
                      onChange={(e) => updateListRow('activities', index, { ltPartial: e.target.value }, true)}
                      disabled={partialDisabled}
                      style={partialDisabled ? { opacity: 0.45 } : undefined}
                      aria-label={`Activity ${index + 1} LT Partial %`}
                      aria-invalid={!isValidLtPartialPercent(row.ltPartial)}
                    />
                  </td>
                  <td>
                    <input
                      className={`${styles.cfInp} ${styles.cumRo} ${cumNeg ? styles.cumNegative : ''}`}
                      type="text"
                      value={row.cumulative ?? ''}
                      readOnly
                      tabIndex={-1}
                      aria-readonly="true"
                      aria-label={`Activity ${index + 1} cumulative`}
                      placeholder="&#8212;"
                    />
                  </td>
                  <td>
                    <textarea
                      className={styles.ltNotesSm}
                      value={row.notes}
                      onChange={(e) => updateListRow('activities', index, { notes: e.target.value })}
                      disabled={locked}
                      placeholder="Notes"
                      aria-label={`Activity ${index + 1} notes`}
                    />
                  </td>
                  <td>
                    <RowActions
                      locked={locked}
                      onInsert={() => insertListRow('activities', index, () => emptyActivityRow(row.end || ''))}
                      onDelete={() => removeListRow('activities', index, emptyActivityRow)}
                    />
                  </td>
                </tr>
              );
            }) : (
              <tr className={styles.cfEmptyRow}>
                <td colSpan={10}>No activities yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DEDUCTIONS */}
      <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadOrange} ${styles.subRibbon}`}>
        <div className={styles.cfSectionTitleWrap}>
          <div className={`${styles.sectionIco} ${styles.sectionIcoOrange}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <div className={styles.cfSectionTitle}>Deductions</div>
            <div className={styles.cfSectionSub}>Time deductions from laytime</div>
          </div>
        </div>
        <SectionHeadRight
          search={dedPage.search}
          onSearch={dedPage.setSearch}
          searchPlaceholder="Search deductions..."
          count={dedPage.filteredCount}
          page={dedPage.page}
          totalPages={dedPage.totalPages}
          onPrev={() => dedPage.setPage(dedPage.page - 1)}
          onNext={() => dedPage.setPage(dedPage.page + 1)}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.cfTable}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th style={{ minWidth: 136 }}>Deduction</th>
              <th style={{ minWidth: 158 }}>Date/Time – Start</th>
              <th style={{ minWidth: 158 }}>Date/Time – Finish</th>
              <th style={{ width: 90 }}>Duration ({durationUnit})</th>
              <th style={{ width: 80 }}>LT Partial %</th>
              <th style={{ width: 100 }}>{isDry ? 'Net Duration (Days)' : 'Net Duration'}</th>
              <th style={{ minWidth: 116 }}>Notes</th>
              <th style={{ width: 48 }} scope="col">
                <span className={styles.ltHiddenPreserve}>Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dedPage.items.length ? dedPage.items.map(({ row, index }, displayIdx) => (
              <tr key={`ded-${index}`} data-lt-row={`deductions-${index}`}>
                <td>{(dedPage.page - 1) * LAYTIME_TANKER_PAGE_SIZE + displayIdx + 1}.</td>
                <td>
                  <input
                    className={styles.cfInp}
                    type="text"
                    value={row.activity}
                    onChange={(e) => updateListRow('deductions', index, { activity: e.target.value })}
                    disabled={locked}
                    placeholder="Deduction"
                    aria-label={`Deduction ${index + 1} name`}
                  />
                </td>
                <td data-lt-focus="start">
                  <LtDateField
                    value={row.start}
                    onChange={(v) => updateListRow('deductions', index, { start: v }, true)}
                    disabled={locked}
                    ariaLabel={`Deduction ${index + 1} start`}
                    invalid={rowDateInvalid(row)}
                  />
                </td>
                <td data-lt-focus="end">
                  <LtDateField
                    value={row.end}
                    onChange={(v) => updateListRow('deductions', index, { end: v }, true)}
                    disabled={locked}
                    ariaLabel={`Deduction ${index + 1} finish`}
                    invalid={rowDateInvalid(row)}
                  />
                </td>
                <td>
                  <input
                    className={`${styles.cfInp} ${styles.durAuto}`}
                    type="text"
                    value={isDry ? hoursDurationToDays(row.duration) : row.duration}
                    readOnly
                    disabled
                    placeholder="Auto"
                    aria-label={`Deduction ${index + 1} duration`}
                  />
                </td>
                <td>
                  <input
                    className={`${styles.cfInp} ${styles.numSm} ${!isValidLtPartialPercent(row.ltPartial) ? styles.cfInpInvalid : ''}`}
                    type="text"
                    inputMode="decimal"
                    data-lt-focus="ltPartial"
                    value={row.ltPartial ?? ''}
                    onChange={(e) => updateListRow('deductions', index, { ltPartial: e.target.value }, true)}
                    disabled={locked}
                    aria-label={`Deduction ${index + 1} LT Partial %`}
                    aria-invalid={!isValidLtPartialPercent(row.ltPartial)}
                  />
                </td>
                <td>
                  <input
                    className={`${styles.cfInp} ${styles.cumRo}`}
                    type="text"
                    value={isDry ? hoursDurationToDays(row.cumulative) : (row.cumulative ?? '')}
                    readOnly
                    disabled
                    aria-label={`Deduction ${index + 1} net duration`}
                  />
                </td>
                <td>
                  <textarea
                    className={styles.ltNotesSm}
                    value={row.notes}
                    onChange={(e) => updateListRow('deductions', index, { notes: e.target.value })}
                    disabled={locked}
                    placeholder="Notes"
                    aria-label={`Deduction ${index + 1} notes`}
                  />
                </td>
                <td>
                  <RowActions
                    locked={locked}
                    onInsert={() => insertListRow('deductions', index, emptyDeductionRow)}
                    onDelete={() => removeListRow('deductions', index, emptyDeductionRow)}
                  />
                </td>
              </tr>
            )) : (
              <tr className={styles.cfEmptyRow}>
                <td colSpan={9}>No deductions yet.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className={styles.totalsRow}>
              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 800, paddingRight: 16 }}>Totals</td>
              <td><span>{dedTotals.dur}</span></td>
              <td />
              <td><span>{dedTotals.net}</span></td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <NegoDialogues portKey={portKey} locked={locked} LtDateField={LtDateField} />
    </div>
  );
}
