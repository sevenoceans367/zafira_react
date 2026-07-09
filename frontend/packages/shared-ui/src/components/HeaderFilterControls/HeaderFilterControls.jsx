import React from 'react';
import styles from './HeaderFilterControls.module.css';

export default function HeaderFilterControls({ children }) {
  return <div className={styles.controls}>{children}</div>;
}
