import React, { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import formStyles from './FormControls/FormControls.module.css';
import styles from './DmyDateInput.module.css';

/**
 * Date input with calendar popup — legacy dryout format dd-mm-yyyy
 * (or dd-mm-yyyy HH:MM when enableTime is true).
 * Calendar is appended to document.body so overflow:hidden parents (AppShell)
 * do not clip it.
 *
 * Uses shared form chrome by default (FormControls). Pass className to override.
 */
const DmyDateInput = ({
  value = '',
  onChange,
  id,
  className,
  placeholder,
  disabled = false,
  required = false,
  size,
  enableTime = false,
}) => {
  const inputRef = useRef(null);
  const fpRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const resolvedPlaceholder = placeholder
    || (enableTime ? 'dd-mm-yyyy HH:MM' : 'dd-mm-yyyy');
  const dateFormat = enableTime ? 'd-m-Y H:i' : 'd-m-Y';
  const resolvedClassName = [
    className != null ? className : formStyles.control,
    size === 'sm' ? formStyles.sm : '',
    styles.input,
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (!inputRef.current) return undefined;

    fpRef.current = flatpickr(inputRef.current, {
      dateFormat,
      enableTime,
      time_24hr: true,
      allowInput: true,
      disableMobile: true,
      appendTo: typeof document !== 'undefined' ? document.body : undefined,
      clickOpens: !disabled,
      onChange: (_selectedDates, dateStr) => {
        onChangeRef.current?.(dateStr);
      },
    });

    return () => {
      fpRef.current?.destroy();
      fpRef.current = null;
    };
    // Recreate only when time mode changes (format is tied to enableTime).
  }, [enableTime, dateFormat]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    const next = value || '';
    try {
      if (!next) {
        if (fp.input.value) fp.clear(false);
        return;
      }
      if (fp.input.value !== next) {
        fp.setDate(next, false);
      }
    } catch {
      // Ignore unparseable values; keep the text input usable.
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

  return (
    <input
      ref={inputRef}
      type="text"
      id={id}
      className={resolvedClassName}
      placeholder={resolvedPlaceholder}
      disabled={disabled}
      required={required}
      autoComplete="off"
    />
  );
};

export default DmyDateInput;
