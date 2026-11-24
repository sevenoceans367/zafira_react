import React from 'react';
import styles from './Toggle.module.css';

/**
 * Global on/off toggle (same chrome as Masters StatusToggle).
 * checked = on (active / counting), unchecked = off.
 */
export default function Toggle({
  checked = false,
  onChange,
  disabled = false,
  id,
  'aria-label': ariaLabel,
  title,
  className = '',
}) {
  return (
    <label
      className={`${styles.toggle}${disabled ? ` ${styles.disabled}` : ''}${className ? ` ${className}` : ''}`}
      title={title}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel}
      />
      <span className={styles.slider} aria-hidden="true" />
    </label>
  );
}
