import React, { forwardRef } from 'react';
import styles from './FormControls.module.css';

/**
 * Native select with shared form chrome.
 */
const Select = forwardRef(function Select(
  {
    id,
    className = '',
    size,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.control,
    styles.select,
    size === 'sm' ? styles.sm : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <select
      ref={ref}
      id={id}
      className={classes}
      {...rest}
    >
      {children}
    </select>
  );
});

export default Select;
