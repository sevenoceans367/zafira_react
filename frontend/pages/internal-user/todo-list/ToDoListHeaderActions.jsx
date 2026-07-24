import React, { useEffect, useRef } from 'react';
import { Button, CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

const ACCOUNT_TYPE_OPTIONS = [
  { id: '', name: 'All Account Types' },
  { id: 'Singapore', name: 'Singapore' },
  { id: 'Dubai', name: 'Dubai' },
];

export default function ToDoListHeaderActions({
  search,
  onSearchChange,
  searchPlaceholder = 'Search vessel, voyage, vendor…',
  accountType,
  onAccountTypeChange,
  onExcel,
  excelDisabled = false,
  onSearchVoyage,
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
    <PageHeaderActions
      deps={[
        search,
        onSearchChange,
        searchPlaceholder,
        accountType,
        onAccountTypeChange,
        onExcel,
        excelDisabled,
        onSearchVoyage,
      ]}
    >
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
        <CardSelect
          options={ACCOUNT_TYPE_OPTIONS}
          value={accountType}
          onChange={onAccountTypeChange}
          placeholder="Account Type"
          ariaLabel="Account Type"
        />
        {onExcel ? (
          <Button
            type="button"
            variant="outline"
            label="Generate Excel"
            icon="download"
            disabled={excelDisabled}
            onClick={onExcel}
          />
        ) : null}
        {onSearchVoyage ? (
          <Button
            type="button"
            variant="danger"
            label="Search For Voyage"
            onClick={onSearchVoyage}
          />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
