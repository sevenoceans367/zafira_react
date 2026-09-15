import React from 'react';
import styles from './RowActions.module.css';

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

/**
 * Global add-row control — same layout as COA (+ icon, blue, hover tint).
 */
export function RowAddButton({
  type = 'button',
  className = '',
  title = 'Add row',
  'aria-label': ariaLabel,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={joinClasses(styles.rowAdd, className)}
      title={title}
      aria-label={ariaLabel || title}
      {...props}
    >
      {children || <PlusIcon />}
    </button>
  );
}

/**
 * Global delete-row control — same layout as COA (× icon, red, hover tint).
 */
export function RowDelButton({
  type = 'button',
  className = '',
  title = 'Delete row',
  'aria-label': ariaLabel,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={joinClasses(styles.rowDel, className)}
      title={title}
      aria-label={ariaLabel || title}
      {...props}
    >
      {children || <XIcon />}
    </button>
  );
}

/**
 * Wrapper for paired + / × row actions.
 */
export function RowActions({ className = '', children, ...props }) {
  return (
    <div className={joinClasses(styles.rowActions, className)} {...props}>
      {children}
    </div>
  );
}

export { styles as rowActionStyles };
