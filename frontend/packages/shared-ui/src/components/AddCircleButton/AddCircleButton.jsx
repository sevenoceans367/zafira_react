import React from 'react';
import styles from './AddCircleButton.module.css';

/**
 * Circular bold "+" control used to add rows / sections.
 * Uses an SVG plus so the mark is geometrically centered in every context.
 */
export default function AddCircleButton({
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  ariaLabel = 'Add',
  title,
}) {
  return (
    <button
      type={type}
      className={[styles.addCircle, className].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
      title={title || ariaLabel}
      aria-label={ariaLabel}
    >
      <svg className={styles.glyph} viewBox="0 0 12 12" aria-hidden focusable="false">
        <path
          d="M6 2.25v7.5M2.25 6h7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
