import React, { useState } from 'react';
import styles from './UpdateEstimatePage.module.css';

function ChevronIcon() {
  return (
    <svg
      className={styles.panelChevron}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Accordion panel used on estimate forms.
 * Click the header (not action buttons) to expand/collapse.
 */
export default function CollapsiblePanel({
  title,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  actions = null,
  className = '',
  bodyClassName = '',
  icon = null,
  round = true,
  children,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const toggle = () => {
    const next = !open;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section
      className={[
        styles.panel,
        round ? styles.panelRound : '',
        open ? styles.panelOpen : styles.panelClosed,
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className={styles.panelHeader}>
        <button
          type="button"
          className={styles.panelToggle}
          onClick={toggle}
          aria-expanded={open}
        >
          <ChevronIcon />
          {icon ? <span className={styles.panelIcon} aria-hidden>{icon}</span> : null}
          <span className={styles.panelTitle}>{title}</span>
        </button>
        {actions ? (
          <div className={styles.panelActions} onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        ) : null}
      </div>
      {open ? (
        <div className={[styles.panelBody, bodyClassName].filter(Boolean).join(' ')}>{children}</div>
      ) : (
        <div
          className={[styles.panelBodyHidden, bodyClassName].filter(Boolean).join(' ')}
          hidden
          aria-hidden="true"
        >
          {children}
        </div>
      )}
    </section>
  );
}
