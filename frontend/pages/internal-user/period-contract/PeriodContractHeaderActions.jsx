import React, { useEffect, useRef } from 'react';
import { CardSelect, HeaderFilterControls, PageHeaderSearch, PeriodCardPicker } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function PeriodContractHeaderActions({
  search,
  onSearchChange,
  businessTypes,
  businessType,
  onBusinessTypeChange,
  periodFrom,
  periodTo,
  onPeriodChange,
}) {
  const searchRef = useRef(null);
  const showPeriod = typeof onPeriodChange === 'function';

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
    <PageHeaderActions deps={[search, businessType, businessTypes, periodFrom, periodTo, onSearchChange, onBusinessTypeChange, onPeriodChange]}>
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder="Search"
        />
        {showPeriod ? (
          <PeriodCardPicker
            from={periodFrom}
            to={periodTo}
            onChange={onPeriodChange}
            label="Select Period"
          />
        ) : null}
        {businessTypes.length > 1 ? (
          <CardSelect
            options={businessTypes}
            value={businessType}
            onChange={onBusinessTypeChange}
            placeholder="Select type"
            ariaLabel="Business type"
          />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
