export function parseDMYDate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const [datePart] = trimmed.split(/\s+/);
  const match = datePart.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function parseDMYDateTime(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const [datePart, timePart = '00:00'] = trimmed.split(/\s+/);
  const match = datePart.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const [hours = '0', minutes = '0'] = timePart.split(':');
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
  );
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatDateYMD(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateTimeYMDHM(date) {
  if (!date) return null;
  const ymd = formatDateYMD(date);
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${ymd} ${h}:${min}`;
}

export function formatDateDMY(date) {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

function addPeriodToDate(startDate, amount, periodType) {
  const date = new Date(startDate);
  const value = Number(amount);
  if (!value || Number.isNaN(value)) return null;

  if (String(periodType) === '1') {
    date.setMonth(date.getMonth() + value);
    date.setDate(date.getDate() - 1);
    return date;
  }

  date.setDate(date.getDate() + value);
  return date;
}

export function calculateRedeliveryDates({
  deliveryDate,
  periodMin,
  periodMax,
  periodType,
  aboutDaysMin = 0,
  aboutDaysMax = 0,
}) {
  const start = parseDMYDate(deliveryDate);
  if (!start || !periodType) {
    return { reDelMinDate: '', reDelMaxDate: '' };
  }

  const minBase = addPeriodToDate(start, periodMin, periodType);
  const maxBase = addPeriodToDate(start, periodMax, periodType);

  const adjust = (base, aboutDays) => {
    if (!base) return '';
    const adjusted = new Date(base);
    const days = Number(aboutDays) || 0;
    if (days) adjusted.setDate(adjusted.getDate() + days);
    return formatDateDMY(adjusted);
  };

  return {
    reDelMinDate: adjust(minBase, aboutDaysMin),
    reDelMaxDate: adjust(maxBase, aboutDaysMax),
  };
}
