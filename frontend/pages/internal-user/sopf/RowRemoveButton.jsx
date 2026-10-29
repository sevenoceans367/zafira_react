import React from 'react';
import styles from './UpdateEstimatePage.module.css';

/** Same bin glyph as OPEX khaki row actions. */
export function EstimateTrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M6 7V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

/** Small trash control for removable estimate table rows. */
export default function RowRemoveButton({ onClick, title = 'Remove', disabled = false }) {
  return (
    <button
      type="button"
      className={styles.rowRemove}
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
    >
      <EstimateTrashIcon />
    </button>
  );
}
