import React, { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import formStyles from './FormControls/FormControls.module.css';
import styles from './DmyDateInput.module.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Treat legacy PHP / epoch placeholders as empty. */
function sanitizeValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^0?1[-/]0?1[-/]1970\b/.test(raw)) return '';
  if (/^1970[-/]0?1[-/]0?1\b/.test(raw)) return '';
  return raw;
}

/**
 * Parse common pasted/typed date strings into a Date.
 * Supports: dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd, with optional HH:MM / HH:MM:SS.
 */
function parseFlexibleDate(datestr) {
  const raw = sanitizeValue(datestr);
  if (!raw) return null;

  let match = raw.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?)?/,
  );
  if (match) {
    const [, d, mo, y, h = '0', mi = '0'] = match;
    const year = Number(y);
    if (year < 1971) return null;
    const dt = new Date(year, Number(mo) - 1, Number(d), Number(h), Number(mi));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  match = raw.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?)?/,
  );
  if (match) {
    const [, y, mo, d, h = '0', mi = '0'] = match;
    const year = Number(y);
    if (year < 1971) return null;
    const dt = new Date(year, Number(mo) - 1, Number(d), Number(h), Number(mi));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

function formatHeading(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDmy(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  if (date.getFullYear() < 1971) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function formatDmyTime(date) {
  const base = formatDmy(date);
  if (!base) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${base} ${hh}:${mi}`;
}

function applyCommittedValue(fp, raw) {
  if (!fp) return;
  const next = sanitizeValue(raw);
  try {
    if (!next) {
      fp.clear(false);
      if (fp.input) fp.input.value = '';
      return;
    }
    const parsed = parseFlexibleDate(next);
    if (parsed) {
      const dateOnly = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      fp.setDate(dateOnly, false);
    }
    if (fp.input) fp.input.value = next;
  } catch {
    if (fp.input) fp.input.value = next;
  }
}

/**
 * Date input with calendar popup — legacy dryout format dd-mm-yyyy
 * (or dd-mm-yyyy HH:MM when enableTime is true).
 *
 * Supports typing and copy/paste of common date formats.
 *
 * With enableTime: three-step picker —
 * 1) calendar date, 2) hour, 3) minute; picking a minute closes.
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
  const valueRef = useRef(sanitizeValue(value));
  const stepRef = useRef('date');
  const pendingHourRef = useRef(0);
  const pendingDateRef = useRef(null);
  onChangeRef.current = onChange;

  const resolvedPlaceholder = placeholder
    || (enableTime ? 'dd-mm-yyyy HH:MM' : 'dd-mm-yyyy');
  const resolvedClassName = [
    className != null ? className : formStyles.control,
    size === 'sm' ? formStyles.sm : '',
    styles.input,
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (!inputRef.current) return undefined;

    const setStep = (fp, step) => {
      stepRef.current = step;
      const cal = fp.calendarContainer;
      if (!cal) return;
      cal.classList.toggle(styles.stepDate, step === 'date');
      cal.classList.toggle(styles.stepTime, step === 'hour' || step === 'minute');
      cal.classList.toggle(styles.stepHour, step === 'hour');
      cal.classList.toggle(styles.stepMinute, step === 'minute');
    };

    let suppressChange = false;

    const syncHourHighlight = (fp) => {
      const grid = fp.calendarContainer?.querySelector(`.${styles.hourGrid}`);
      if (!grid) return;
      const hour = pendingHourRef.current;
      grid.querySelectorAll(`.${styles.hourBtn}`).forEach((btn) => {
        const h = Number(btn.dataset.hour);
        btn.classList.toggle(styles.hourBtnActive, h === hour);
      });
    };

    const syncMinuteHighlight = (fp) => {
      const grid = fp.calendarContainer?.querySelector(`.${styles.minuteGrid}`);
      if (!grid) return;
      const committed = parseFlexibleDate(valueRef.current);
      const minute = committed?.getMinutes?.() ?? -1;
      grid.querySelectorAll(`.${styles.minuteBtn}`).forEach((btn) => {
        const m = Number(btn.dataset.minute);
        btn.classList.toggle(styles.minuteBtnActive, m === minute);
      });
    };

    const syncTimeHeading = (fp) => {
      const el = fp.calendarContainer?.querySelector(`.${styles.timeHeading}`);
      if (!el) return;
      const date = pendingDateRef.current || fp.selectedDates[0];
      el.textContent = formatHeading(date) || 'Select date';
    };

    const refreshMinuteLabels = (fp) => {
      const hour = pendingHourRef.current;
      fp.calendarContainer?.querySelectorAll(`.${styles.minuteBtn}`).forEach((btn) => {
        const minute = Number(btn.dataset.minute);
        btn.textContent = `${hour}:${String(minute).padStart(2, '0')}`;
      });
    };

    const commitDate = (fp, date) => {
      const str = enableTime ? formatDmyTime(date) : formatDmy(date);
      if (!str) return;
      suppressChange = true;
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      fp.setDate(dateOnly, false);
      suppressChange = false;
      if (fp.input) fp.input.value = str;
      valueRef.current = str;
      onChangeRef.current?.(str);
    };

    const clearInput = (fp) => {
      suppressChange = true;
      fp.clear(false);
      suppressChange = false;
      if (fp.input) fp.input.value = '';
      valueRef.current = '';
      pendingDateRef.current = null;
      onChangeRef.current?.('');
    };

    const commitRawInput = (fp, raw) => {
      const cleaned = sanitizeValue(raw);
      if (!cleaned) {
        clearInput(fp);
        return true;
      }

      const parsed = parseFlexibleDate(cleaned);
      if (!parsed) return false;

      if (!enableTime) {
        parsed.setHours(0, 0, 0, 0);
      }
      commitDate(fp, parsed);
      return true;
    };

    const ensureTimeUi = (fp) => {
      const cal = fp.calendarContainer;
      if (!cal || cal.querySelector(`.${styles.timePanel}`)) return;

      const panel = document.createElement('div');
      panel.className = styles.timePanel;

      const heading = document.createElement('div');
      heading.className = styles.timeHeading;
      heading.textContent = 'Select time';
      heading.title = 'Back';
      heading.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      heading.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (stepRef.current === 'minute') {
          syncTimeHeading(fp);
          syncHourHighlight(fp);
          setStep(fp, 'hour');
          return;
        }
        if (stepRef.current === 'hour') {
          setStep(fp, 'date');
        }
      });

      const hourGrid = document.createElement('div');
      hourGrid.className = styles.hourGrid;

      for (let hour = 0; hour < 24; hour += 1) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = styles.hourBtn;
        btn.dataset.hour = String(hour);
        btn.textContent = `${hour}:00`;
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          pendingHourRef.current = hour;
          refreshMinuteLabels(fp);
          syncTimeHeading(fp);
          syncMinuteHighlight(fp);
          setStep(fp, 'minute');
        });
        hourGrid.appendChild(btn);
      }

      const minuteGrid = document.createElement('div');
      minuteGrid.className = styles.minuteGrid;

      for (let minute = 0; minute < 60; minute += 1) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = styles.minuteBtn;
        btn.dataset.minute = String(minute);
        btn.textContent = `0:${String(minute).padStart(2, '0')}`;
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const base = pendingDateRef.current
            ? new Date(pendingDateRef.current)
            : (fp.selectedDates[0] ? new Date(fp.selectedDates[0]) : new Date());
          if (base.getFullYear() < 1971) {
            const now = new Date();
            base.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
          }
          base.setHours(pendingHourRef.current, minute, 0, 0);
          commitDate(fp, base);
          pendingDateRef.current = null;
          fp.close();
        });
        minuteGrid.appendChild(btn);
      }

      const footer = document.createElement('div');
      footer.className = styles.timeFooter;

      const todayBtn = document.createElement('button');
      todayBtn.type = 'button';
      todayBtn.className = styles.timeFooterToday;
      todayBtn.textContent = 'Today';
      todayBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      todayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = new Date();
        now.setSeconds(0, 0);
        commitDate(fp, now);
        pendingDateRef.current = null;
        fp.close();
      });

      footer.append(todayBtn);
      panel.append(heading, hourGrid, minuteGrid, footer);
      cal.appendChild(panel);
    };

    const inputEl = inputRef.current;

    const handlePaste = (event) => {
      const fp = fpRef.current;
      if (!fp || disabled) return;
      const text = event.clipboardData?.getData('text') ?? '';
      event.preventDefault();
      commitRawInput(fp, text);
      fp.close();
    };

    const handleInput = () => {
      const fp = fpRef.current;
      if (!fp || disabled || fp.isOpen) return;
      const raw = fp.input?.value ?? '';
      if (!sanitizeValue(raw)) {
        clearInput(fp);
      }
    };

    const handleBlur = () => {
      const fp = fpRef.current;
      if (!fp || disabled) return;
      // Clicking a calendar day blurs the input first — never commit/restore while open.
      if (fp.isOpen) return;
      const raw = fp.input?.value ?? '';
      if (!commitRawInput(fp, raw)) {
        applyCommittedValue(fp, valueRef.current);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key !== 'Enter') return;
      const fp = fpRef.current;
      if (!fp || disabled) return;
      event.preventDefault();
      const raw = fp.input?.value ?? '';
      if (commitRawInput(fp, raw)) {
        fp.close();
        fp.input?.blur();
      }
    };

    inputEl.addEventListener('paste', handlePaste);
    inputEl.addEventListener('input', handleInput);
    inputEl.addEventListener('blur', handleBlur);
    inputEl.addEventListener('keydown', handleKeyDown);

    fpRef.current = flatpickr(inputEl, {
      dateFormat: 'd-m-Y',
      enableTime: false,
      allowInput: true,
      disableMobile: true,
      // Keep open for hour/minute steps when time is enabled.
      closeOnSelect: !enableTime,
      appendTo: typeof document !== 'undefined' ? document.body : undefined,
      clickOpens: !disabled,
      parseDate: (datestr) => {
        const parsed = parseFlexibleDate(datestr);
        if (!parsed) return undefined;
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      },
      onReady: (_dates, _str, fp) => {
        if (!enableTime) return;
        ensureTimeUi(fp);
        setStep(fp, 'date');
      },
      onOpen: (_dates, _str, fp) => {
        if (!enableTime) return;
        ensureTimeUi(fp);
        const committed = parseFlexibleDate(valueRef.current);
        pendingHourRef.current = committed?.getHours?.() ?? 0;
        pendingDateRef.current = committed
          ? new Date(committed.getFullYear(), committed.getMonth(), committed.getDate())
          : null;
        setStep(fp, 'date');
        syncTimeHeading(fp);
        syncHourHighlight(fp);
        syncMinuteHighlight(fp);
      },
      onChange: (selectedDates, _dateStr, fp) => {
        if (suppressChange) return;
        if (!selectedDates?.length) {
          if (!enableTime) clearInput(fp);
          return;
        }

        const picked = selectedDates[0];
        const dateOnly = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());

        if (!enableTime) {
          commitDate(fp, dateOnly);
          return;
        }

        // Date → hour step (picker stays open via closeOnSelect: false)
        if (stepRef.current !== 'date') return;
        pendingDateRef.current = dateOnly;
        const committed = parseFlexibleDate(valueRef.current);
        pendingHourRef.current = committed?.getHours?.() ?? 0;
        suppressChange = true;
        fp.setDate(dateOnly, false);
        suppressChange = false;
        syncTimeHeading(fp);
        syncHourHighlight(fp);
        setStep(fp, 'hour');
      },
      onClose: (_dates, _str, fp) => {
        if (enableTime) {
          setStep(fp, 'date');
          pendingDateRef.current = null;
          // Keep last fully committed value (minute/Today/typed). Do not save hour-only drafts.
          applyCommittedValue(fp, valueRef.current);
          return;
        }
        const raw = fp.input?.value ?? '';
        if (!commitRawInput(fp, raw)) {
          applyCommittedValue(fp, valueRef.current);
        }
      },
    });

    applyCommittedValue(fpRef.current, valueRef.current);

    return () => {
      inputEl.removeEventListener('paste', handlePaste);
      inputEl.removeEventListener('input', handleInput);
      inputEl.removeEventListener('blur', handleBlur);
      inputEl.removeEventListener('keydown', handleKeyDown);
      fpRef.current?.destroy();
      fpRef.current = null;
    };
  }, [enableTime, disabled]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    valueRef.current = sanitizeValue(value);
    applyCommittedValue(fp, valueRef.current);
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
