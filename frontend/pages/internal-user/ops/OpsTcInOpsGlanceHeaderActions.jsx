import React, { useEffect, useRef } from 'react';
import { CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function OpsTcInOpsGlanceHeaderActions({
  search,
  onSearchChange,
  searchPlaceholder = 'Search Nom ID, TC no, vessel…',
  businessTypes = [],
  businessType,
  onBusinessTypeChange,
  years = [],
  year,
  onYearChange,
}) {
  const searchRef = useRef(null);
  const showBusinessType = typeof onBusinessTypeChange === 'function' && businessTypes.length > 0;
  const showYear = typeof onYearChange === 'function' && years.length > 0;

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
    <PageHeaderActions
      deps={[
        search,
        onSearchChange,
        searchPlaceholder,
        businessType,
        businessTypes,
        onBusinessTypeChange,
        year,
        years,
        onYearChange,
      ]}
    >
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
        {showBusinessType ? (
          <CardSelect
            options={businessTypes}
            value={businessType}
            onChange={onBusinessTypeChange}
            placeholder="Business type"
            ariaLabel="Business type"
          />
        ) : null}
        {showYear ? (
          <CardSelect
            options={years}
            value={year}
            onChange={onYearChange}
            placeholder="Year"
            ariaLabel="Year"
          />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
