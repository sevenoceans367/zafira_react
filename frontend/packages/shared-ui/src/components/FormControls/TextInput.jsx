import React, { forwardRef } from 'react';
import styles from './FormControls.module.css';

/**
 * Standard text / search / number input using shared form chrome.
 */
const TextInput = forwardRef(function TextInput(
  {
    id,
    type = 'text',
    className = '',
    size,
    ...rest
  },
  ref,
) {
  const classes = [
    styles.control,
    size === 'sm' ? styles.sm : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <input
      ref={ref}
      id={id}
      type={type}
      className={classes}
      {...rest}
    />
  );
});

export default TextInput;
