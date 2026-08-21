import React from 'react';
import styles from './SopfPagination.module.css';

/**
 * Generic Finances–style pager used project-wide.
 * Showing X to Y of Z + ◀ page ▶
 */
export default function SopfPagination({
  page,
  pageSize,
  total,
  onPageChange,
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className={[styles.pagination, className].filter(Boolean).join(' ')}>
      <span className={styles.summary}>
        Showing {start} to {end} of {total} entries
      </span>
      <div className={styles.pager} role="group" aria-label="Pagination">
        <button
          type="button"
          className={styles.pgArrow}
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <span className={styles.pgNum}>{page}</span>
        <button
          type="button"
          className={styles.pgArrow}
          disabled={page >= totalPages}
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
