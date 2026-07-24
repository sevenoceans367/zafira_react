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

function formatHeading(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDmyTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  if (date.getFullYear() < 1971) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
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
    fp.setDate(next, false);
    if (fp.input) fp.input.value = next;
  } catch {
    if (fp.input) fp.input.value = next;
  }
}

/**
 * Date input with calendar popup — legacy dryout format dd-mm-yyyy
 * (or dd-mm-yyyy HH:MM when enableTime is true).
 *
 * With enableTime: PHP-style two-step picker —
 * 1) calendar date, 2) hour grid (0:00–23:00); picking an hour closes.
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
  const valueRef = useRef(value);
  const stepRef = useRef('date');
  onChangeRef.current = onChange;
  valueRef.current = value;

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

    const setStep = (fp, step) => {
      stepRef.current = step;
      const cal = fp.calendarContainer;
      if (!cal) return;
      cal.classList.toggle(styles.stepDate, step === 'date');
      cal.classList.toggle(styles.stepTime, step === 'time');
    };

    let goToTimeAfterChange = false;
    let suppressChange = false;

    const syncHourHighlight = (fp) => {
      const grid = fp.calendarContainer?.querySelector(`.${styles.hourGrid}`);
      if (!grid) return;
      const hour = fp.selectedDates[0]?.getHours?.() ?? -1;
      grid.querySelectorAll(`.${styles.hourBtn}`).forEach((btn) => {
        const h = Number(btn.dataset.hour);
        btn.classList.toggle(styles.hourBtnActive, h === hour);
      });
    };

    const syncTimeHeading = (fp) => {
      const el = fp.calendarContainer?.querySelector(`.${styles.timeHeading}`);
      if (!el) return;
      el.textContent = formatHeading(fp.selectedDates[0]) || 'Select time';
    };

    const commitDate = (fp, date) => {
      const str = enableTime ? formatDmyTime(date) : fp.formatDate(date, 'd-m-Y');
      if (!str) return;
      suppressChange = true;
      fp.setDate(date, false);
      suppressChange = false;
      if (fp.input) fp.input.value = str;
      onChangeRef.current?.(str);
    };

    const ensureTimeUi = (fp) => {
      const cal = fp.calendarContainer;
      if (!cal || cal.querySelector(`.${styles.timePanel}`)) return;

      const panel = document.createElement('div');
      panel.className = styles.timePanel;

      const heading = document.createElement('div');
      heading.className = styles.timeHeading;
      heading.textContent = 'Select time';

      const grid = document.createElement('div');
      grid.className = styles.hourGrid;

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
          const base = fp.selectedDates[0] ? new Date(fp.selectedDates[0]) : new Date();
          if (base.getFullYear() < 1971) {
            const now = new Date();
            base.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
          }
          base.setHours(hour, 0, 0, 0);
          commitDate(fp, base);
          fp.close();
        });
        grid.appendChild(btn);
      }

      const footer = document.createElement('div');
      footer.className = styles.timeFooter;

      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = styles.timeFooterBtn;
      backBtn.textContent = 'Back';
      backBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setStep(fp, 'date');
      });

      const todayBtn = document.createElement('button');
      todayBtn.type = 'button';
      todayBtn.className = `${styles.timeFooterBtn} ${styles.timeFooterToday}`;
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
        fp.close();
      });

      footer.append(backBtn, todayBtn);
      panel.append(heading, grid, footer);
      cal.appendChild(panel);

      // Day press → after flatpickr onChange, show time step
      cal.addEventListener('mousedown', (e) => {
        const day = e.target?.closest?.('.flatpickr-day:not(.flatpickr-disabled)');
        if (day && stepRef.current === 'date') {
          goToTimeAfterChange = true;
        }
      }, true);
    };

    fpRef.current = flatpickr(inputRef.current, {
      dateFormat,
      enableTime,
      time_24hr: true,
      allowInput: true,
      disableMobile: true,
      minuteIncrement: 60,
      appendTo: typeof document !== 'undefined' ? document.body : undefined,
      clickOpens: !disabled,
      parseDate: (datestr) => {
        const raw = sanitizeValue(datestr);
        if (!raw) return undefined;
        const m = raw.match(
          /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/,
        );
        if (!m) return undefined;
        const [, d, mo, y, h = '0', mi = '0'] = m;
        const year = Number(y);
        if (year < 1971) return undefined;
        const dt = new Date(year, Number(mo) - 1, Number(d), Number(h), Number(mi));
        return Number.isNaN(dt.getTime()) ? undefined : dt;
      },
      onReady: (_dates, _str, fp) => {
        if (!enableTime) return;
        ensureTimeUi(fp);
        setStep(fp, 'date');
      },
      onOpen: (_dates, _str, fp) => {
        if (!enableTime) return;
        goToTimeAfterChange = false;
        ensureTimeUi(fp);
        setStep(fp, 'date');
        syncTimeHeading(fp);
        syncHourHighlight(fp);
      },
      onChange: (selectedDates, dateStr, fp) => {
        if (suppressChange) return;
        if (!enableTime) {
          onChangeRef.current?.(dateStr);
          return;
        }
        // Ignore flatpickr's enableTime defaulting to epoch / today on open
        if (!goToTimeAfterChange && stepRef.current === 'date') {
          return;
        }
        if (goToTimeAfterChange && selectedDates?.length && stepRef.current === 'date') {
          goToTimeAfterChange = false;
          const picked = selectedDates[0];
          // Keep existing hour if editing; otherwise 00:00 until user picks
          if (!Number.isFinite(picked.getHours())) picked.setHours(0, 0, 0, 0);
          syncTimeHeading(fp);
          syncHourHighlight(fp);
          setStep(fp, 'time');
        }
      },
      onClose: (_dates, _str, fp) => {
        goToTimeAfterChange = false;
        if (!enableTime) return;
        setStep(fp, 'date');
        // Restore committed value — picking a day alone must not keep a draft time
        applyCommittedValue(fp, valueRef.current);
      },
    });

    // Sync current React value into a freshly created instance (incl. Strict Mode remount)
    applyCommittedValue(fpRef.current, valueRef.current);

    return () => {
      fpRef.current?.destroy();
      fpRef.current = null;
    };
  }, [enableTime, dateFormat]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    applyCommittedValue(fp, value);
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
