import React from 'react';
import TextShimmer from './loading-ui/TextShimmer.jsx';
import styles from './LoadingOverlay.module.css';

const LOADING_TEXT = 'Loading';

const LoadingOverlay = ({
  show = false,
  active = false,
  label,
  fullScreen = true,
}) => {
  if (!show && !active) return null;

  const overlayClass = fullScreen ? styles.fullScreen : styles.contained;

  return (
    <div
      className={`${styles.overlay} ${overlayClass}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label || LOADING_TEXT}
    >
      <TextShimmer as="span" className={styles.label} duration={2} spread={3}>
        {LOADING_TEXT}
      </TextShimmer>
    </div>
  );
};

export default LoadingOverlay;
