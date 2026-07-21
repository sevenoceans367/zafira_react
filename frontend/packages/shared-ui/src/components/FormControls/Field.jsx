import React from 'react';
import styles from './FormControls.module.css';

/**
 * Labeled form field wrapper — label + control + optional hint/error.
 */
export default function Field({
  id,
  label,
  hint,
  error,
  children,
  className = '',
}) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label ? (
        <label className={styles.fieldLabel} htmlFor={id}>
          {label}
        </label>
      ) : null}
      {children}
      {hint && !error ? <span className={styles.hint}>{hint}</span> : null}
      {error ? <span className={styles.fieldError} role="alert">{error}</span> : null}
    </div>
  );
}
