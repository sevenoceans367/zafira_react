/**
 * Shape Contract Finance payment-grid sections into Income / Expenses / Hireage.
 *
 * Data rules from SOC_Contract_Finance_Redesign_4.html (Rounds 2–6):
 * - Income ← freight + demurrage + other-income (worksheet / receivable activity)
 * - Expenses ← VC-In Expense (first, VCIN-VCOUT only) + hire + port-costs + ops-costs + bunkers
 * - Hire counts as expense for KPIs / waterfall; hire rows keep dull-red Statement pills
 * - Owners Side brokerage omitted (no useful data)
 * - Expense/Payment actions only when a Customer (vendor) is present
 * - Income: Freight + Demurrage always present; freight labeled Freight - [Cargo], net amounts
 * - Expense order: VC-In Expense → Hire → LP → DP → canal → brokerage → bunkers
 */

const INCOME_SECTION_ORDER = ['freight', 'demurrage', 'other-income'];
/** Hire is prepended in groupPaymentGridSections; VC-in first among SOC expenses. */
const EXPENSE_SECTION_ORDER = ['vc-in-expense', 'port-costs', 'ops-costs', 'bunkers'];
const HIRE_SECTION_ORDER = ['hireage'];

const INCOME_KEYS = new Set(INCOME_SECTION_ORDER);
const EXPENSE_KEYS = new Set(EXPENSE_SECTION_ORDER);
const HIRE_KEYS = new Set(HIRE_SECTION_ORDER);

