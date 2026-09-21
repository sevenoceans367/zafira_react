import React from 'react';
import styles from './HeaderFilterControls.module.css';

export default function HeaderFilterControls({ children, align = 'end' }) {
  return (
    <div
      className={[
        styles.controls,
        align === 'start' ? styles.alignStart : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
