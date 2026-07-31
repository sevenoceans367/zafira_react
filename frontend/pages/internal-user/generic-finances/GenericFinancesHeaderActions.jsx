import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function GenericFinancesHeaderActions({
  search,
  onSearchChange,
  businessTypes = [],
  businessType,
  onBusinessTypeChange,
  years = [],
  year,
  onYearChange,
  canCreate = false,
}) {
  const navigate = useNavigate();
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
    <PageHeaderActions
      deps={[
        search,
        onSearchChange,
        businessTypes,
        businessType,
        onBusinessTypeChange,
        years,
        year,
        onYearChange,
        canCreate,
      ]}
    >
      <HeaderFilterControls>
        <CardSelect
          options={businessTypes}
          value={businessType}
          onChange={onBusinessTypeChange}
          placeholder="Business type"
          ariaLabel="Business type"
        />
        <CardSelect
          options={years}
          value={year}
          onChange={onYearChange}
          placeholder="Year"
          ariaLabel="Year"
        />
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder="Search invoice, vendor, creator…"
        />
        {canCreate ? (
          <Button
            type="button"
            variant="primary"
            label="Add New"
            onClick={() => {
              navigate(appPath('/internal-user/vc/generic-finances/add'));
            }}
          />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
