import React, { forwardRef } from 'react';
import styles from './FormControls.module.css';

/**
 * Multi-line input with shared form chrome.
 */
const Textarea = forwardRef(function Textarea(
  {
    id,
    className = '',
    rows = 3,
    ...rest
  },
  ref,
) {
  const classes = [styles.control, styles.textarea, className].filter(Boolean).join(' ');

  return (
    <textarea
      ref={ref}
      id={id}
      className={classes}
      rows={rows}
      {...rest}
    />
  );
});

export default Textarea;