export function parseMoney(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(value, { signed = false } = {}) {
  const n = parseMoney(value);
  if (n == null) return '';
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (signed) {
    if (n > 0) return `+$${abs}`;
    if (n < 0) return `-$${abs}`;
  }
  return `$${abs}`;
}

function rowAmount(row) {
  return parseMoney(row?.netAmount)
    ?? parseMoney(row?.amount)
    ?? parseMoney(row?.totalPaid);
}

function hasCustomer(row) {
  return Boolean(String(row?.vendorName || '').trim());
}

/** Round 6: drop Owners Side brokerage placeholder from Hireage. */
function isOwnersSideBrokerage(row) {
  const key = String(row?.key || '').toLowerCase();
  const name = String(row?.name || '').toLowerCase();
  return key.includes('owners-broker')
    || name.includes('owners side brokerage')
    || name.includes("owner's side brokerage");
}

/**
 * Live grid rule: Payment / invoice / statement actions only when Customer exists.
 * Clubbed info badges stay visible.
 */
export function filterRowActions(row, kind) {
  const actions = Array.isArray(row?.actions) ? row.actions : [];
  if (!actions.length) return [];
  if (!hasCustomer(row)) {
    // Keep non-navigational clubbed markers only
    return actions.filter((a) => {
      const label = String(a?.label || '').toLowerCase();
      return label.includes('clubbed');
    });
  }
  if (kind === 'expense') {
    // Payment only on rows with a vendor (Round 2 live BALTIC rule)
    return actions;
  }
  return actions;
}

function isSettled(row, kind) {
  const paid = parseMoney(row?.totalPaid);
  if (paid != null && paid > 0) return true;
  const badges = (row?.badges || []).map((b) => String(b.label || '').toLowerCase());
  if (badges.some((l) => l.includes('clubbed') || l.includes('completed'))) return true;
  const labels = filterRowActions(row, kind).map((a) => String(a.label || '').toLowerCase());
  if (kind === 'income') {
    return labels.some((l) => l.includes('completed') || (l.includes('final') && l.includes('view')));
  }
  return labels.some((l) => l.includes('completed') || l.includes('view'));
}

/**
 * Derive display status for a line.
 * kind: 'income' | 'expense' | 'hire'
 */
export function deriveStatus(row, kind = 'expense') {
  if (row?.isGroupHeader) return { label: '', tone: 'pending' };
  const labels = filterRowActions(row, kind).map((a) => String(a.label || '').toLowerCase());
  const paid = parseMoney(row?.totalPaid);

  if (kind === 'income') {
    if (isSettled(row, kind) || (paid != null && paid > 0)) {
      return { label: 'Collected', tone: 'good' };
    }
    if (labels.some((l) => l.includes('initial') || l.includes('final') || l.includes('invoice'))) {
      return { label: 'Invoicing', tone: 'warn' };
    }
    if (!labels.length && !hasCustomer(row)) return { label: 'Not Ready', tone: 'pending' };
    if (!labels.length) return { label: 'Not Ready', tone: 'pending' };
    return { label: 'Pending', tone: 'warn' };
  }

  if (isSettled(row, kind) || (paid != null && paid > 0)) {
    return { label: 'Paid', tone: 'good' };
  }
  if (labels.some((l) => l.includes('payment') || l.includes('create') || l.includes('hire') || l.includes('statement'))) {
    return { label: 'Due Soon', tone: 'warn' };
  }
  return { label: 'Pending', tone: 'pending' };
}

/** Soft-rewrite action labels toward Create / Edit / Completed (Round 6). */
export function restyleActionLabel(label, kind) {
  const raw = String(label || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return raw;
  if (lower.includes('completed') || lower.includes('view')) return 'Completed';
  if (
    lower.includes('hire statement')
    || (kind === 'hire' && (lower.includes('statement') || lower.includes('payment') || lower.includes('hire')))
  ) {
    return 'Statement';
  }
  if (lower.includes('initial') && (lower.includes('edit') || lower.includes('invoice'))) {
    return 'Initial · Edit';
  }
  if (lower.includes('final') && (lower.includes('create') || lower.includes('invoice'))) {
    return 'Final · Create';
  }
  if (lower.includes('initial')) return 'Initial · Edit';
  if (lower.includes('final')) return 'Final · Create';
  if (lower.includes('edit')) return 'Edit';
  if (lower.includes('payment') || lower.includes('invoice') || lower === 'create') {
    return 'Create';
  }
  return raw;
}

/** Hue + completed classes per mockup Round 4–6 body action buttons. */
export function pillToneClass(kind, action, styles) {
  const label = String(action?.label || '').toLowerCase();
  const completed = label.includes('completed') || label.includes('view');
  let hue = styles.miniPillOrange;
  if (kind === 'hire') hue = styles.miniPillDullRed;
  else if (kind === 'income') {
    hue = label.includes('final') ? styles.miniPillNavy : styles.miniPillTeal;
  }
  return completed ? `${hue} ${styles.miniPillCompleted}` : hue;
}

/** Expense row sort: VC-In Expense → Hire → LP → DP → canal → brokerage → bunkers. */
export function expenseRowRank(row) {
  const name = String(row?.name || '').toLowerCase();
  const key = String(row?.key || '').toLowerCase();
  const section = String(row?.sectionKey || '');

  if (
    section === 'vc-in-expense'
    || name.includes('vc in')
    || name.includes('vc-in')
    || name.includes('vcin')
    || key.includes('vcin')
  ) {
    return -30;
  }
  if (section === 'hireage' || key === 'hire' || (name === 'hire' && !name.includes('broker'))) {
    return -20;
  }
  if (
    name.includes('load port')
    || name.includes('demurrage - lp')
    || name.startsWith('lp ')
    || /\blp\b/.test(name)
    || key.includes('load')
    || key.includes('-lp')
  ) {
    return 10;
  }
  if (
    name.includes('discharge')
    || name.includes('demurrage - dp')
    || name.startsWith('dp ')
    || /\bdp\b/.test(name)
    || key.includes('disc')
    || key.includes('-dp')
  ) {
    return 20;
  }
  if (name.includes('suez') || name.includes('canal') || name.includes('transit')) {
    return 30;
  }
  if (name.includes('broker')) return 40;
  if (section === 'bunkers' || name.includes('bunker')) return 50;

  if (section === 'port-costs') return 25;
  if (section === 'ops-costs') return 35;
  if (section === 'bunkers') return 50;
  return 45;
}

/** Format income freight lines as Freight - [Cargo]; prefer Net Amount. */
export function formatIncomeLineName(row) {
  if (row?.isGroupHeader) return row.name;
  const section = String(row?.sectionKey || '');
  const raw = String(row?.name || '').trim();
  if (section === 'freight' || /^final\s+net\s+freight/i.test(raw) || /^freight\b/i.test(raw)) {
    if (/^freight\s*-/i.test(raw)) return raw;
    const cargo = String(row?.cargoName || '').trim()
      || (raw.match(/\(([^)]+)\)/) || [])[1]
      || '';
    const cleaned = String(cargo || '')
      .replace(/^(main|overage|dead)\s+cargo\s+freight$/i, '')
      .trim();
    return cleaned ? `Freight - ${cleaned}` : 'Freight';
  }
  if (section === 'demurrage') {
    if (/^demurrage/i.test(raw)) return raw || 'Demurrage';
    if (/^load port\b/i.test(raw)) return raw.replace(/^load port\s*/i, 'Demurrage - LP ');
    if (/^discharge port\b/i.test(raw)) return raw.replace(/^discharge port\s*/i, 'Demurrage - DP ');
    return raw || 'Demurrage';
  }
  return raw;
}

function ensureIncomeDefaults(lines) {
  const data = lines.filter((r) => !r.isGroupHeader);
  const hasFreight = data.some((r) => r.sectionKey === 'freight');
  const hasDemurrage = data.some((r) => r.sectionKey === 'demurrage');
  const freight = [];
  const demurrage = [];
  const other = [];

  for (const row of lines) {
    if (row.isGroupHeader) {
      if (row.sectionKey === 'freight') freight.push(row);
      else if (row.sectionKey === 'demurrage') demurrage.push(row);
      else other.push(row);
      continue;
    }
    const named = {
      ...row,
      name: formatIncomeLineName(row),
      amountValue: row.amountValue ?? parseMoney(row.netAmount) ?? parseMoney(row.amount),
    };
    if (row.sectionKey === 'freight') freight.push(named);
    else if (row.sectionKey === 'demurrage') demurrage.push(named);
    else other.push(named);
  }

  if (!hasFreight) {
    freight.unshift({
      key: 'freight-placeholder',
      name: 'Freight',
      sectionKey: 'freight',
      amountValue: null,
      actions: [],
      displayActions: [],
      isPlaceholder: true,
    });
  }
  if (!hasDemurrage) {
    demurrage.unshift({
      key: 'demurrage-placeholder',
      name: 'Demurrage',
      sectionKey: 'demurrage',
      amountValue: null,
      actions: [],
      displayActions: [],
      isPlaceholder: true,
    });
  }

  return [...freight, ...demurrage, ...other];
}

function sortExpenseRows(rows) {
  return [...rows].sort((a, b) => {
    const d = expenseRowRank(a) - expenseRowRank(b);
    if (d !== 0) return d;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function flattenLines(sections, keySet, sectionOrder) {
  const buckets = new Map();
  for (const key of sectionOrder) buckets.set(key, []);

  for (const section of sections || []) {
    const sectionKey = String(section.key || '');
    if (!keySet.has(sectionKey)) continue;
    const list = buckets.get(sectionKey) || [];
    for (const row of section.lines || []) {
      if (isOwnersSideBrokerage(row)) continue;
      list.push({
        ...row,
        sectionKey,
        amountValue: rowAmount(row),
      });
    }
    buckets.set(sectionKey, list);
  }

  const out = [];
  for (const key of sectionOrder) {
    out.push(...(buckets.get(key) || []));
  }
  return out;
}

function withDisplayActions(lines, kind) {
  return lines.map((row) => {
    if (row.isGroupHeader) return row;
    return {
      ...row,
      displayActions: filterRowActions(row, kind),
    };
  });
}

function summarize(lines, kind) {
  const prepared = withDisplayActions(lines, kind);
  const dataRows = prepared.filter((r) => !r.isGroupHeader);
  let settled = 0;
  let outstanding = 0;
  let total = 0;
  let settledCount = 0;
  let openCount = 0;

  for (const row of dataRows) {
    const amt = row.amountValue;
    const status = deriveStatus(row, kind);
    if (amt != null) total += amt;
    if (status.tone === 'good') {
      settledCount += 1;
      if (amt != null) settled += amt;
      else {
        const paid = parseMoney(row.totalPaid);
        if (paid != null) settled += paid;
      }
    } else {
      openCount += 1;
      if (amt != null) outstanding += amt;
    }
  }

  if (total === 0 && settled > 0) total = settled;

  return {
    lines: prepared,
    dataRows,
    count: dataRows.length,
    total,
    settled,
    outstanding: Math.max(0, outstanding || (total - settled)),
    settledCount,
    openCount,
    hasAmounts: dataRows.some((r) => r.amountValue != null),
  };
}

export function groupPaymentGridSections(sections = []) {
  const incomeRaw = flattenLines(sections, INCOME_KEYS, INCOME_SECTION_ORDER);
  const income = summarize(ensureIncomeDefaults(incomeRaw), 'income');

  const hireage = summarize(
    flattenLines(sections, HIRE_KEYS, HIRE_SECTION_ORDER),
    'hire',
  );

  const expenseRaw = flattenLines(sections, EXPENSE_KEYS, EXPENSE_SECTION_ORDER);
  // VC-In Expense at top of the expense list, then Hire → LP/DP → brokerage → bunkers
  const expenseCombined = [
    ...hireage.dataRows.map((r) => ({ ...r, sectionKey: 'hireage', lineKind: 'hire' })),
    ...expenseRaw.filter((r) => !r.isGroupHeader).map((r) => ({
      ...r,
      lineKind: 'expense',
    })),
  ];
  const expenseSorted = sortExpenseRows(expenseCombined);
  const expensesOnly = summarize(expenseSorted, 'expense');
  // Re-apply hire action filtering (kind hire) for hire rows in the merged table
  const expenseTableLines = expensesOnly.lines.map((row) => {
    if (row.sectionKey === 'hireage' || row.lineKind === 'hire') {
      return {
        ...row,
        lineKind: 'hire',
        displayActions: filterRowActions(row, 'hire'),
      };
    }
    return { ...row, lineKind: 'expense' };
  });
  const expensesTable = {
    ...expensesOnly,
    lines: expenseTableLines,
    dataRows: expenseTableLines.filter((r) => !r.isGroupHeader),
  };

  const expenseTotal = expensesOnly.total;
  const expenseSettled = expensesOnly.settled;
  const expenseOutstanding = expensesOnly.outstanding;
  const expenseCount = expensesOnly.count;

  const net = income.total - expenseTotal;
  const tce = null;

  return {
    income,
    expenses: {
      ...expensesTable,
      table: expensesTable,
      tileTotal: expenseTotal,
      tileSettled: expenseSettled,
      tileOutstanding: expenseOutstanding,
      tileCount: expenseCount,
      hireIncluded: hireage.count > 0,
    },
    hireage,
    kpis: {
      incomeTotal: income.total,
      incomeCount: income.count,
      incomeOpen: income.openCount > 0,
      expenseTotal,
      expenseCount,
      expenseOpen: expensesOnly.openCount > 0,
      net,
      tce,
    },
  };
}

export function buildWaterfallSegments(model) {
  const incomeSegs = model.income.dataRows
    .filter((r) => r.amountValue != null && r.amountValue > 0)
    .map((r) => ({
      id: r.key,
      kind: 'income',
      amount: r.amountValue,
      label: `${r.name}${r.vendorName ? ` · ${r.vendorName}` : ''}`,
      status: deriveStatus(r, 'income').label,
    }));

  const orderedExpenseRows = sortExpenseRows(model.expenses.table.dataRows);
  const hireSegs = orderedExpenseRows
    .filter((r) => (r.sectionKey === 'hireage' || r.lineKind === 'hire')
      && r.amountValue != null && r.amountValue > 0)
    .map((r) => ({
      id: r.key,
      kind: 'hire',
      amount: r.amountValue,
      label: `${r.name}${r.vendorName ? ` · ${r.vendorName}` : ''}`,
      status: deriveStatus(r, 'hire').label,
    }));

  const expenseSegs = orderedExpenseRows
    .filter((r) => r.sectionKey !== 'hireage' && r.lineKind !== 'hire'
      && r.amountValue != null && r.amountValue > 0)
    .map((r) => ({
      id: r.key,
      kind: 'expense',
      amount: r.amountValue,
      label: `${r.name}${r.vendorName ? ` · ${r.vendorName}` : ''}`,
      status: deriveStatus(r, 'expense').label,
    }));

  const incomeSum = incomeSegs.reduce((s, x) => s + x.amount, 0) || 1;
  const expenseSum = [...hireSegs, ...expenseSegs].reduce((s, x) => s + x.amount, 0);
  const scale = Math.max(incomeSum, expenseSum + Math.max(0, model.kpis.net), 1);

  const withBasis = (segs) => segs.map((s) => ({
    ...s,
    basis: `${Math.max(0.8, (s.amount / scale) * 100).toFixed(2)}%`,
  }));

  const netAmount = model.kpis.net;
  const expenseTrack = [
    ...withBasis(hireSegs),
    ...withBasis(expenseSegs),
  ];
  if (netAmount > 0) {
    expenseTrack.push({
      id: 'net-result',
      kind: 'net',
      amount: netAmount,
      label: 'Net Result',
      status: "What's left after expenses and hire",
      basis: `${Math.max(0.8, (netAmount / scale) * 100).toFixed(2)}%`,
      clickable: false,
    });
  }

  return {
    income: withBasis(incomeSegs),
    expenses: expenseTrack,
    hasData: incomeSegs.length + hireSegs.length + expenseSegs.length > 0,
  };
}
