import React from 'react';
import styles from './UpdateEstimatePage.module.css';

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
      <i className="bi bi-trash3" aria-hidden />
    </button>
  );
}
