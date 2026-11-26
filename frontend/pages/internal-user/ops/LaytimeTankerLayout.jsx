import React, { useState } from 'react';
import { AttachmentDropzone, Button, Textarea, TextInput, Toggle } from '@bainbridge/shared-ui';
import { attachmentUrl } from '@bainbridge/shared-routing';
import LaytimeTankerSummaryPill from './LaytimeTankerSummaryPill.jsx';
import LaytimeTankerTables from './LaytimeTankerTables.jsx';
import {
  getTankerEntityValue,
  setTankerEntityValue,
} from './laytimeTankerHelpers.js';
import { isBlankOrFiniteNumber, parseStrictDisplayDateTime, validateNamedEntityDates } from './laytimeTankerValidation.js';
import { PortTabLabel } from './portTabLabel.jsx';
import sofStyles from './OpsVcSofTanker.module.css';
import styles from './OpsVcLaytimePage.module.css';

const TIMING_FIELDS = [
  ['norTendered', 'NOR Tendered'],
  ['norAccepted', 'NOR Accepted'],
  ['allClear', 'All Clear', true],
  ['loadCommenced', 'Cargo Commenced'],
  ['loadCompleted', 'Cargo Completed'],
  ['startCounting', 'Laytime Starts'],
  ['laytimeEnds', 'Laytime Ends', true],
  ['demmStarts', 'DEMM Starts', true],
];
function dateFieldInvalid(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  return !parseStrictDisplayDateTime(raw);
}

function PortTypeIcon({ portType }) {
  if (portType === 'DP') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22V9" />
        <path d="M18 15l-6-6-6 6" />
        <path d="M4 4h16" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v13" />
      <path d="M6 9l6 6 6-6" />
      <path d="M4 20h16" />
    </svg>
  );
}

