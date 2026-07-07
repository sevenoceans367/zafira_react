/**
 * Legacy Dry Out PHP pages (invoice_hiretc.php, payment_grid.php, etc.)
 * live outside the React /ops/dryout/* router — use a separate base path.
 */

const DEFAULT_LEGACY_DRYOUT_BASE = '/legacy-dryout';

const stripLeadingDryoutSegment = (relativePath) => {
  const cleaned = relativePath.replace(/^\.\//, '').replace(/^\/+/, '');
  return cleaned.startsWith('dryout/') ? cleaned.slice('dryout/'.length) : cleaned;
};

export const getLegacyDryoutBase = () => {
  const configured = import.meta.env.VITE_LEGACY_DRYOUT_BASE?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return DEFAULT_LEGACY_DRYOUT_BASE;
};

/** Build a browser URL for a legacy dryout PHP file + query string. */
export const getLegacyDryoutHref = (relativePath) => {
  if (!relativePath) return '';
  if (/^https?:\/\//i.test(relativePath)) return relativePath;

  const base = getLegacyDryoutBase();
  const cleaned = stripLeadingDryoutSegment(relativePath);

  if (/^https?:\/\//i.test(base)) {
    return `${base}/${cleaned}`;
  }

  return `${base}/${cleaned}`.replace(/([^:]\/)\/+/g, '$1');
};
