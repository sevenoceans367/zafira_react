import { getLegacyDryoutHref } from '@bainbridge/shared-routing';

/** Excel columns matching PHP DataTables export (cols 0–9). */
export const TODO_EXCEL_COLUMNS = [
  { key: 'index', label: '#' },
  { key: 'vessel', label: 'Vessel' },
  { key: 'voyageNo', label: 'Voyage No' },
  { key: 'formName', label: 'Form Name' },
  { key: 'invoiceNo', label: 'Invoice/Advice No./SOA No.' },
  { key: 'payType', label: 'Type' },
  { key: 'holdBy', label: 'Hold by' },
  { key: 'vendor', label: 'Vendor Name' },
  { key: 'statusLabel', label: 'Status' },
  { key: 'date', label: 'Date' },
];

/**
 * PHP to_do_list.php searchForVoyage() status → legacy page map.
 * mode 'voyage' = options 126; mode 'vessel' = options 153.
 */
export function resolveTodoVoyageHref(item, { mode = 'voyage' } = {}) {
  if (!item || item.res === 0) return '';
  const type = String(item.type || '').toLowerCase();
  const status = Number(item.status);
  const year = item.year || '';
  const voyage = encodeURIComponent(item.voyage || '');
  const q = `selYear=${encodeURIComponent(year)}&voy_no=${voyage}`;

  if (type === 'vc') {
    if (status === 1) return getLegacyDryoutHref(`in_ops_at_glance.php?${q}`);
    if (status === 2) return getLegacyDryoutHref(`vessel_in_post_ops.php?${q}`);
    if (mode === 'vessel') {
      if (status === 3 || status === 4) return getLegacyDryoutHref(`vessel_in_history.php?${q}`);
      if (status === 5) return getLegacyDryoutHref(`vessel_in_history_entry.php?${q}`);
    }
    if (status === 3 || status === 5) return getLegacyDryoutHref(`vessel_in_history.php?${q}`);
  }

  if (type === 'tc') {
    if (status === 1) return getLegacyDryoutHref(`in_ops_tc.php?${q}`);
    if (status === 2) return getLegacyDryoutHref(`vessel_in_post_tc.php?${q}`);
    if (mode === 'vessel') {
      if (status === 3 || status === 4) return getLegacyDryoutHref(`vessel_in_history_tc.php?${q}`);
      if (status === 5) return getLegacyDryoutHref(`vessel_in_history_tc_entry.php?${q}`);
    }
    if (status === 3 || status === 5) return getLegacyDryoutHref(`vessel_in_history_tc.php?${q}`);
  }

  if (type === 'coa') {
    if (status === 1) return getLegacyDryoutHref(`coa_in_ops_at_glance.php?${q}`);
    if (status === 2) return getLegacyDryoutHref(`coa_in_post_ops.php?${q}`);
    if (status === 3 || status === 4 || status === 5) {
      return getLegacyDryoutHref(`coa_in_history.php?${q}`);
    }
  }

  return '';
}
