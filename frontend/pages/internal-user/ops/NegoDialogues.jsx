import React, { useState } from 'react';
import { CardSelect, Textarea, TextInput } from '@bainbridge/shared-ui';
import SectionHeadRight from './LaytimeSectionHeadRight.jsx';
import { TableRowActions, usePagedSearch } from './LaytimeTableControls.jsx';
import { formatNegotiationTotal, readNegotiationCents } from './laytimeNegotiations.js';
import styles from './OpsVcLaytimePage.module.css';

const DIALOGUE_FIELDS = ['entity', 'date', 'reason', 'agreedDemm', 'statusLabel', 'notes'];
const DIALOGUE_ENTITIES = [
  { value: 'CHARTERER', label: 'Charterer', abbreviation: 'C' },
  { value: 'OWNER', label: 'Owner', abbreviation: 'O' },
];
const ENTITY_FILTERS = [{ value: '', label: 'All entities', abbreviation: 'ALL' }, ...DIALOGUE_ENTITIES];
const DIALOGUE_STATUSES = [
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'UNDER_NEGO', label: 'Under Nego' },
  { value: 'COMPLETED', label: 'Completed' },
];

function emptyDialogue(draftKey, entity = 'CHARTERER') {
  return { draftKey, entity, date: '', reason: '', agreedDemm: '', status: 'ON_HOLD', notes: '' };
}

const placeholder = emptyDialogue('placeholder');
const displayedRows = (rows) => rows.length ? rows : [placeholder];
const rowKey = (row) => row.id ?? row.draftKey;
let nextDraftKey = 0;

export default function NegoDialogues({ portKey, locked, LtDateField, negotiations, onChange }) {
  const [entity, setEntity] = useState('');
  const rows = displayedRows(negotiations.rows);
  const searchable = rows.map((row) => ({ ...row, statusLabel: DIALOGUE_STATUSES.find((status) => status.value === row.status)?.label }));
  const page = usePagedSearch(searchable, DIALOGUE_FIELDS, portKey, entity);
  const total = formatNegotiationTotal(negotiations.rows);

  const change = (key, field, value) => onChange((draft) => ({
    ...draft,
    rows: displayedRows(draft.rows).map((row) => rowKey(row) === key ? { ...row, [field]: value } : row),
  }));

  const insert = (index, rowEntity) => {
    const row = emptyDialogue(`new-${++nextDraftKey}`, rowEntity);
    onChange((draft) => {
      const current = displayedRows(draft.rows);
      return { ...draft, rows: [...current.slice(0, index + 1), row, ...current.slice(index + 1)] };
    });
  };

  const remove = (row) => onChange((draft) => ({
    ...draft,
    rows: draft.rows.filter((item) => rowKey(item) !== rowKey(row)),
    deletedIds: row.id ? [...draft.deletedIds, row.id] : draft.deletedIds,
  }));

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
          </div>
        </div>
        <SectionHeadRight
          pagination={page}
          section="Nego dialogues"
          searchPlaceholder="Search dialogues..."
        />
      </div>
      <div className={styles.tableWrap}>
        <table className={`${styles.cfTable} ${styles.negoTable}`}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th scope="col" style={{ minWidth: 110 }}>
                Entity
                <span className={styles.negoEntityFilter} role="group" aria-label="Filter dialogues by entity">
                  {ENTITY_FILTERS.map(({ value, label, abbreviation }) => (
                    <button
                      key={value}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={entity === value}
                      onClick={() => { setEntity(value); page.setPage(1); }}
                    >
                      {abbreviation}
                    </button>
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
              const invalidAmount = Boolean(row.agreedDemm.trim()) && readNegotiationCents(row.agreedDemm) == null;
              return (
                <tr key={rowKey(row)}>
                  <td>{index + 1}.</td>
                  <td>
                    <CardSelect
                      options={DIALOGUE_ENTITIES}
                      value={row.entity}
                      onChange={(value) => change(rowKey(row), 'entity', value)}
                      disabled={locked}
                      ariaLabel={`${label} entity`}
                      align="start"
                    />
                  </td>
                  <td>
                    <LtDateField
                      value={row.date}
                      onChange={(value) => change(rowKey(row), 'date', value)}
                      disabled={locked}
                      ariaLabel={`${label} date`}
                    />
                  </td>
                  <td>
                    <TextInput
                      className={styles.tableInput}
                      value={row.reason}
                      onChange={(e) => change(rowKey(row), 'reason', e.target.value)}
                      disabled={locked}
                      aria-label={`${label} reason`}
                    />
                  </td>
                  <td>
                    <TextInput
                      className={`${styles.tableInput} ${styles.numSm} ${styles.negoAgreedInp} ${invalidAmount ? styles.cfInpInvalid : ''}`}
                      inputMode="decimal"
                      value={row.agreedDemm}
                      onChange={(e) => change(rowKey(row), 'agreedDemm', e.target.value)}
                      disabled={locked}
                      placeholder="USD"
                      aria-label={`${label} agreed demurrage in USD`}
                      aria-invalid={invalidAmount}
                    />
                  </td>
                  <td className={styles.negoStatus} data-status={row.status}>
                    <CardSelect
                      options={DIALOGUE_STATUSES}
                      value={row.status}
                      onChange={(value) => change(rowKey(row), 'status', value)}
                      disabled={locked || row.retained}
                      ariaLabel={`${label} status`}
                      align="start"
                    />
                  </td>
                  <td>
                    <Textarea rows={1}
                      className={styles.ltNotesSm}
                      value={row.notes}
                      onChange={(e) => change(rowKey(row), 'notes', e.target.value)}
                      disabled={locked}
                      aria-label={`${label} notes`}
                    />
                  </td>
                  <td>
                    <TableRowActions
                      locked={locked}
                      onInsert={() => insert(index, row.entity)}
                      onDelete={row.retained ? undefined : () => remove(row)}
                    />
                  </td>
                </tr>
              );
            }) : <tr className={styles.cfEmptyRow}><td colSpan={8}>No dialogues match the filters.</td></tr>}
          </tbody>
          <tfoot>
            <tr className={styles.totalsRow}>
              <td colSpan={3} className={styles.negoTotalLabel}>Total dialogue amounts (USD, all statuses)</td>
              <td />
              <td>{total}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
