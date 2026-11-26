import React, { useMemo } from 'react';
import { Textarea, TextInput, Toggle } from '@bainbridge/shared-ui';
import SectionHeadRight from './LaytimeSectionHeadRight.jsx';
import { TableRowActions, usePagedSearch } from './LaytimeTableControls.jsx';
import NegoDialogues from './NegoDialogues.jsx';
import {
  applyLaytimeActivityLtToggle,
  isLaytimeActivityCounting,
} from './laytimeTankerHelpers.js';
import { isValidLtPartialPercent, validateDateRangeOrder } from './laytimeTankerValidation.js';
import { hoursDurationToDays } from './sofTankerHelpers.js';
import styles from './OpsVcLaytimePage.module.css';

function rowDateInvalid(row) {
  return !validateDateRangeOrder(row.start, row.end, { allowIncomplete: true }).ok;
}

function LtToggle({ counting, disabled, onToggle }) {
  return (
    <div className={styles.ltToggleWrap}>
      <span className={counting ? styles.ltToggleActiveLabel : styles.ltToggleLbl} aria-hidden>C</span>
      <Toggle
        checked={counting}
        onChange={(event) => onToggle(event.target.checked)}
        disabled={disabled}
        aria-label="Count toward laytime"
        className={styles.ltCountSwitch}
      />
      <span className={counting ? styles.ltToggleLbl : styles.ltToggleActiveLabel} aria-hidden>NC</span>
    </div>
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
  onChangeNegotiations,
  saving,
}) {
  const activities = draft?.activities || [];
  const deductions = draft?.deductions || [];

  const fields = ['activity', 'notes', 'start', 'end'];
  const actPage = usePagedSearch(activities, fields, portKey);
  const dedPage = usePagedSearch(deductions, fields, portKey);

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
                : isDry ? 'Enter cargo quantity and rate to calculate Cumulative.' : 'Enter Laytime Allowed in the summary to calculate Cumulative.'}
            </div>
          </div>
        </div>
        <SectionHeadRight
          pagination={actPage}
          section="Activities"
          searchPlaceholder="Search activities..."
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
            {actPage.items.length ? actPage.items.map(({ row, index }) => {
              const counting = isDry ? Boolean(row.ltCounts) : isLaytimeActivityCounting(row);
              const cumNum = Number(row.cumulative);
              const cumNeg = Number.isFinite(cumNum) && cumNum < 0;
              const partialDisabled = locked || !counting;
              return (
                <tr key={`act-${index}`} data-lt-row={`activities-${index}`}>
                  <td>{index + 1}.</td>
                  <td>
                    <TextInput
                      className={styles.tableInput}
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
                    <TextInput
                      className={styles.tableInput}
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
                    <TextInput
                      className={`${styles.tableInput} ${styles.numSm} ${!isValidLtPartialPercent(row.ltPartial) ? styles.cfInpInvalid : ''}`}
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
                    <TextInput
                      className={`${styles.tableInput} ${cumNeg ? styles.cumNegative : ''}`}
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
                    <Textarea rows={1}
                      className={styles.ltNotesSm}
                      value={row.notes}
                      onChange={(e) => updateListRow('activities', index, { notes: e.target.value })}
                      disabled={locked}
                      placeholder="Notes"
                      aria-label={`Activity ${index + 1} notes`}
                    />
                  </td>
                  <td>
                    <TableRowActions
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
          pagination={dedPage}
          section="Deductions"
          searchPlaceholder="Search deductions..."
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
            {dedPage.items.length ? dedPage.items.map(({ row, index }) => (
              <tr key={`ded-${index}`} data-lt-row={`deductions-${index}`}>
                <td>{index + 1}.</td>
                <td>
                  <TextInput
                    className={styles.tableInput}
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
                  <TextInput
                    className={styles.tableInput}
                    type="text"
                    value={isDry ? hoursDurationToDays(row.duration) : row.duration}
                    readOnly
                    disabled
                    placeholder="Auto"
                    aria-label={`Deduction ${index + 1} duration`}
                  />
                </td>
                <td>
                  <TextInput
                    className={`${styles.tableInput} ${styles.numSm} ${!isValidLtPartialPercent(row.ltPartial) ? styles.cfInpInvalid : ''}`}
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
                  <TextInput
                    className={styles.tableInput}
                    type="text"
                    value={isDry ? hoursDurationToDays(row.cumulative) : (row.cumulative ?? '')}
                    readOnly
                    disabled
                    aria-label={`Deduction ${index + 1} net duration`}
                  />
                </td>
                <td>
                  <Textarea rows={1}
                    className={styles.ltNotesSm}
                    value={row.notes}
                    onChange={(e) => updateListRow('deductions', index, { notes: e.target.value })}
                    disabled={locked}
                    placeholder="Notes"
                    aria-label={`Deduction ${index + 1} notes`}
                  />
                </td>
                <td>
                  <TableRowActions
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

      {draft.negotiations && (
        <NegoDialogues
          key={portKey}
          portKey={portKey}
          locked={locked || saving}
          LtDateField={LtDateField}
          negotiations={draft.negotiations}
          onChange={onChangeNegotiations}
        />
      )}
    </div>
  );
}
