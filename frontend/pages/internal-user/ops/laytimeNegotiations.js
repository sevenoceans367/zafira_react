export function readNegotiationCents(value) {
  const raw = String(value ?? '').trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) return null;
  const [dollars, cents = ''] = raw.replaceAll(',', '').split('.');
  const whole = BigInt(dollars);
  if (whole >= 10n ** 16n) return null;
  return whole * 100n + BigInt(cents.padEnd(2, '0'));
}

export function formatNegotiationTotal(rows) {
  if (rows.some((row) => row.currencyCode != null && row.currencyCode !== 'USD')) return '—';
  const cents = rows.reduce((total, row) => total + (readNegotiationCents(row.agreedDemm) ?? 0n), 0n);
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
