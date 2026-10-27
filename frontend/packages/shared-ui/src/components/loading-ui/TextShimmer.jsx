import React, { useMemo } from 'react';
import styles from './TextShimmer.module.css';

/**
 * loading-ui TextShimmer — gradient highlight sweeps across a loading label.
 * Usage: <TextShimmer duration={2} spread={2}>Loading…</TextShimmer>
 */
export default function TextShimmer({
  children,
  as: Component = 'p',
  className = '',
  duration = 2,
  spread = 2,
  baseColor,
  shimmerColor,
}) {
  const text = String(children ?? '');
  const dynamicSpread = useMemo(() => text.length * spread, [text, spread]);

  return (
    <Component
      className={[styles.text, className].filter(Boolean).join(' ')}
      style={{
        '--spread': `${dynamicSpread}px`,
        '--duration': `${duration}s`,
        ...(baseColor ? { '--text-shimmer-base': baseColor } : null),
        ...(shimmerColor ? { '--text-shimmer-highlight': shimmerColor } : null),
      }}
    >
      {text}
    </Component>
  );
}

export { TextShimmer };
