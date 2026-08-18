import React from 'react';
import styles from './OpsPages.module.css';

export default function OpsChecklistTimeline({ steps = [], wipId, statusLabel }) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>Ops Checklist (WIP)</h4>
      <p className={styles.checklistLead}>
        Chronological ACT events. Dates auto-update from Voyage Financials, SOF and reports.
        {statusLabel && statusLabel !== '—' ? (
          <> Current activity: <strong>{statusLabel}</strong>.</>
        ) : (
          <> Current activity: <strong>—</strong> until an operational step is recorded.</>
        )}
      </p>
      <ol className={styles.checklistTimeline}>
        {steps.map((step) => {
          const state = step.done ? 'done' : step.id === wipId ? 'wip' : step.started ? 'started' : 'todo';
          return (
            <li key={step.id} className={`${styles.checklistStep} ${styles[`checklistStep_${state}`] || ''}`}>
              <span className={styles.checklistMarker} aria-hidden />
              <div className={styles.checklistStepBody}>
                <div className={styles.checklistStepHead}>
                  <span className={styles.checklistStepLabel}>{step.label}</span>
                  <span className={styles.checklistStepState}>
                    {state === 'done' ? 'Done' : state === 'wip' ? 'WIP' : state === 'started' ? 'In progress' : 'Pending'}
                  </span>
                </div>
                <div className={styles.checklistStepMeta}>
                  <span>{step.at || '—'}</span>
                  {step.source ? <span className={styles.checklistSource}>{step.source}</span> : null}
                  {step.detail ? <span>{step.detail}</span> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
