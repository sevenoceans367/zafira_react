/**
 * Client-side filter for master list rows.
 * Matches any of the given field values against the search term.
 */
export function filterMasterRows(rows, search, fields) {
  const term = String(search || '').trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) =>
    fields.some((field) => String(row[field] ?? '').toLowerCase().includes(term)),
  );
}
