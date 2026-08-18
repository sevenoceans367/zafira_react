import React, { useEffect, useRef } from 'react';
import { CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function FleetHeaderActions({
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
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder="Search"
        />
        <CardSelect
          options={businessTypes}
          value={businessType}
          onChange={onBusinessTypeChange}
          placeholder="Select type"
          ariaLabel="Business type"
        />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
