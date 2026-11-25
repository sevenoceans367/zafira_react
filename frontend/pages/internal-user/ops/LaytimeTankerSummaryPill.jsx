import React, { useEffect, useRef } from 'react';
import { Button } from '@bainbridge/shared-ui';
import { formatMoneyDisplay } from './laytimeTankerHelpers.js';
import { isBlankOrFiniteNumber } from './laytimeTankerValidation.js';
import styles from './OpsVcLaytimePage.module.css';

const iconPaths = {
  summary: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  hourglass: <path d="M5 4h14M5 20h14M7 4v2c0 2.5 2 4.5 5 6c-3 1.5-5 3.5-5 6v2M17 4v2c0 2.5-2 4.5-5 6c3 1.5 5 3.5 5 6v2" />,
  warning: <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />,
  check: <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4l-10 10-3-3" />,
  dollar: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  close: <path d="m6 9 6 6 6-6" />,
  approver: <><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m4-13v6m-3-3h6" /></>,
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {iconPaths[name]}
    </svg>
  );
}

function MetricLabel({ label, icon, tone = 'Navy' }) {
  return (
    <div className={styles.ltSumLabelPanel}>
      <span className={`${styles.ltSumIcoBox} ${styles[`ltSumIco${tone}`]}`}>
        <Icon name={icon} />
      </span>
      {label}
    </div>
  );
}

const metrics = [
  { key: 'laytimeAllowed', label: 'Laytime Allowed', icon: 'clock', hours: true, editable: true },
  { key: 'actualLaytime', label: 'Actual Laytime', icon: 'hourglass', hours: true },
  { key: 'demurrageRate', label: 'Demurrage Rate', icon: 'warning', tone: 'Red', editable: true },
  { key: 'despatchRate', label: 'Dispatch Rate', icon: 'check', tone: 'Green', editable: true },
  { key: 'timeToDemurrage', label: 'Time to Demm', icon: 'warning', tone: 'Red', hours: true },
  { key: 'timeToDespatch', label: 'Time to Disp', icon: 'check', tone: 'Green', hours: true },
  { key: 'ttlDemurrage', label: 'Demm (USD)', icon: 'dollar', tone: 'Red' },
  { key: 'ttlDespatch', label: 'Disp (USD)', icon: 'dollar', tone: 'Green' },
];

function SummaryMetric({ metric, value, unit, disabled, onChange }) {
  const { key, label, icon, tone, hours, editable } = metric;
  const invalid = editable && !isBlankOrFiniteNumber(value);
  const warning = tone === 'Red' && Number(value) > 0;
  const field = editable ? (
    <input
      id={key}
      className={`${styles.ltSumInp} ${invalid ? styles.cfInpInvalid : ''}`}
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={hours ? undefined : 'USD/day'}
      aria-label={label}
      aria-invalid={invalid}
    />
  ) : <div className={`${styles.ltSumComputed} ${warning ? styles.ltSumNegative : ''}`}>{value}</div>;
  return (
    <div className={styles.ltSumItemPanel}>
      <MetricLabel label={label} icon={icon} tone={tone} />
      <div className={styles.ltSumFieldWrap}>
        {hours ? (
          <div className={styles.ltSumFieldBox}>
            {field}
            <span className={styles.ltSumHrTag}>{unit}</span>
          </div>
        ) : field}
      </div>
    </div>
  );
}

