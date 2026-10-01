import React from 'react';
import { CardSelect } from '@bainbridge/shared-ui';
import styles from './CostSheetEstimatePage.module.css';

/** Card dropdown used across the app, sized to fill a worksheet field or table cell. */
export default function WorksheetSelect({
  id,
  value,
  disabled = false,
  onChange,
  options = [],
  placeholder = '— Select —',
  ariaLabel,
}) {
  return (
    <div className={styles.sheetSelect}>
      <CardSelect
        id={id}
        ariaLabel={ariaLabel || placeholder}
        value={value ?? ''}
        disabled={disabled}
        placeholder={placeholder}
        align="start"
        options={options}
        onChange={onChange}
      />
    </div>
  );
}
