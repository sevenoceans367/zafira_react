import React from 'react';
import { CardSelect } from '@bainbridge/shared-ui';
import styles from './ReportPages.module.css';

/**
 * Themed CardSelect for report filters (matches Estimate/Ops header dropdown theme).
 */
export default function ReportCardSelect({
  value,
  options = [],
  onChange,
  label,
  placeholder = '---Select from list---',
  includeEmpty = true,
  emptyLabel,
  disabled = false,
  align = 'start',
}) {
  const selectOptions = includeEmpty
    ? [{ id: '', name: emptyLabel || placeholder }, ...options]
    : options;

  return (
    <div className={styles.cardSelect}>
      <CardSelect
        value={value ?? ''}
        options={selectOptions}
        placeholder={placeholder}
        ariaLabel={label || placeholder}
        align={align}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
