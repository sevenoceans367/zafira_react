import React from 'react';
import styles from './OpsVcLaytimePage.module.css';

export default function LaytimeSectionHeadRight({ pagination, section, searchPlaceholder, entityFilter }) {
  const { filteredCount, page, pageSize, search, setSearch, setPage } = pagination;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  return (
    <div className={styles.sectionHeadRight} data-laytime-interactive>
      {entityFilter}
      <label className={styles.sectionSearch}>
        <i className="bi bi-search" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </label>
      <span className={styles.sectionCount} aria-label={`${filteredCount} matching rows`}>
        {filteredCount}
      </span>
      <nav className={styles.sectionPagination} aria-label={`${section} pages`}>
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <span aria-live="polite">{page} / {totalPages}</span>
        <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
