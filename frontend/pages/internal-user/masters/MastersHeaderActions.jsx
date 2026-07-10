import React, { useEffect, useRef } from 'react';
import { Button, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

/**
 * Shared Masters list header: search + "+ Add" (and optional Excel).
 * Use on every master list page so future masters stay consistent.
 */
export default function MastersHeaderActions({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  onAdd,
  showAdd = true,
  onExcel = null,
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
      deps={[search, onSearchChange, onAdd, showAdd, searchPlaceholder, onExcel]}
    >
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
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
