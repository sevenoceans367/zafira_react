import React from 'react';
import { Link } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import styles from './EstimateListTableToolbar.module.css';

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SensitivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19V5" />
      <path d="M8 19v-7" />
      <path d="M12 19V9" />
      <path d="M16 19v-4" />
      <path d="M20 19V6" />
    </svg>
  );
}

export default function EstimateListTableToolbar({
  addHref,
  onSensitivityAnalysis,
  sensitivityDisabled = false,
  showSensitivity = true,
}) {
  const sensitivityEnabled = !sensitivityDisabled;
  const resolvedAddHref = addHref?.startsWith('/') && !addHref.startsWith('http')
    ? appPath(addHref)
    : addHref;

  return (
    <div className={styles.actionRow}>
      <Link className={styles.btnAdd} to={resolvedAddHref}>
        <PlusIcon />
        Add
      </Link>
      {showSensitivity ? (
        <button
          type="button"
          className={`${styles.btnSensitivity} ${sensitivityEnabled ? styles.btnSensitivityEnabled : ''}`}
          disabled={sensitivityDisabled}
          title={sensitivityEnabled ? 'Open Sensitivity Analysis for selected estimates' : 'Select more than one row to enable'}
          onClick={onSensitivityAnalysis}
        >
          <SensitivityIcon />
          Sensitivity Analysis
        </button>
      ) : null}
    </div>
  );
}
