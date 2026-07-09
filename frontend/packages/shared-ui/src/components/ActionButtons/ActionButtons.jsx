import React from 'react';
import GlobalButton from '../GlobalButton.jsx';
import styles from './ActionButtons.module.css';

const ACTION_DEFAULTS = {
  type: 'button',
  size: 'sm',
  pill: false,
};

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

/**
 * Blue outline table/action CTA (#376EB8 border, hover #BCCADB fill).
 * Use for Replicate and similar secondary row actions.
 */
export function SecondaryActionButton({
  label = 'Replicate',
  className = '',
  ...props
}) {
  return (
    <GlobalButton
      {...ACTION_DEFAULTS}
      variant="secondary"
      label={label}
      className={joinClasses(styles.actionButton, className)}
      {...props}
    />
  );
}

/**
 * Orange filled table/action CTA (Send to Ops and similar primary row actions).
 */
export function SendToOpsButton({
  label = 'Send to Ops',
  className = '',
  ...props
}) {
  return (
    <GlobalButton
      {...ACTION_DEFAULTS}
      variant="accent"
      label={label}
      className={joinClasses(styles.actionButton, className)}
      {...props}
    />
  );
}

/** Vertical stack for paired row actions (e.g. Replicate + Send to Ops). */
export function ActionButtonStack({ children, className = '' }) {
  return (
    <div className={joinClasses(styles.stack, className)}>
      {children}
    </div>
  );
}
