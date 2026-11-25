import React, { useEffect, useRef } from 'react';
import { Button } from '@bainbridge/shared-ui';
import { formatMoneyDisplay } from './laytimeTankerHelpers.js';
import styles from './OpsVcLaytimePage.module.css';

function SumIco({ tone, children }) {
  return (
    <span className={`${styles.ltSumIcoBox} ${styles[`ltSumIco${tone}`] || ''}`}>
      {children}
    </span>
  );
}

function FieldBox({ children, unit }) {
  return (
    <div className={styles.ltSumFieldBox}>
      {children}
      {unit ? <span className={styles.ltSumHrTag}>{unit}</span> : null}
    </div>
  );
}

/**
 * Compact floating summary FAB (mockup Variant C) + expandable panel.
 * Click-outside closes only on empty space — interactive sheet controls are excluded.
 */
export default function LaytimeTankerSummaryPill({
  open,
  onOpen,
  onClose,
  draft,
  unitShort = 'hrs',
  locked = false,
  unitUnknown = false,
  saving = false,
  approverOptions = [],
  ApproverTagField,
  setApprovers,
  onPatchDraft,
  onSendForApproval,
}) {
  const panelRef = useRef(null);
  const fabRef = useRef(null);
  const demmHrs = Number(draft?.timeToDemurrage) || 0;
  const demmUsd = Number(draft?.ttlDemurrage) || 0;
  const hrTag = unitShort === 'hrs' ? 'HR' : unitShort === 'days' ? 'DAY' : '—';
  // FAB / panel Final Demm = calculated TTL demurrage only — never session nego sum.
  const money = formatMoneyDisplay(demmUsd);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      if (fabRef.current?.contains(event.target)) return;

      const tag = event.target?.tagName;
      const interactiveTags = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'LABEL', 'A', 'OPTION'];
      if (interactiveTags.includes(tag)) return;

      // Match mockup exclusion list — do not close while editing the sheet.
      const interactive = event.target?.closest?.(
        'input, select, textarea, button, label, a, '
        + `.${styles.cfInp}, .${styles.ltDateField}, .${styles.ltToggle}, .${styles.sqBtn}, .${styles.ltPill}, `
        + `.${styles.negoEntitySelect}, .${styles.negoStatusSelect}, `
        + `.${styles.sectionSearchBox}, .${styles.pgBtn}, .${styles.ltRemarksBox}, `
        + `.${styles.fabCloseBtn}, `
        + '[data-attachment-dropzone], '
        + 'td, th, [data-laytime-interactive="true"]',
      );
      if (interactive) return;

      onClose();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) {
    return (
      <button
        ref={fabRef}
        type="button"
        className={styles.ltSummaryFab}
        onClick={onOpen}
        title="Click to expand summary"
        aria-expanded="false"
        aria-controls="lt-tanker-summary-panel"
        data-laytime-interactive="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <div className={styles.fabVals}>
          <div className={styles.fabValItem}>
            <span className={styles.fabNum}>{draft?.laytimeAllowed || '—'}</span>
            <span className={styles.fabLbl}>Allowed</span>
          </div>
          <div className={styles.fabValItem}>
            <span className={styles.fabNum}>{draft?.actualLaytime || '—'}</span>
            <span className={styles.fabLbl}>Actual</span>
          </div>
          <div className={styles.fabValItem}>
            <span className={`${styles.fabNum} ${demmHrs > 0 ? styles.fabNumWarn : ''}`}>
              {draft?.timeToDemurrage || '0'}
            </span>
            <span className={styles.fabLbl}>Demm&nbsp;Hrs</span>
          </div>
          <div className={styles.fabValDivider} />
          <div className={styles.fabValItem}>
            <span className={`${styles.fabNum} ${demmUsd > 0 ? styles.fabNumWarn : ''}`}>
              ${money}
            </span>
            <span className={styles.fabLbl}>Calc&nbsp;Demm</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      id="lt-tanker-summary-panel"
      className={styles.ltSummaryFabExpanded}
      role="region"
      aria-label="Laytime summary"
      aria-expanded="true"
      data-laytime-interactive="true"
    >
      <div className={styles.ltSummaryPanel}>
        <div className={styles.ltSummaryHead}>
          <div className={`${styles.sectionIco} ${styles.sectionIcoNavy}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <div>
            <div className={styles.ltSummaryHeadTitle}>Summary</div>
            <div className={styles.ltSummaryHeadSub}>Laytime calculation results</div>
          </div>
          <button
            type="button"
            className={styles.fabCloseBtn}
            onClick={onClose}
            title="Minimize summary"
            aria-label="Minimize summary"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <div className={styles.ltSummaryBody}>
          <div className={styles.ltSumGrid}>
            <div className={styles.ltSumItemPanel}>
              <div className={styles.ltSumLabelPanel}>
                <SumIco tone="Navy">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </SumIco>
                Laytime Allowed
              </div>
              <div className={styles.ltSumFieldWrap}>
                <FieldBox unit={hrTag}>
                  <input
                    className={styles.ltSumInp}
                    type="text"
                    value={draft?.laytimeAllowed ?? ''}
                    onChange={(e) => onPatchDraft({ laytimeAllowed: e.target.value }, { recompute: true })}
                    disabled={locked}
                    aria-label="Laytime Allowed"
                  />
                </FieldBox>
              </div>
            </div>

            <div className={styles.ltSumItemPanel}>
              <div className={styles.ltSumLabelPanel}>
                <SumIco tone="Navy">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 4h14" />
                    <path d="M5 20h14" />
                    <path d="M7 4v2c0 2.5 2 4.5 5 6c-3 1.5-5 3.5-5 6v2" />
                    <path d="M17 4v2c0 2.5-2 4.5-5 6c3 1.5 5 3.5 5 6v2" />
                  </svg>
                </SumIco>
                Actual Laytime
              </div>
              <div className={styles.ltSumFieldWrap}>
                <FieldBox unit={hrTag}>
                  <div className={styles.ltSumComputed}>{draft?.actualLaytime || '—'}</div>
                </FieldBox>
              </div>
            </div>

            <div className={styles.ltSumItemPanel}>
              <div className={styles.ltSumLabelPanel}>
                <SumIco tone="Red">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </SumIco>
                Demurrage Rate
              </div>
              <div className={styles.ltSumFieldWrap}>
                <input
                  className={styles.ltSumInp}
                  type="text"
                  value={draft?.demurrageRate ?? ''}
                  onChange={(e) => onPatchDraft({ demurrageRate: e.target.value }, { recompute: true })}
                  disabled={locked}
                  placeholder="USD/day"
                  aria-label="Demurrage Rate"
                />
              </div>
            </div>

            <div className={styles.ltSumItemPanel}>
              <div className={styles.ltSumLabelPanel}>
                <SumIco tone="Green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </SumIco>
                Dispatch Rate
              </div>
              <div className={styles.ltSumFieldWrap}>
                <input
                  className={styles.ltSumInp}
                  type="text"
                  value={draft?.despatchRate ?? ''}
                  onChange={(e) => onPatchDraft({ despatchRate: e.target.value }, { recompute: true })}
                  disabled={locked}
                  placeholder="USD/day"
                  aria-label="Dispatch Rate"
                />
              </div>
            </div>

            <div className={styles.ltSumItemPanel}>
              <div className={styles.ltSumLabelPanel}>
                <SumIco tone="Red">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </SumIco>
                Time to Demm
              </div>
              <div className={styles.ltSumFieldWrap}>
                <FieldBox unit={hrTag}>
                  <div className={`${styles.ltSumComputed} ${demmHrs > 0 ? styles.ltSumNegative : ''}`}>
                    {draft?.timeToDemurrage || '0'}
                  </div>
                </FieldBox>
              </div>
            </div>

            <div className={styles.ltSumItemPanel}>
              <div className={styles.ltSumLabelPanel}>
                <SumIco tone="Green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </SumIco>
                Time to Disp
              </div>
              <div className={styles.ltSumFieldWrap}>
                <FieldBox unit={hrTag}>
                  <div className={styles.ltSumComputed}>{draft?.timeToDespatch || '0'}</div>
                </FieldBox>
              </div>
            </div>

            <div className={styles.ltSumItemPanel}>
              <div className={styles.ltSumLabelPanel}>
                <SumIco tone="Red">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </SumIco>
                Demm (USD)
              </div>
              <div className={styles.ltSumFieldWrap}>
                <div className={`${styles.ltSumComputed} ${demmUsd > 0 ? styles.ltSumNegative : ''}`}>
                  {draft?.ttlDemurrage || '0'}
                </div>
              </div>
            </div>

            <div className={styles.ltSumItemPanel}>
              <div className={styles.ltSumLabelPanel}>
                <SumIco tone="Green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </SumIco>
                Disp (USD)
              </div>
              <div className={styles.ltSumFieldWrap}>
                <div className={styles.ltSumComputed}>{draft?.ttlDespatch || '0'}</div>
              </div>
            </div>
          </div>

          <div className={styles.ltSumFinalRow}>
            <div className={styles.ltSumLabelPanel}>
              <SumIco tone="Navy">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </SumIco>
              Calculated Demurrage (USD)
            </div>
            <div className={`${styles.ltSumComputed} ${styles.ltSumFinalVal} ${demmUsd > 0 ? styles.ltSumNegative : ''}`}>
              {money}
            </div>
          </div>

          <hr className={styles.ltApprovalDivider} />
          <div className={styles.ltApprovalHead}>
            <div className={`${styles.sectionIco} ${styles.sectionIcoNavy}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="9" cy="7" r="4" />
                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <span className={styles.ltApprovalTitle}>Assign an Approver</span>
          </div>
          {ApproverTagField ? (
            <ApproverTagField
              options={approverOptions}
              value={draft?.approvers || []}
              onChange={setApprovers}
              disabled={locked}
              orangeChips
            />
          ) : null}

          {!locked ? (
            <div className={styles.ltActionBtns}>
              <Button
                type="button"
                variant="submit"
                label="Send for Approval"
                onClick={onSendForApproval}
                disabled={saving || unitUnknown}
                title={unitUnknown ? 'Blocked: Laytime unit unknown' : undefined}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
