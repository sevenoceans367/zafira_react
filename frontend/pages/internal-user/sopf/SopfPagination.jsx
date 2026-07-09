import React from 'react';
import { Button } from '@bainbridge/shared-ui';
import styles from './SopfPagination.module.css';

export default function SopfPagination({
  page,
  pageSize,
  total,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className={styles.pagination}>
      <span className={styles.summary}>
        Showing {start}-{end} of {total}
      </span>
      <div className={styles.controls}>
        <Button
          variant="outline"
          size="sm"
          label="Previous"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span className={styles.pageLabel}>
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          label="Next"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}
