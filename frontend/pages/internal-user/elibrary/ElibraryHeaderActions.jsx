import React, { useEffect, useRef } from 'react';
import { CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function ElibraryHeaderActions({
  search,
  onSearchChange,
  categories = [],
  categoryId,
  onCategoryChange,
  referenceTypes = [],
  referenceTypeId,
  onReferenceTypeChange,
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

  const categoryOptions = [
    { id: '', name: 'All Categories' },
    ...categories,
  ];

  const referenceTypeOptions = [
    { id: '', name: 'All Reference Types' },
    ...referenceTypes,
  ];

  return (
    <PageHeaderActions
      deps={[
        search,
        onSearchChange,
        categories,
        categoryId,
        onCategoryChange,
        referenceTypes,
        referenceTypeId,
        onReferenceTypeChange,
      ]}
    >
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder="Search by name"
        />
        <CardSelect
          options={categoryOptions}
          value={categoryId}
          onChange={onCategoryChange}
          placeholder="Category"
          ariaLabel="Category"
        />
        <CardSelect
          options={referenceTypeOptions}
          value={referenceTypeId}
          onChange={onReferenceTypeChange}
          placeholder="Reference Type"
          ariaLabel="Reference Type"
        />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
