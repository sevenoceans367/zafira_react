/** Public URL prefix for uploaded files (proxied with /api on production). */
export const ATTACHMENT_PUBLIC_PREFIX = '/api/attachment';

/**
 * Build a browser URL for a stored attachment filename (from multer / UPLOAD columns).
 */
export function attachmentPublicUrl(storedFile) {
  const file = String(storedFile || '').trim();
  if (!file) return '';
  return `${ATTACHMENT_PUBLIC_PREFIX}/${encodeURIComponent(file)}`;
}
