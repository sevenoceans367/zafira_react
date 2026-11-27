import React, { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import formStyles from './FormControls/FormControls.module.css';
import styles from './DmyDateInput.module.css';
import {
  applyCommittedValue,
  formatHeading,
  parseFlexibleDate,
  toDateOnly,
} from './dmyDateInputHelpers.js';
import { createDmyController } from './dmyDateInputController.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Date input with calendar popup — legacy dryout format dd-mm-yyyy
 * (or dd-mm-yyyy HH:MM when enableTime is true).
 *
 * Date-only: laycan/CP Date layout — select a day, then Apply
 * (Real-time jumps month; Cancel discards).
 *
 * With enableTime: three-step picker —
 * 1) calendar date, 2) hour, 3) minute; picking a minute closes.
 *
 * @param {boolean} [allowClear=true] When false, an existing value cannot be
 *   cleared (keyboard delete / empty blur restores the last committed date).
 * @param {boolean} [strict24Hour=false] Require a valid 24-hour time without AM/PM when entering a time.
 */
const DmyDateInput = ({
  value = '',
  onChange,
  id,
  ariaLabel,
  ariaInvalid,
  className,
  placeholder,
  disabled = false,
  required = false,
  size,
  enableTime = false,
  allowClear = true,
  strict24Hour = false,
}) => {
  const inputRef = useRef(null);
  const fpRef = useRef(null);
  const ctrlRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const allowClearRef = useRef(allowClear);
  const stepRef = useRef('date');
  const pendingHourRef = useRef(0);
  onChangeRef.current = onChange;
  allowClearRef.current = allowClear;

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

    const syncApplyEnabled = (fp) => {
      const applyBtn = fp.calendarContainer?.querySelector(`.${styles.confirmApply}`);
      if (!applyBtn) return;
      applyBtn.disabled = !ctrl.pendingDate;
    };

    const ctrl = createDmyController({
      enableTime,
      strict24Hour,
      initialValue: ctrlRef.current ? ctrlRef.current.value : value,
      getAllowClear: () => allowClearRef.current,
      emit: (next) => onChangeRef.current?.(next),
      syncApply: syncApplyEnabled,
    });
    ctrlRef.current = ctrl;

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
      const committed = parseFlexibleDate(ctrl.value, strict24Hour);
      const minute = committed?.getMinutes?.() ?? -1;
      grid.querySelectorAll(`.${styles.minuteBtn}`).forEach((btn) => {
        const m = Number(btn.dataset.minute);
        btn.classList.toggle(styles.minuteBtnActive, m === minute);
      });
    };

    const syncTimeHeading = (fp) => {
      const el = fp.calendarContainer?.querySelector(`.${styles.timeHeading}`);
      if (!el) return;
      const date = ctrl.pendingDate || fp.selectedDates[0];
      el.textContent = formatHeading(date) || 'Select date';
    };

    const refreshMinuteLabels = (fp) => {
      const hour = pendingHourRef.current;
      fp.calendarContainer?.querySelectorAll(`.${styles.minuteBtn}`).forEach((btn) => {
        const minute = Number(btn.dataset.minute);
        btn.textContent = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      });
    };

    const ensureConfirmFooter = (fp) => {
      const cal = fp.calendarContainer;
      if (!cal || cal.querySelector(`.${styles.confirmFooter}`)) return;

      const footer = document.createElement('div');
      footer.className = styles.confirmFooter;

      const todayBtn = document.createElement('button');
      todayBtn.type = 'button';
      todayBtn.className = styles.confirmToday;
      todayBtn.textContent = 'Real-time';
      todayBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      todayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = toDateOnly(new Date());
        // Jump month view (mockup) and select today so Apply can commit.
        fp.jumpToDate(now, false);
        ctrl.selectPending(fp, now);
        syncMonthSelectLabel(fp);
      });

      const actions = document.createElement('div');
      actions.className = styles.confirmActions;

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = styles.confirmCancel;
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ctrl.cancel();
        fp.close();
      });

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = styles.confirmApply;
      applyBtn.textContent = 'Apply';
      applyBtn.disabled = true;
      applyBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      applyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (ctrl.applyPending(fp)) fp.close();
      });

      actions.append(cancelBtn, applyBtn);
      footer.append(todayBtn, actions);
      cal.appendChild(footer);
      syncApplyEnabled(fp);
    };

    const syncMonthSelectLabel = (fp) => {
      const wrap = fp.calendarContainer?.querySelector(`.${styles.monthSelectWrap}`);
      if (!wrap) return;
      const label = wrap.querySelector(`.${styles.monthSelectTriggerLabel}`);
      const menu = wrap.querySelector(`.${styles.monthSelectMenu}`);
      const monthIndex = fp.currentMonth;
      if (label) label.textContent = MONTHS[monthIndex] || '';
      if (menu) {
        menu.querySelectorAll(`.${styles.monthSelectItem}`).forEach((btn) => {
          const selected = Number(btn.dataset.month) === monthIndex;
          btn.classList.toggle(styles.monthSelectItemSelected, selected);
          btn.setAttribute('aria-selected', selected ? 'true' : 'false');
          const check = btn.querySelector(`.${styles.monthSelectCheck}`);
          if (check) check.hidden = !selected;
        });
      }
    };

    const syncYearSelectLabel = (fp) => {
      const wrap = fp.calendarContainer?.querySelector(`.${styles.yearSelectWrap}`);
      if (!wrap) return;
      const yearInput = wrap.querySelector(`.${styles.yearSelectInput}`);
      const menu = wrap.querySelector(`.${styles.yearSelectMenu}`);
      const year = Number(fp.currentYear);
      if (yearInput && document.activeElement !== yearInput) {
        yearInput.value = String(year || '');
      }
      if (menu) {
        menu.querySelectorAll(`.${styles.yearSelectItem}`).forEach((btn) => {
          const selected = Number(btn.dataset.year) === year;
          btn.classList.toggle(styles.yearSelectItemSelected, selected);
          btn.setAttribute('aria-selected', selected ? 'true' : 'false');
          const check = btn.querySelector(`.${styles.yearSelectCheck}`);
          if (check) check.hidden = !selected;
        });
      }
    };

    const closeMonthSelectMenu = (fp) => {
      const wrap = fp.calendarContainer?.querySelector(`.${styles.monthSelectWrap}`);
      if (!wrap) return;
      const menu = wrap.querySelector(`.${styles.monthSelectMenu}`);
      const trigger = wrap.querySelector(`.${styles.monthSelectTrigger}`);
      if (menu) menu.hidden = true;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    };

    const closeYearSelectMenu = (fp) => {
      const wrap = fp.calendarContainer?.querySelector(`.${styles.yearSelectWrap}`);
      if (!wrap) return;
      const menu = wrap.querySelector(`.${styles.yearSelectMenu}`);
      const chevronBtn = wrap.querySelector(`.${styles.yearSelectChevronBtn}`);
      if (menu) menu.hidden = true;
      if (chevronBtn) chevronBtn.setAttribute('aria-expanded', 'false');
    };

    const buildYearOptions = (fp) => {
      const nowYear = new Date().getFullYear();
      const current = Number(fp.currentYear) || nowYear;
      const start = Math.min(1971, current);
      const end = Math.max(nowYear + 15, current);
      const years = [];
      for (let y = end; y >= start; y -= 1) years.push(y);
      return years;
    };

    const ensureMonthSelect = (fp) => {
      const cal = fp.calendarContainer;
      const currentMonth = cal?.querySelector('.flatpickr-current-month');
      const nativeSelect = currentMonth?.querySelector('select.flatpickr-monthDropdown-months');
      if (!cal || !currentMonth || !nativeSelect) return;
      if (currentMonth.querySelector(`.${styles.monthSelectWrap}`)) {
        syncMonthSelectLabel(fp);
        return;
      }

      const wrap = document.createElement('div');
      wrap.className = styles.monthSelectWrap;

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = styles.monthSelectTrigger;
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', 'Select month');

      const triggerLabel = document.createElement('span');
      triggerLabel.className = styles.monthSelectTriggerLabel;
      triggerLabel.textContent = MONTHS[fp.currentMonth] || '';

      const chevron = document.createElement('span');
      chevron.className = styles.monthSelectChevron;
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '▾';

      trigger.append(triggerLabel, chevron);

      const menu = document.createElement('div');
      menu.className = styles.monthSelectMenu;
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', 'Month');
      menu.hidden = true;

      MONTHS.forEach((name, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = styles.monthSelectItem;
        item.dataset.month = String(index);
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', index === fp.currentMonth ? 'true' : 'false');
        if (index === fp.currentMonth) item.classList.add(styles.monthSelectItemSelected);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;

        const check = document.createElement('span');
        check.className = styles.monthSelectCheck;
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';
        check.hidden = index !== fp.currentMonth;

        item.append(nameSpan, check);
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Flatpickr: changeMonth(value, isOffset=false) treats value as absolute month 0–11.
          if (index !== fp.currentMonth) fp.changeMonth(index, false);
          closeMonthSelectMenu(fp);
          syncMonthSelectLabel(fp);
        });
        menu.appendChild(item);
      });

      const toggleMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = menu.hidden;
        closeYearSelectMenu(fp);
        menu.hidden = !willOpen;
        trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) syncMonthSelectLabel(fp);
      };

      trigger.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      trigger.addEventListener('click', toggleMenu);

      wrap.append(trigger, menu);
      nativeSelect.insertAdjacentElement('afterend', wrap);
      syncMonthSelectLabel(fp);

      cal.addEventListener('mousedown', (e) => {
        if (!wrap.contains(e.target)) closeMonthSelectMenu(fp);
      });
    };

    const ensureYearSelect = (fp) => {
      const cal = fp.calendarContainer;
      const currentMonth = cal?.querySelector('.flatpickr-current-month');
      const yearWrapper = currentMonth?.querySelector('.numInputWrapper');
      if (!cal || !currentMonth || !yearWrapper) return;
      if (currentMonth.querySelector(`.${styles.yearSelectWrap}`)) {
        syncYearSelectLabel(fp);
        return;
      }

      const wrap = document.createElement('div');
      wrap.className = styles.yearSelectWrap;

      const trigger = document.createElement('div');
      trigger.className = styles.yearSelectTrigger;

      const yearInput = document.createElement('input');
      yearInput.type = 'text';
      yearInput.inputMode = 'numeric';
      yearInput.pattern = '[0-9]*';
      yearInput.maxLength = 4;
      yearInput.className = styles.yearSelectInput;
      yearInput.setAttribute('aria-label', 'Year');
      yearInput.setAttribute('autocomplete', 'off');
      yearInput.value = String(fp.currentYear || '');

      const chevronBtn = document.createElement('button');
      chevronBtn.type = 'button';
      chevronBtn.className = styles.yearSelectChevronBtn;
      chevronBtn.setAttribute('aria-label', 'Open year list');
      chevronBtn.setAttribute('aria-haspopup', 'listbox');
      chevronBtn.setAttribute('aria-expanded', 'false');
      chevronBtn.setAttribute('tabindex', '-1');

      const chevron = document.createElement('span');
      chevron.className = styles.yearSelectChevron;
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '▾';
      chevronBtn.appendChild(chevron);

      trigger.append(yearInput, chevronBtn);

      const menu = document.createElement('div');
      menu.className = styles.yearSelectMenu;
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', 'Year');
      menu.hidden = true;

      const rebuildYearItems = () => {
        menu.replaceChildren();
        const years = buildYearOptions(fp);
        years.forEach((year) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = styles.yearSelectItem;
          item.dataset.year = String(year);
          item.setAttribute('role', 'option');
          const selected = year === Number(fp.currentYear);
          item.setAttribute('aria-selected', selected ? 'true' : 'false');
          if (selected) item.classList.add(styles.yearSelectItemSelected);

          const nameSpan = document.createElement('span');
          nameSpan.textContent = String(year);

          const check = document.createElement('span');
          check.className = styles.yearSelectCheck;
          check.setAttribute('aria-hidden', 'true');
          check.textContent = '✓';
          check.hidden = !selected;

          item.append(nameSpan, check);
          item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
          });
          item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (year !== Number(fp.currentYear)) fp.changeYear(year);
            closeYearSelectMenu(fp);
            syncYearSelectLabel(fp);
          });
          menu.appendChild(item);
        });
      };

      rebuildYearItems();

      const commitYearInput = () => {
        const raw = String(yearInput.value || '').trim();
        const year = Number(raw);
        if (!/^\d{4}$/.test(raw) || year < 1971 || year > 2200) {
          yearInput.value = String(fp.currentYear || '');
          return;
        }
        if (year !== Number(fp.currentYear)) {
          fp.changeYear(year);
          rebuildYearItems();
        }
        syncYearSelectLabel(fp);
      };

      const openMenu = () => {
        closeMonthSelectMenu(fp);
        rebuildYearItems();
        menu.hidden = false;
        chevronBtn.setAttribute('aria-expanded', 'true');
        syncYearSelectLabel(fp);
        const selected = menu.querySelector(`.${styles.yearSelectItemSelected}`);
        selected?.scrollIntoView({ block: 'nearest' });
      };

      const toggleMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (menu.hidden) openMenu();
        else closeYearSelectMenu(fp);
      };

      yearInput.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      yearInput.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMonthSelectMenu(fp);
        closeYearSelectMenu(fp);
      });
      yearInput.addEventListener('focus', () => {
        closeMonthSelectMenu(fp);
        closeYearSelectMenu(fp);
        yearInput.select();
      });
      yearInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commitYearInput();
          closeYearSelectMenu(fp);
          yearInput.blur();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          yearInput.value = String(fp.currentYear || '');
          closeYearSelectMenu(fp);
          yearInput.blur();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          openMenu();
        }
      });
      yearInput.addEventListener('input', () => {
        yearInput.value = yearInput.value.replace(/\D/g, '').slice(0, 4);
      });
      yearInput.addEventListener('blur', () => {
        commitYearInput();
      });

      chevronBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      chevronBtn.addEventListener('click', toggleMenu);

      wrap.append(trigger, menu);
      yearWrapper.insertAdjacentElement('afterend', wrap);
      syncYearSelectLabel(fp);

      cal.addEventListener('mousedown', (e) => {
        if (!wrap.contains(e.target)) closeYearSelectMenu(fp);
      });
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
        btn.textContent = `${String(hour).padStart(2, '0')}:00`;
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
        btn.textContent = `00:${String(minute).padStart(2, '0')}`;
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const base = ctrl.pendingDate
            ? new Date(ctrl.pendingDate)
            : (fp.selectedDates[0] ? new Date(fp.selectedDates[0]) : new Date());
          if (base.getFullYear() < 1971) {
            const now = new Date();
            base.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
          }
          base.setHours(pendingHourRef.current, minute, 0, 0);
          ctrl.commitPicked(fp, base);
          fp.close();
        });
        minuteGrid.appendChild(btn);
      }

      const footer = document.createElement('div');
      footer.className = styles.timeFooter;

      const todayBtn = document.createElement('button');
      todayBtn.type = 'button';
      todayBtn.className = styles.timeFooterToday;
      todayBtn.textContent = 'Real-time';
      todayBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      todayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = new Date();
        now.setSeconds(0, 0);
        ctrl.commitPicked(fp, now);
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
      event.preventDefault();
      ctrl.paste(fp, event.clipboardData?.getData('text') ?? '');
    };

    const handleInput = () => {
      const fp = fpRef.current;
      if (fp && !disabled) ctrl.input(fp);
    };

    const handleBlur = () => {
      const fp = fpRef.current;
      if (fp && !disabled) ctrl.blur(fp);
    };

    const handleKeyDown = (event) => {
      if (event.key !== 'Enter') return;
      const fp = fpRef.current;
      if (!fp || disabled) return;
      event.preventDefault();
      ctrl.enter(fp);
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
      // Date-only stays open until Apply/Cancel; time mode stays open across steps.
      closeOnSelect: false,
      appendTo: typeof document !== 'undefined' ? document.body : undefined,
      clickOpens: !disabled,
      parseDate: (datestr) => {
        const parsed = parseFlexibleDate(datestr, strict24Hour);
        if (!parsed) return undefined;
        return toDateOnly(parsed);
      },
      onReady: (_dates, _str, fp) => {
        ensureMonthSelect(fp);
        ensureYearSelect(fp);
        if (enableTime) {
          ensureTimeUi(fp);
          setStep(fp, 'date');
          return;
        }
        ensureConfirmFooter(fp);
      },
      onOpen: (_dates, _str, fp) => {
        ensureMonthSelect(fp);
        ensureYearSelect(fp);
        closeMonthSelectMenu(fp);
        closeYearSelectMenu(fp);
        const committed = ctrl.open(fp);
        syncMonthSelectLabel(fp);
        syncYearSelectLabel(fp);

        if (enableTime) {
          ensureTimeUi(fp);
          pendingHourRef.current = committed?.getHours?.() ?? 0;
          setStep(fp, 'date');
          syncTimeHeading(fp);
          syncHourHighlight(fp);
          syncMinuteHighlight(fp);
          return;
        }

        ensureConfirmFooter(fp);
      },
      onMonthChange: (_dates, _str, fp) => {
        syncMonthSelectLabel(fp);
        syncYearSelectLabel(fp);
        closeMonthSelectMenu(fp);
        closeYearSelectMenu(fp);
      },
      onYearChange: (_dates, _str, fp) => {
        syncMonthSelectLabel(fp);
        syncYearSelectLabel(fp);
        closeYearSelectMenu(fp);
      },
      onChange: (selectedDates, _dateStr, fp) => {
        // Date → hour step (picker stays open via closeOnSelect: false)
        const next = ctrl.onFlatpickrChange(fp, selectedDates, stepRef.current);
        if (!next) return;
        pendingHourRef.current = next.hour;
        syncTimeHeading(fp);
        syncHourHighlight(fp);
        setStep(fp, 'hour');
      },
      onValueUpdate: (_dates, _str, fp) => ctrl.onValueUpdate(fp),
      onClose: (_dates, _str, fp) => {
        closeMonthSelectMenu(fp);
        if (enableTime) setStep(fp, 'date');
        ctrl.onClose(fp);
      },
    });

    applyCommittedValue(fpRef.current, ctrl.value, strict24Hour);

    return () => {
      inputEl.removeEventListener('paste', handlePaste);
      inputEl.removeEventListener('input', handleInput);
      inputEl.removeEventListener('blur', handleBlur);
      inputEl.removeEventListener('keydown', handleKeyDown);
      fpRef.current?.destroy();
      fpRef.current = null;
    };
  }, [enableTime, disabled, strict24Hour]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    ctrlRef.current.setValue(fp, value);
  }, [value, strict24Hour]);

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
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid ? true : undefined}
      className={resolvedClassName}
      placeholder={resolvedPlaceholder}
      disabled={disabled}
      required={required}
      autoComplete="off"
    />
  );
};

export default DmyDateInput;
