import React, { useEffect, useRef } from 'react';
import { PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import styles from './EstimateListHeaderActions.module.css';

export default function EstimateListHeaderActions({
  search,
  onSearchChange,
  businessTypes,
  businessType,
  onBusinessTypeChange,
}) {
  const searchRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || event.target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <PageHeaderActions deps={[search, businessType, businessTypes, onSearchChange, onBusinessTypeChange]}>
      <div className={`d-flex align-items-center flex-wrap ${styles.controls}`}>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder="Search"
        />
        <div className={styles.selectWrap}>
          <select
            className={styles.businessTypeSelect}
            value={businessType}
            onChange={(event) => onBusinessTypeChange(event.target.value)}
            aria-label="Business type"
          >
            {businessTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <i className={`bi bi-chevron-down ${styles.chevron}`} aria-hidden />
        </div>
      </div>
    </PageHeaderActions>
  );
}
