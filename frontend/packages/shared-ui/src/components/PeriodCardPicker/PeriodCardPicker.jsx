import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../Button/Button.jsx';
import { useAlert } from '../ConfirmDialog/ConfirmContext.jsx';
import styles from './PeriodCardPicker.module.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function parseDmy(value) {
  if (!value) return null;
  const trimmed = String(value).trim();

  const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = startOfDay(new Date(year, month - 1, day));
    if (
      isValidDate(date)
      && date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const date = startOfDay(new Date(year, month - 1, day));
    if (
      isValidDate(date)
      && date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const parsed = new Date(trimmed);
  if (!isValidDate(parsed)) return null;
  return startOfDay(parsed);
}

function formatDmy(date) {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getFullYear()}`;
}

function formatLong(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

function buildMonthCells(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    let day;
    let inCurrent = true;
    let date;

    if (i < startOffset) {
      day = prevDays - startOffset + i + 1;
      date = new Date(year, month - 1, day);
      inCurrent = false;
    } else if (i >= startOffset + daysInMonth) {
      day = i - startOffset - daysInMonth + 1;
      date = new Date(year, month + 1, day);
      inCurrent = false;
    } else {
      day = i - startOffset + 1;
      date = new Date(year, month, day);
    }

    cells.push({
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      date: startOfDay(date),
      day,
      inCurrent,
    });
  }

  return cells;
}

/**
 * Global period range picker — calendar card with manual date inputs.
 * onChange receives `{ from, to }` in dd-mm-yyyy (empty strings when cleared).
 * align: `end` anchors card to trigger right (header/filters on the right),
 *        `start` anchors to trigger left (filters on the left).
 */
export default function PeriodCardPicker({
  from = '',
  to = '',
  onChange,
  label = 'Select Period',
  title = 'Select period',
  subtitle = 'Choose a from and to date range.',
  align = 'end',
}) {
  const alert = useAlert();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDmy(from) || startOfDay(new Date()));
  const [draftFrom, setDraftFrom] = useState(() => parseDmy(from));
  const [draftTo, setDraftTo] = useState(() => parseDmy(to));
  const [fromInput, setFromInput] = useState(() => formatDmy(parseDmy(from)));
  const [toInput, setToInput] = useState(() => formatDmy(parseDmy(to)));
  const [fromError, setFromError] = useState('');
  const [toError, setToError] = useState('');

  const hasValue = Boolean(from && to);
  const displayValue = hasValue ? `${from} → ${to}` : label;
  const cells = useMemo(() => buildMonthCells(viewDate), [viewDate]);
  const monthTitle = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!open) return undefined;

    const nextFrom = parseDmy(from);
    const nextTo = parseDmy(to);
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    setFromInput(formatDmy(nextFrom));
    setToInput(formatDmy(nextTo));
    setFromError('');
    setToError('');
    setViewDate(nextFrom || nextTo || startOfDay(new Date()));

    const handleClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, from, to]);

  const handleDayClick = (date) => {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(date);
      setDraftTo(null);
      setFromInput(formatDmy(date));
      setToInput('');
      setFromError('');
      setToError('');
      return;
    }

    if (date < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(date);
      setFromInput(formatDmy(date));
      setToInput(formatDmy(draftFrom));
      setFromError('');
      setToError('');
      return;
    }

    setDraftTo(date);
    setToInput(formatDmy(date));
    setToError('');
  };

  const commitFromInput = () => {
    const trimmed = fromInput.trim();
    if (!trimmed) {
      setDraftFrom(null);
      setFromError('');
      return;
    }

    const parsed = parseDmy(trimmed);
    if (!parsed) {
      setFromError('Use dd-mm-yyyy');
      return;
    }

    setDraftFrom(parsed);
    setFromInput(formatDmy(parsed));
    setFromError('');
    setViewDate(parsed);

    if (draftTo && parsed > draftTo) {
      setDraftTo(parsed);
      setToInput(formatDmy(parsed));
      setToError('');
    }
  };

  const commitToInput = () => {
    const trimmed = toInput.trim();
    if (!trimmed) {
      setDraftTo(null);
      setToError('');
      return;
    }

    const parsed = parseDmy(trimmed);
    if (!parsed) {
      setToError('Use dd-mm-yyyy');
      return;
    }

    if (draftFrom && parsed < draftFrom) {
      setToError('End date must be after start');
      return;
    }

    setDraftTo(parsed);
    setToInput(formatDmy(parsed));
    setToError('');
    setViewDate(parsed);
  };

  const handleApply = async () => {
    commitFromInput();
    commitToInput();

    const nextFrom = parseDmy(fromInput) || draftFrom;
    const nextTo = parseDmy(toInput) || draftTo;

    if (!nextFrom || !nextTo) {
      await alert({
        title: 'Missing Information',
        message: 'Please select both start and end dates',
        confirmLabel: 'OK',
      });
      return;
    }
    if (nextFrom > nextTo) {
      await alert({
        title: 'Missing Information',
        message: 'Start date cannot be after end date',
        confirmLabel: 'OK',
      });
      return;
    }

    onChange?.({ from: formatDmy(nextFrom), to: formatDmy(nextTo) });
    setOpen(false);
  };

  const handleClear = () => {
    setDraftFrom(null);
    setDraftTo(null);
    setFromInput('');
    setToInput('');
    setFromError('');
    setToError('');
    onChange?.({ from: '', to: '' });
    setOpen(false);
  };

  const shiftMonth = (delta) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${hasValue ? styles.triggerActive : ''}`}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.triggerText}>{displayValue}</span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'} ${styles.chevron}`} aria-hidden />
      </button>

      {open ? (
        <div
          className={`${styles.card} ${align === 'start' ? styles.cardAlignStart : ''}`}
          role="dialog"
          aria-label={title}
        >
          <div className={styles.header}>
            <div className={styles.headerIcon} aria-hidden>
              <i className="bi bi-calendar3" />
            </div>
            <div>
              <h4 className={styles.title}>{title}</h4>
              <p className={styles.subtitle}>{subtitle}</p>
            </div>
          </div>

          <div className={styles.body}>
            <div className={styles.calendarCol}>
              <div className={styles.monthNav}>
                <button
                  type="button"
                  className={styles.navBtn}
                  aria-label="Previous month"
                  onClick={() => shiftMonth(-1)}
                >
                  <i className="bi bi-chevron-left" />
                </button>
                <div className={styles.monthTitle}>{monthTitle}</div>
                <button
                  type="button"
                  className={styles.navBtn}
                  aria-label="Next month"
                  onClick={() => shiftMonth(1)}
                >
                  <i className="bi bi-chevron-right" />
                </button>
              </div>

              <div className={styles.weekRow}>
                {WEEKDAYS.map((day) => (
                  <span key={day} className={styles.weekday}>{day}</span>
                ))}
              </div>

              <div className={styles.dayGrid}>
                {cells.map((cell) => {
                  const isStart = sameDay(cell.date, draftFrom);
                  const isEnd = sameDay(cell.date, draftTo);
                  const inRange = Boolean(
                    draftFrom
                    && draftTo
                    && cell.date > draftFrom
                    && cell.date < draftTo,
                  );

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      className={[
                        styles.day,
                        !cell.inCurrent ? styles.dayMuted : '',
                        inRange ? styles.dayInRange : '',
                        isStart ? styles.dayStart : '',
                        isEnd ? styles.dayEnd : '',
                        (isStart || isEnd) ? styles.daySelected : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleDayClick(cell.date)}
                    >
                      <span className={styles.dayNum}>{cell.day}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.fieldsCol}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Start date*</span>
                <input
                  type="text"
                  className={`${styles.fieldInput} ${fromError ? styles.fieldInputError : ''}`}
                  value={fromInput}
                  placeholder="dd-mm-yyyy"
                  onChange={(event) => {
                    setFromInput(event.target.value);
                    if (fromError) setFromError('');
                  }}
                  onBlur={commitFromInput}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitFromInput();
                    }
                  }}
                />
                {fromError ? <span className={styles.fieldError}>{fromError}</span> : null}
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>End date*</span>
                <input
                  type="text"
                  className={`${styles.fieldInput} ${toError ? styles.fieldInputError : ''}`}
                  value={toInput}
                  placeholder="dd-mm-yyyy"
                  onChange={(event) => {
                    setToInput(event.target.value);
                    if (toError) setToError('');
                  }}
                  onBlur={commitToInput}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitToInput();
                    }
                  }}
                />
                {toError ? <span className={styles.fieldError}>{toError}</span> : null}
              </label>

              <p className={styles.hint}>
                Type dates as dd-mm-yyyy, or click start then end on the calendar.
              </p>
            </div>
          </div>

          <div className={styles.footer}>
            <span className={styles.summary}>
              {draftFrom && draftTo
                ? `Period: ${formatLong(draftFrom)} – ${formatLong(draftTo)}`
                : 'No period selected'}
            </span>
            <div className={styles.footerActions}>
              <Button variant="sensitivity" size="sm" label="Apply" onClick={handleApply} />
              <Button variant="outline" size="sm" label="Clear" onClick={handleClear} />
              <Button variant="outline" size="sm" label="Cancel" onClick={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
