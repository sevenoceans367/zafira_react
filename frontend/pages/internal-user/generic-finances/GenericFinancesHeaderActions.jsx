import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import PageHeaderActions from '../PageHeaderActions.jsx';

const ALL_BUSINESS_TYPES = { id: 'all', name: 'All Business Types' };
const ALL_YEARS = { id: 'all', name: 'All Years' };

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
  const typeOptions = useMemo(
    () => [ALL_BUSINESS_TYPES, ...businessTypes.filter((item) => item.id !== 'all')],
    [businessTypes],
  );
  const yearOptions = useMemo(
    () => [ALL_YEARS, ...years.filter((item) => item.id !== 'all')],
    [years],
  );

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
        typeOptions,
        businessType,
        onBusinessTypeChange,
        yearOptions,
        year,
        onYearChange,
        canCreate,
      ]}
    >
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder="Search invoice or vendor…"
        />
        <CardSelect
          options={typeOptions}
          value={businessType}
          onChange={onBusinessTypeChange}
          placeholder="Business type"
          ariaLabel="Business type"
        />
        <CardSelect
          options={yearOptions}
          value={year}
          onChange={onYearChange}
          placeholder="Year"
          ariaLabel="Year"
        />
        {canCreate ? (
          <Button
            type="button"
            variant="add"
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
