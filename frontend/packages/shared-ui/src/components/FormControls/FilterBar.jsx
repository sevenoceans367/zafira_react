import React from 'react';
import styles from './FormControls.module.css';

/**
 * List-page filter toolbar: filter fields on the left, actions on the right.
 */
export function FilterBar({ children, actions, className = '' }) {
  const hasFilters = children != null && children !== false;
  return (
    <div className={[styles.filterBar, className].filter(Boolean).join(' ')}>
      {hasFilters ? <div className={styles.filters}>{children}</div> : null}
      {actions ? <div className={styles.filterActions}>{actions}</div> : null}
    </div>
  );
}

/**
 * Single labeled filter control inside a FilterBar.
 */
export function FilterField({ id, label, children, className = '' }) {
  return (
    <div className={[styles.filterField, className].filter(Boolean).join(' ')}>
      {label ? (
        <label className={styles.fieldLabel} htmlFor={id}>
          {label}
        </label>
      ) : null}
      {children}
    </div>
  );
}

export default FilterBar;
