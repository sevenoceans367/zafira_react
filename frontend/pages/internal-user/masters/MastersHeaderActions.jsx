import React, { useEffect, useRef } from 'react';
import { Button, CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

/**
 * Shared Masters list header: search + "+ Add" (and optional Excel / filter).
 * Use on every master list page so future masters stay consistent.
 */
export default function MastersHeaderActions({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  onAdd,
  showAdd = true,
  onExcel = null,
  filterOptions = null,
  filterValue = '',
  onFilterChange = null,
  filterPlaceholder = 'Filter',
  filterAriaLabel = 'Filter',
}) {
  const searchRef = useRef(null);
  const showFilter = Array.isArray(filterOptions) && typeof onFilterChange === 'function';

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
        onAdd,
        showAdd,
        searchPlaceholder,
        onExcel,
        filterOptions,
        filterValue,
        onFilterChange,
        filterPlaceholder,
        filterAriaLabel,
      ]}
    >
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
        {showFilter ? (
          <CardSelect
            options={filterOptions}
            value={filterValue}
            onChange={onFilterChange}
            placeholder={filterPlaceholder}
            ariaLabel={filterAriaLabel}
          />
        ) : null}
        {onExcel ? (
          <Button
            type="button"
            variant="outline"
            label="Generate Excel"
            icon="download"
            onClick={onExcel}
          />
        ) : null}
        {showAdd && onAdd ? (
          <Button type="button" variant="add" label="Add" onClick={onAdd} />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
