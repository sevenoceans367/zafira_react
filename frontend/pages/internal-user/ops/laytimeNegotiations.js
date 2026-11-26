export function readNegotiationCents(value) {
  const raw = String(value ?? '').trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) return null;
  const [dollars, cents = ''] = raw.replaceAll(',', '').split('.');
  const whole = BigInt(dollars);
  if (whole >= 10n ** 16n) return null;
  return whole * 100n + BigInt(cents.padEnd(2, '0'));
}

export function formatNegotiationTotal(rows) {
  let cents = 0n;
  for (const row of rows) {
    if (row.currencyCode != null && row.currencyCode !== 'USD') return '—';
    const raw = String(row.agreedDemm ?? '').trim();
    if (!raw) continue;
    const amount = readNegotiationCents(raw);
    if (amount == null) return '—';
    cents += amount;
  }
  return `${(cents / 100n).toLocaleString('en-US')}.${String(cents % 100n).padStart(2, '0')}`;
}

export function negotiationSaveFields(draft) {
  if (!draft?.dirty) return {};
  return {
    negotiations: {
      version: draft.version,
      rows: draft.rows.map(({ draftKey, ...row }) => row),
      deletedIds: draft.deletedIds,
    },
  };
}
