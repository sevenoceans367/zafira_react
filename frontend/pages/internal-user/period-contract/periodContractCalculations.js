function parseDMYDateTime(value) {
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
  return Number.isNaN(date.getTime()) ? null : date;
}

export function diffDays(fromValue, toValue) {
  const from = parseDMYDateTime(fromValue);
  const to = parseDMYDateTime(toValue);
  if (!from || !to) return '';
  const diff = (to - from) / 86400000;
  return diff.toFixed(4);
}

export function multiplyAmount(qty, price) {
  const q = Number(qty);
  const p = Number(price);
  if (Number.isNaN(q) || Number.isNaN(p)) return '';
  return (q * p).toFixed(2);
}

export function sumAmounts(rows, key = 'amount') {
  const total = rows.reduce((sum, row) => {
    const value = Number(row[key]);
    return sum + (Number.isNaN(value) ? 0 : value);
  }, 0);
  return total.toFixed(2);
}

export function remainingDirties(allowed, done) {
  const a = Number(allowed);
  const d = Number(done);
  if (Number.isNaN(a) || Number.isNaN(d)) return '';
  return String(a - d);
}

function parseDMYDate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDMY(date) {
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
    return formatDMY(adjusted);
  };

  return {
    reDelMinDate: adjust(minBase, aboutDaysMin),
    reDelMaxDate: adjust(maxBase, aboutDaysMax),
  };
}

export function periodTypeLabel(periodType) {
  if (String(periodType) === '1') return 'Months';
  if (String(periodType) === '2') return 'Days';
  return '';
}

export function recalcHireAndOffHireRows(form) {
  const hireRates = form.hireRates.map((row) => ({
    ...row,
    hireDays: row.hireFrom && row.hireTo ? diffDays(row.hireFrom, row.hireTo) : row.hireDays,
  }));

  const offHires = form.offHires.map((offHire) => {
    const days = offHire.from && offHire.to
      ? diffDays(offHire.from, offHire.to)
      : offHire.days;
    const rate = Number(offHire.rate);
    const amount = days !== '' && !Number.isNaN(rate)
      ? (Number(days) * rate).toFixed(2)
      : offHire.amount;

    const bunkers = offHire.bunkers.map((bunker) => ({
      ...bunker,
      amount: multiplyAmount(bunker.qty, bunker.price) || bunker.amount,
    }));

    return { ...offHire, days, amount, bunkers };
  });

  return { ...form, hireRates, offHires };
}

export function recalcBunkerRows(rows) {
  return rows.map((row) => ({
    ...row,
    amount: multiplyAmount(row.qty, row.price) || row.amount,
  }));
}
