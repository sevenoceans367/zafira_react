import React, { useState } from 'react';
import styles from './UpdateEstimatePage.module.css';

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
    <section className={`${styles.panel} ${open ? styles.panelOpen : styles.panelClosed}`}>
      <div className={styles.panelHeader}>
        <button
          type="button"
          className={styles.panelToggle}
          onClick={toggle}
          aria-expanded={open}
        >
          <span className={styles.panelChevron} aria-hidden>{open ? '▾' : '▸'}</span>
          <span>{title}</span>
        </button>
        {actions ? (
          <div className={styles.panelActions} onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        ) : null}
      </div>
      {open ? (
        <div className={styles.panelBody}>{children}</div>
      ) : (
        <div className={styles.panelBodyHidden} hidden aria-hidden="true">
          {children}
        </div>
      )}
    </section>
  );
}
