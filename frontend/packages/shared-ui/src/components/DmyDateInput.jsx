import React, { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import styles from './DmyDateInput.module.css';

/**
 * Date input with calendar popup — legacy dryout format dd-mm-yyyy.
 */
const DmyDateInput = ({
  value = '',
  onChange,
  id,
  className = 'form-control',
  placeholder = 'dd-mm-yyyy',
  disabled = false,
  required = false,
  size,
}) => {
  const inputRef = useRef(null);
  const fpRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!inputRef.current) return undefined;

    fpRef.current = flatpickr(inputRef.current, {
      dateFormat: 'd-m-Y',
      allowInput: true,
      disableMobile: false,
      clickOpens: !disabled,
      onChange: (_selectedDates, dateStr) => {
        onChangeRef.current(dateStr);
      },
    });

    return () => {
      fpRef.current?.destroy();
      fpRef.current = null;
    };
  }, []);

  useEffect(() => {
    const fp = fpRef.current;
    const input = inputRef.current;
    if (!fp || !input) return;
    const next = value || '';
    if (fp.input.value !== next) {
      fp.setDate(next, false);
    }
  }, [value]);

  useEffect(() => {
    const fp = fpRef.current;
    const input = inputRef.current;
    if (!fp || !input) return;
    input.disabled = disabled;
    fp.set('clickOpens', !disabled);
    if (disabled) fp.close();
  }, [disabled]);

  const sizeClass = size === 'sm' ? 'form-control-sm' : '';

  return (
    <input
      ref={inputRef}
      type="text"
      id={id}
      className={`${className} ${sizeClass} ${styles.input}`.trim()}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      autoComplete="off"
    />
  );
};

export default DmyDateInput;
