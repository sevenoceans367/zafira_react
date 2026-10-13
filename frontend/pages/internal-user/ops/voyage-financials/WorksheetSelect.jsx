import React from 'react';
import { CardSelect } from '@bainbridge/shared-ui';
import styles from './CostSheetEstimatePage.module.css';

/** Map grade name → chip color class (VLSFO / LSMGO / MGO / HSFO / Scrubber). */
export function gradeChipClass(gradeName) {
  const text = String(gradeName || '').toUpperCase().replace(/\s+/g, '');
  if (text.includes('SCRUBBER')) return styles.gradeChipScrubber;
  if (text.includes('LSMGO')) return styles.gradeChipLsmgo;
  if (text.includes('MGO')) return styles.gradeChipMgo;
  if (text.includes('HSFO')) return styles.gradeChipHsfo;
  if (text.includes('VLSFO')) return styles.gradeChipVlsfo;
  return '';
}

/** Card dropdown used across the app, sized to fill a worksheet field or table cell.
 *  Pass `gradeLabel` (grade name text) to tint the control with the bunker grade palette. */
export default function WorksheetSelect({
  id,
  value,
  disabled = false,
  onChange,
  options = [],
  placeholder = '— Select —',
  ariaLabel,
  gradeLabel,
}) {
  const select = (
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

  if (gradeLabel === undefined) return select;

  const chip = gradeChipClass(gradeLabel);
  return (
    <div className={chip ? `${styles.gradeSelectWrap} ${chip}` : styles.gradeSelectWrap}>
      {select}
    </div>
  );
}
