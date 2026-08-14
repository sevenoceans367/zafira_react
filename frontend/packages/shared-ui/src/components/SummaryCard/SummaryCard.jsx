import React from 'react';
import styles from './SummaryCard.module.css';

export function SummaryCardGrid({ children, className = '' }) {
  return <div className={`${styles.summaryGrid} ${className}`.trim()}>{children}</div>;
}

function DeltaArrow({ direction }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        d="M12 4l7 8h-5v8h-4v-8H5z"
        transform={direction === 'down' ? 'rotate(180 12 12)' : undefined}
      />
    </svg>
  );
}

export default function SummaryCard({
  title,
  value,
  variant = 'fin',
  icon = null,
  delta = null,
  className = '',
}) {
  const kind = variant === 'plain' || variant === 'count' ? 'count' : 'fin';
  const variantClass = kind === 'count' ? styles.summaryCardCount : styles.summaryCardFin;
  const deltaDirection = delta?.direction === 'down' ? 'down' : 'up';

  return (
    <article className={`${styles.summaryCard} ${variantClass} ${className}`.trim()}>
      <div className={styles.summaryHead}>
        {icon ? <div className={styles.summaryIcon}>{icon}</div> : <span />}
        {delta?.label ? (
          <span
            className={`${styles.summaryDelta} ${
              deltaDirection === 'down' ? styles.summaryDeltaDown : styles.summaryDeltaUp
            }`}
          >
            <DeltaArrow direction={deltaDirection} />
            {delta.label}
          </span>
        ) : null}
      </div>
      <span className={styles.summaryLabel}>{title}</span>
      <div className={styles.summaryValue}>{value}</div>
    </article>
  );
}
