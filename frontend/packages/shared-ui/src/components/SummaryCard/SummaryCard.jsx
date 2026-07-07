import React from 'react';
import styles from './SummaryCard.module.css';

export function SummaryCardGrid({ children, className = '' }) {
  return <div className={`${styles.summaryGrid} ${className}`.trim()}>{children}</div>;
}

export default function SummaryCard({
  title,
  value,
  variant = 'gradient',
  className = '',
}) {
  const variantClass =
    variant === 'plain' ? styles.summaryCardPlain : styles.summaryCardGradient;

  return (
    <article className={`${styles.summaryCard} ${variantClass} ${className}`.trim()}>
      <p className={styles.summaryLabel}>{title}</p>
      <h3 className={styles.summaryValue}>{value}</h3>
    </article>
  );
}
