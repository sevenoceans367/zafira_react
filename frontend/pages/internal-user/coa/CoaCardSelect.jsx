import React from 'react';
import { CardSelect } from '@bainbridge/shared-ui';
import styles from './CoaPages.module.css';

export default function CoaCardSelect({
  value,
  options = [],
  onChange,
  label,
  placeholder = '---Select---',
  includeEmpty = true,
  disabled = false,
  align = 'start',
}) {
  const selectOptions = includeEmpty
    ? [{ id: '', name: placeholder }, ...options]
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
