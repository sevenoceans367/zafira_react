import React, { useState } from 'react';
import { AttachmentDropzone, Button } from '@bainbridge/shared-ui';
import { attachmentUrl } from '@bainbridge/shared-routing';
import LaytimeTankerSummaryPill from './LaytimeTankerSummaryPill.jsx';
import LaytimeTankerTables from './LaytimeTankerTables.jsx';
import {
  getTankerEntityValue,
  setTankerEntityValue,
  tankerLoadedQtyPatchOptions,
} from './laytimeTankerHelpers.js';
import { parseStrictDisplayDateTime } from './laytimeTankerValidation.js';
import { PortTabLabel } from './portTabLabel.jsx';
import sofStyles from './OpsVcSofTanker.module.css';
import styles from './OpsVcLaytimePage.module.css';

/** Blank OK; non-blank must parse strictly. */
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

function PillOption({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      className={`${styles.ltPill} ${active ? styles.ltPillActive : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      <span className={styles.ltPillCheck} aria-hidden>
        {active ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </span>
      {children}
    </button>
  );
}

function displayStoredFileName(stored) {
  const raw = String(stored || '').trim();
  const match = raw.match(/^\d+_(.+)$/);
  return match ? match[1] : raw;
}

function ReadonlyDash({ value }) {
  const raw = String(value ?? '').trim();
  return <span className={styles.ltDetailVal}>{raw || '—'}</span>;
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
  ApproverTagField,
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
  const allClear = getTankerEntityValue(draft?.entityRows, 'allClear');
  const laytimeEnds = getTankerEntityValue(draft?.entityRows, 'laytimeEnds');
  const demmStarts = getTankerEntityValue(draft?.entityRows, 'demmStarts');
  const patchEntityField = (fieldKey, value) => {
    patchDraft({
      entityRows: setTankerEntityValue(draft?.entityRows, fieldKey, value),
    });
  };

  return (
    <div className={`${styles.ltTankerRoot} ${styles.ltTankerShell}`}>
      <div className={sofStyles.portTabs} role="group" aria-label="Laytime port calls">
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
                <label className={styles.ltDetailLabel}>Cargo</label>
                <ReadonlyDash value={cargoSummary} />
              </div>
              <div className={styles.ltDetailCell} data-field="loadedQty">
                <label className={styles.ltDetailLabel} htmlFor="loadedQty">QTY (MT)</label>
                <input
                  id="loadedQty"
                  className={styles.cfInp}
                  type="text"
                  value={draft.loadedQty ?? ''}
                  onChange={(e) => patchDraft(
                    { loadedQty: e.target.value },
                    // Legacy Fun158==2: contractual Laytime Allowed stays editable; do not
                    // overwrite from qty/rate on every QTY keystroke.
                    tankerLoadedQtyPatchOptions(),
                  )}
                  disabled={locked}
                  placeholder="0.00"
                />
              </div>
              <div className={styles.ltDetailCell} data-field="terminal">
                <label className={styles.ltDetailLabel} htmlFor="terminal">Terminal / Berth</label>
                <input
                  id="terminal"
                  className={styles.cfInp}
                  type="text"
                  value={draft.terminal}
                  onChange={(e) => patchDraft({ terminal: e.target.value })}
                  disabled={locked}
                  placeholder="Enter terminal / berth"
                />
              </div>
              <div className={styles.ltDetailCell}>
                <label className={styles.ltDetailLabel}>Operator</label>
                <ReadonlyDash value={operatorName} />
              </div>
              <div className={styles.ltDetailCell}>
                <label className={styles.ltDetailLabel}>Charterer</label>
                <ReadonlyDash value={chartererName} />
              </div>
              <div className={styles.ltDetailCell}>
                <label className={styles.ltDetailLabel}>Agent</label>
                <ReadonlyDash value={agentName} />
              </div>
            </div>

            <div className={styles.ltTimingGrid}>
              <div className={styles.ltTimingCell} data-field="norTendered">
                <label className={styles.ltDetailLabel} htmlFor="norTendered">NOR Tendered</label>
                <LtDateField
                  id="norTendered"
                  value={draft.norTendered}
                  onChange={(v) => patchDraft({ norTendered: v })}
                  disabled={locked}
                  ariaLabel="NOR Tendered"
                  invalid={dateFieldInvalid(draft.norTendered)}
                />
              </div>
              <div className={styles.ltTimingCell} data-field="norAccepted">
                <label className={styles.ltDetailLabel} htmlFor="norAccepted">NOR Accepted</label>
                <LtDateField
                  id="norAccepted"
                  value={draft.norAccepted}
                  onChange={(v) => patchDraft({ norAccepted: v })}
                  disabled={locked}
                  ariaLabel="NOR Accepted"
                  invalid={dateFieldInvalid(draft.norAccepted)}
                />
              </div>
              <div className={styles.ltTimingCell} data-field="allClear">
                <label className={styles.ltDetailLabel} htmlFor="allClear">All Clear</label>
                <LtDateField
                  id="allClear"
                  value={allClear}
                  onChange={(v) => patchEntityField('allClear', v)}
                  disabled={locked}
                  ariaLabel="All Clear"
                  invalid={dateFieldInvalid(allClear)}
                />
              </div>
              <div className={styles.ltTimingCell} data-field="loadCommenced">
                <label className={styles.ltDetailLabel} htmlFor="loadCommenced">Cargo Commenced</label>
                <LtDateField
                  id="loadCommenced"
                  value={draft.loadCommenced}
                  onChange={(v) => patchDraft({ loadCommenced: v })}
                  disabled={locked}
                  ariaLabel="Cargo Commenced"
                  invalid={dateFieldInvalid(draft.loadCommenced)}
                />
              </div>
              <div className={styles.ltTimingCell} data-field="loadCompleted">
                <label className={styles.ltDetailLabel} htmlFor="loadCompleted">Cargo Completed</label>
                <LtDateField
                  id="loadCompleted"
                  value={draft.loadCompleted}
                  onChange={(v) => patchDraft({ loadCompleted: v })}
                  disabled={locked}
                  ariaLabel="Cargo Completed"
                  invalid={dateFieldInvalid(draft.loadCompleted)}
                />
              </div>
              <div className={styles.ltTimingCell} data-field="startCounting">
                <label className={styles.ltDetailLabel} htmlFor="startCounting">Laytime Starts</label>
                <LtDateField
                  id="startCounting"
                  value={draft.startCounting}
                  onChange={(v) => patchDraft({ startCounting: v })}
                  disabled={locked}
                  ariaLabel="Laytime Starts"
                  invalid={dateFieldInvalid(draft.startCounting)}
                />
              </div>
              <div className={styles.ltTimingCell} data-field="laytimeEnds">
                <label className={styles.ltDetailLabel} htmlFor="laytimeEnds">Laytime Ends</label>
                <LtDateField
                  id="laytimeEnds"
                  value={laytimeEnds}
                  onChange={(v) => patchEntityField('laytimeEnds', v)}
                  disabled={locked}
                  ariaLabel="Laytime Ends"
                  invalid={dateFieldInvalid(laytimeEnds)}
                />
              </div>
              <div className={`${styles.ltTimingCell} ${styles.demmCell}`} data-field="demmStarts">
                <label className={styles.ltDetailLabel} htmlFor="demmStarts">DEMM Starts</label>
                <LtDateField
                  id="demmStarts"
                  value={demmStarts}
                  onChange={(v) => patchEntityField('demmStarts', v)}
                  disabled={locked}
                  ariaLabel="DEMM Starts"
                  invalid={dateFieldInvalid(demmStarts)}
                />
              </div>
            </div>

            {/* Dry-only fields (stowageQty / arrived / sailed / loadedRate / turn / applicable / pilot)
                stay on the draft object for save — no inaccessible hidden DOM. */}
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
                  <input
                    id="portNameManual"
                    className={styles.cfInp}
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
                  <PillOption
                    active={Boolean(draft.detention)}
                    disabled={locked}
                    onClick={() => patchDraft({ detention: !draft.detention })}
                  >
                    Detention
                  </PillOption>
                  <PillOption
                    active={Boolean(draft.reversible)}
                    disabled={locked}
                    onClick={() => patchDraft({ reversible: !draft.reversible })}
                  >
                    Reversible
                  </PillOption>
                </div>
              </div>
            </div>
          </div>

          <LaytimeTankerTables
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
              <textarea
                className={styles.ltRemarksBox}
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

          {/* Floating summary — independent of footer so expand overlays content, never grows chrome. */}
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
              ApproverTagField={ApproverTagField}
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
                  Use “Submit” once laytime figures for every port call are finalised; “Close Laytime” locks the calculation entirely.
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
      ) : null}
    </div>
  );
}