function LaytimeOption({ id, label, checked, disabled, onChange }) {
  return (
    <div className={styles.ltOption}>
      <Toggle id={id} checked={checked} onChange={onChange} disabled={disabled} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

function displayStoredFileName(stored) {
  const raw = String(stored || '').trim();
  const match = raw.match(/^\d+_(.+)$/);
  return match ? match[1] : raw;
}

function ReadonlyDash({ value }) {
  const raw = String(value ?? '').trim();
  return <span className={styles.ltDetailVal} data-empty={!raw}>{raw || '—'}</span>;
}

/**
 * Tanker-only Laytime shell (NAK-166 compact pill variant).
 * Dry / Gas / unknown continue on the existing OpsVcLaytimePage layout.
 */
export default function LaytimeTankerLayout({
  form,
  activeKey,
  setActiveKey,
  activePort,
  draft,
  locked,
  saving,
  unitUnknown,
  unitShort,
  pendingFiles,
  approverOptions,
  LtDateField,
  patchDraft,
  updateListRow,
  insertListRow,
  removeListRow,
  emptyActivityRow,
  emptyDeductionRow,
  setApprovers,
  addPendingFiles,
  removePendingFile,
  handleSubmit,
  handleOpen,
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const cargoSummary = (form?.cargo || []).join(', ') || '—';

  // Operator/Charterer: voyage metadata. Agent: port nominated vendor (read-only).
  // All Clear / Laytime Ends / DEMM Starts: laytime_slave2 / SOF point entityRows (not master columns).
  const operatorName = form?.operatorName || '';
  const chartererName = form?.charterer || form?.chartererName || '';
  const agentName = activePort?.agentName || '';
  const invalidEntity = validateNamedEntityDates(draft?.entityRows).field;
  const invalidQty = !isBlankOrFiniteNumber(draft?.loadedQty);

  return (
    <div className={styles.ltTankerRoot}>
      <div className={`${sofStyles.portTabs} ${styles.ltPortTabs}`} role="group" aria-label="Laytime port calls">
        {(form.ports || []).map((port) => {
          const isActive = port.key === activeKey;
          // Same SOF Tanker port-tab chrome (navy active fill for both LP/DP; LP/DP only tint the icon).
          const icoTone = port.portType === 'DP' ? sofStyles.ptIcoDp : sofStyles.ptIcoLp;
          return (
            <button
              key={port.key}
              type="button"
              className={isActive ? `${sofStyles.portTab} ${sofStyles.portTabActive}` : sofStyles.portTab}
              onClick={() => setActiveKey(port.key)}
              aria-pressed={isActive}
              data-laytime-interactive="true"
            >
              <span className={`${sofStyles.ptIco} ${icoTone}`}>
                <PortTypeIcon portType={port.portType} />
              </span>
              <PortTabLabel label={port.tabLabel} />
            </button>
          );
        })}
      </div>

      {activePort && draft ? (
        <div className={styles.ltContent}>
          {/* DETAILS */}
          <div className={styles.cfSection}>
            <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadBlue}`}>
              <div className={styles.cfSectionTitleWrap}>
                <div className={`${styles.sectionIco} ${styles.sectionIcoBlue}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div>
                  <div className={styles.cfSectionTitle}>Details</div>
                  <div className={styles.cfSectionSub}>Cargo identifiers &amp; timing</div>
                </div>
              </div>
            </div>

            <div className={styles.ltDetailsGrid}>
              <div className={styles.ltDetailCell}>
                <span className={styles.ltDetailLabel}>Cargo</span>
                <ReadonlyDash value={cargoSummary} />
              </div>
              <div className={styles.ltDetailCell} data-field="loadedQty">
                <label className={styles.ltDetailLabel} htmlFor="loadedQty">QTY (MT)</label>
                <TextInput
                  id="loadedQty"
                  className={invalidQty ? styles.cfInpInvalid : undefined}
                  aria-invalid={invalidQty}
                  type="text"
                  value={draft.loadedQty ?? ''}
                  onChange={(e) => patchDraft(
                    { loadedQty: e.target.value },
                    // Legacy Fun158==2: contractual Laytime Allowed stays editable; do not
                    // overwrite from qty/rate on every QTY keystroke.
                    { recompute: true },
                  )}
                  disabled={locked}
                  placeholder="0.00"
                />
              </div>
              <div className={styles.ltDetailCell} data-field="terminal">
                <label className={styles.ltDetailLabel} htmlFor="terminal">Terminal / Berth</label>
                <TextInput
                  id="terminal"
                  type="text"
                  value={draft.terminal}
                  onChange={(e) => patchDraft({ terminal: e.target.value })}
                  disabled={locked}
                  placeholder="Enter terminal / berth"
                />
              </div>
              <div className={styles.ltDetailCell}>
                <span className={styles.ltDetailLabel}>Operator</span>
                <ReadonlyDash value={operatorName} />
              </div>
              <div className={styles.ltDetailCell}>
                <span className={styles.ltDetailLabel}>Charterer</span>
                <ReadonlyDash value={chartererName} />
              </div>
              <div className={styles.ltDetailCell}>
                <span className={styles.ltDetailLabel}>Agent</span>
                <ReadonlyDash value={agentName} />
              </div>
            </div>

            <div className={styles.ltTimingGrid}>
              {TIMING_FIELDS.map(([key, label, entity]) => {
                const value = entity ? getTankerEntityValue(draft.entityRows, key) : draft[key];
                const invalid = invalidEntity === key || dateFieldInvalid(value);
                return (
                  <div
                    key={key}
                    data-field={key}
                    className={`${styles.ltTimingCell} ${key === 'demmStarts' ? styles.demmCell : ''}`}
                  >
                    <label className={styles.ltDetailLabel} htmlFor={key}>{label}</label>
                    <LtDateField
                      id={key}
                      value={value}
                      onChange={(date) => patchDraft(entity
                        ? { entityRows: setTankerEntityValue(draft.entityRows, key, date) }
                        : { [key]: date })}
                      disabled={locked}
                      ariaLabel={label}
                      invalid={invalid}
                    />
                  </div>
                );
              })}
            </div>

          </div>

          {/* LAYTIME OPTIONS */}
          <div className={styles.cfSection}>
            <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadBlue}`}>
              <div className={styles.cfSectionTitleWrap}>
                <div className={`${styles.sectionIco} ${styles.sectionIcoBlue}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className={styles.cfSectionTitle}>Laytime Options</div>
              </div>
            </div>
            <div className={styles.ltBody}>
              <div className={styles.ltOptrow} style={{ marginBottom: 16 }}>
                <div className={styles.ltPortManual}>
                  <label className={styles.ltOptlabel} htmlFor="portNameManual">Port Name (Manual)</label>
                  <TextInput
                    id="portNameManual"
                      type="text"
                    value={draft.portNameManual}
                    onChange={(e) => patchDraft({ portNameManual: e.target.value })}
                    disabled={locked}
                    placeholder="Enter port name"
                  />
                </div>
              </div>
              <div className={styles.ltOptrow}>
                <span className={styles.ltOptlabel}>Options</span>
                <div className={styles.ltPillgroup}>
                  <LaytimeOption
                    id="laytimeDetention"
                    label="Detention"
                    checked={Boolean(draft.detention)}
                    disabled={locked}
                    onChange={(event) => patchDraft({ detention: event.target.checked })}
                  />
                  <LaytimeOption
                    id="laytimeReversible"
                    label="Reversible"
                    checked={Boolean(draft.reversible)}
                    disabled={locked}
                    onChange={(event) => patchDraft({ reversible: event.target.checked })}
                  />
                </div>
              </div>
            </div>
          </div>

          <LaytimeTankerTables
            key={form.comId}
            portKey={activeKey}
            draft={draft}
            locked={locked}
            LtDateField={LtDateField}
            updateListRow={updateListRow}
            insertListRow={insertListRow}
            removeListRow={removeListRow}
            emptyActivityRow={emptyActivityRow}
            emptyDeductionRow={emptyDeductionRow}
          />

          {/* REMARKS */}
          <div className={styles.cfSection}>
            <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadGrey}`}>
              <div className={styles.cfSectionTitleWrap}>
                <div className={`${styles.sectionIco} ${styles.sectionIcoGrey}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className={styles.cfSectionTitle}>Remarks</div>
              </div>
            </div>
            <div className={styles.ltBody}>
              <Textarea
                aria-label="Remarks"
                value={draft.remarks}
                onChange={(e) => patchDraft({ remarks: e.target.value })}
                disabled={locked}
                placeholder="Add remarks about this laytime calculation..."
              />
            </div>
          </div>

          {/* DOCUMENTS */}
          <div className={styles.cfSection}>
            <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadGrey}`}>
              <div className={styles.cfSectionTitleWrap}>
                <div className={`${styles.sectionIco} ${styles.sectionIcoGrey}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </div>
                <div className={styles.cfSectionTitle}>Documents &amp; Attachments</div>
              </div>
            </div>
            <div className={styles.ltBody} data-attachment-dropzone data-laytime-interactive="true">
              <AttachmentDropzone
                readOnly={locked}
                files={pendingFiles}
                existing={(draft.keepFiles || []).map((file) => ({
                  key: file,
                  file,
                  name: displayStoredFileName(file),
                  url: attachmentUrl(file),
                }))}
                onAddFiles={addPendingFiles}
                onRemoveFile={removePendingFile}
                onRemoveExisting={(item) => patchDraft({
                  keepFiles: (draft.keepFiles || []).filter((name) => name !== item.file),
                })}
                emptyLabel="No documents uploaded yet."
              />
            </div>
          </div>

          <div className={styles.ltBottomDock}>
            <div className={styles.ltSummaryFloat} data-lt-summary-float>
              <LaytimeTankerSummaryPill
                open={summaryOpen}
                onOpen={() => setSummaryOpen(true)}
                onClose={() => setSummaryOpen(false)}
                draft={draft}
                unitShort={unitShort}
                locked={locked}
                unitUnknown={unitUnknown}
                saving={saving}
                approverOptions={approverOptions}
                setApprovers={setApprovers}
                onPatchDraft={patchDraft}
                onSendForApproval={() => handleSubmit(1)}
              />
            </div>

            <div className={styles.sofFooterBar}>
              {!locked ? (
                <>
                  <div className={styles.sofFooterNote}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  Send for Approval from the summary. Close Laytime locks this port.
                  </div>
                  <div className={styles.sofFooterActions}>
                    <Button
                      type="button"
                      variant="saveOutline"
                      label="Save"
                      onClick={() => handleSubmit(0)}
                      disabled={saving || unitUnknown}
                      title={unitUnknown ? 'Blocked: Laytime unit unknown' : undefined}
                    />
                    <Button
                      type="button"
                      variant="saveOutline"
                      icon="lock"
                      label="Close Laytime"
                      onClick={() => handleSubmit(5)}
                      disabled={saving || unitUnknown}
                      title={unitUnknown ? 'Blocked: Laytime unit unknown' : undefined}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.lockedNote}>This Laytime is locked / closed.</p>
                  {form?.canOpen ? (
                    <Button
                      type="button"
                      variant="submit"
                      label="Open"
                      onClick={handleOpen}
                      disabled={saving || unitUnknown}
                      title={unitUnknown ? 'Blocked: Laytime unit unknown' : undefined}
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
