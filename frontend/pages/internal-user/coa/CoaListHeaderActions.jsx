import React, { useEffect, useRef } from 'react';
import {
  Button,
  CardSelect,
  HeaderFilterControls,
  PageHeaderSearch,
  PeriodCardPicker,
} from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function CoaListHeaderActions({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  businessTypes = [],
  businessType,
  onBusinessTypeChange,
  statusOptions,
  status,
  onStatusChange,
  periodFrom,
  periodTo,
  onPeriodChange,
  primaryAction,
}) {
  const searchRef = useRef(null);
  const showBusinessType = typeof onBusinessTypeChange === 'function';
  const showStatus = typeof onStatusChange === 'function' && Array.isArray(statusOptions) && statusOptions.length > 0;
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
    <PageHeaderActions
      deps={[
        search,
        onSearchChange,
        searchPlaceholder,
        businessType,
        businessTypes,
        onBusinessTypeChange,
        status,
        statusOptions,
        onStatusChange,
        periodFrom,
        periodTo,
        onPeriodChange,
        primaryAction,
      ]}
    >
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
        {showPeriod ? (
          <PeriodCardPicker
            from={periodFrom}
            to={periodTo}
            onChange={onPeriodChange}
            label="Select Period"
          />
        ) : null}
        {showBusinessType ? (
          <CardSelect
            options={businessTypes}
            value={businessType}
            onChange={onBusinessTypeChange}
            placeholder="Business type"
            ariaLabel="Business type"
          />
        ) : null}
        {showStatus ? (
          <CardSelect
            options={statusOptions}
            value={status}
            onChange={onStatusChange}
            placeholder="Status"
            ariaLabel="Status"
          />
        ) : null}
        {primaryAction ? (
          <Button
            type="button"
            variant={primaryAction.variant || 'add'}
            label={primaryAction.label}
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
          />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
