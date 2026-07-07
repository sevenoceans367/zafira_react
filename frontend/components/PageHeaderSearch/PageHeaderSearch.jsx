import React, { forwardRef } from 'react';
import styles from './PageHeaderSearch.module.css';

const PageHeaderSearch = forwardRef(function PageHeaderSearch(
  { value, onChange, placeholder = 'Search', 'aria-label': ariaLabel = 'Search' },
  ref,
) {
  return (
    <label className={styles.search}>
      <i className={`bi bi-search ${styles.icon}`} aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={styles.input}
        aria-label={ariaLabel}
      />
      <kbd className={styles.shortcut} aria-hidden>
        /
      </kbd>
    </label>
  );
});

export default PageHeaderSearch;