export default function LaytimeTankerSummaryPill({
  open,
  onOpen,
  onClose,
  draft,
  unitShort,
  locked,
  unitUnknown,
  saving,
  approverOptions,
  ApproverTagField,
  setApprovers,
  onPatchDraft,
  onSendForApproval,
}) {
  const panelRef = useRef(null);
  const fabRef = useRef(null);
  const wasOpenRef = useRef(false);
  const unavailable = draft.calcUnavailable;
  const unit = unitShort === 'hrs' ? 'HR' : unitShort === 'days' ? 'DAY' : '—';
  const computed = (key) => unavailable ? '—' : draft[key] || (key === 'actualLaytime' ? '—' : '0');
  const money = unavailable ? '—' : formatMoneyDisplay(draft.ttlDemurrage);
  const summaryValues = [
    ['Allowed', draft.laytimeAllowed || '—'],
    ['Actual', computed('actualLaytime')],
    ['Demm Hrs', computed('timeToDemurrage'), !unavailable && Number(draft.timeToDemurrage) > 0],
    [unavailable ? 'Unavailable' : 'Calc Demm', unavailable ? money : `$${money}`, !unavailable && Number(draft.ttlDemurrage) > 0],
  ];

  useEffect(() => {
    window.addEventListener('lt-tanker-open-summary', onOpen);
    return () => window.removeEventListener('lt-tanker-open-summary', onOpen);
  }, [onOpen]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector('button')?.focus({ preventScroll: true });
    else if (wasOpenRef.current) fabRef.current?.focus({ preventScroll: true });
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = ({ target }) => {
      const formControl = target.closest?.(
        'input, select, textarea, button, label, a, td, th, .flatpickr-calendar, [data-attachment-dropzone], [data-laytime-interactive]',
      );
      if (!panelRef.current?.contains(target) && !formControl) onClose();
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return (
      <button
        ref={fabRef}
        type="button"
        className={`${styles.ltSummaryFab} ${unavailable ? styles.ltSummaryFabUnavailable : ''}`}
        onClick={onOpen}
        title={unavailable ? 'Calculations unavailable' : 'Expand laytime summary'}
        aria-expanded="false"
      >
        <Icon name="summary" />
        <div className={styles.fabVals}>
          {summaryValues.map(([label, value, warning], index) => (
            <React.Fragment key={label}>
              {index === 3 ? <div className={styles.fabValDivider} /> : null}
              <div className={styles.fabValItem}>
                <span className={`${styles.fabNum} ${warning ? styles.fabNumWarn : ''}`}>{value}</span>
                <span className={styles.fabLbl}>{label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </button>
    );
  }

  return (
    <div ref={panelRef} className={styles.ltSummaryFabExpanded} role="region" aria-label="Laytime summary">
      <div className={styles.ltSummaryHead}>
        <div className={`${styles.sectionIco} ${styles.sectionIcoNavy}`}><Icon name="summary" /></div>
        <div>
          <div className={styles.ltSummaryHeadTitle}>Summary</div>
          <div className={styles.ltSummaryHeadSub}>
            {unavailable ? 'Calculations unavailable. Correct the highlighted fields.' : 'Laytime calculation results'}
          </div>
        </div>
        <button type="button" className={styles.fabCloseBtn} onClick={onClose} aria-label="Minimize summary">
          <Icon name="close" />
        </button>
      </div>
      <div className={styles.ltSummaryBody}>
        <div className={styles.ltSumGrid}>
          {metrics.map((metric) => (
            <SummaryMetric
              key={metric.key}
              metric={metric}
              value={metric.editable ? draft[metric.key] ?? '' : computed(metric.key)}
              unit={unit}
              disabled={locked}
              onChange={(value) => onPatchDraft({ [metric.key]: value }, { recompute: true })}
            />
          ))}
        </div>
        <div className={styles.ltSumFinalRow}>
          <MetricLabel label="Calculated Demurrage (USD)" icon="dollar" />
          <div className={`${styles.ltSumComputed} ${styles.ltSumFinalVal} ${!unavailable && Number(draft.ttlDemurrage) > 0 ? styles.ltSumNegative : ''}`}>
            {money}
          </div>
        </div>
        <hr className={styles.ltApprovalDivider} />
        <div className={styles.ltApprovalHead}>
          <div className={`${styles.sectionIco} ${styles.sectionIcoNavy}`}><Icon name="approver" /></div>
          <span className={styles.ltApprovalTitle}>Assign an Approver</span>
        </div>
        <ApproverTagField
          options={approverOptions}
          value={draft.approvers ?? []}
          onChange={setApprovers}
          disabled={locked}
          orangeChips
          restrictToOptions
        />
        {!locked ? (
          <div className={styles.ltActionBtns}>
            <Button
              type="button"
              variant="submit"
              label="Send for Approval"
              onClick={onSendForApproval}
              disabled={saving || unitUnknown}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
