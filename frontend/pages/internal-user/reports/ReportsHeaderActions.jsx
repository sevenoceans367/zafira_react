import React, { useEffect, useRef } from 'react';
import { Button, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

/**
 * Reports page-header: search + Generate Excel / Generate PDF (PHP-style labels).
 */
export default function ReportsHeaderActions({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search',
  onExcel = null,
  onPdf = null,
  excelDisabled = false,
  pdfDisabled = false,
  pdfLoading = false,
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
        onExcel,
        onPdf,
        excelDisabled,
        pdfDisabled,
        pdfLoading,
      ]}
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
            disabled={excelDisabled}
          />
        ) : null}
        {onPdf ? (
          <Button
            type="button"
            variant="outline"
            label={pdfLoading ? 'Generating PDF…' : 'Generate PDF'}
            icon="download"
            onClick={onPdf}
            disabled={pdfDisabled || pdfLoading}
          />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
