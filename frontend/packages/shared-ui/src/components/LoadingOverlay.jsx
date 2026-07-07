import React from 'react';
import styles from './LoadingOverlay.module.css';

const LoadingOverlay = ({
  show = false,
  label = 'Loading...',
  fullScreen = true,
  size = 'md',
}) => {
  if (!show) return null;

  const overlayClass = fullScreen ? styles.fullScreen : styles.contained;

  return (
    <div
      className={`${styles.overlay} ${overlayClass}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div
        className={`spinner-border text-primary ${size === 'sm' ? styles.spinnerSm : styles.spinner}`}
        aria-hidden="true"
      />
      {label ? <span className={styles.label}>{label}</span> : null}
    </div>
  );
};

export default LoadingOverlay;
