import React from 'react';
import { CardSelect, HeaderFilterControls, PeriodCardPicker } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import styles from './VcDashboardPage.module.css';

const ICP_OPTIONS = [
  { id: 'operator', label: 'Operator' },
  { id: 'owner', label: 'Owner' },
  { id: 'mixed', label: 'Mixed' },
];

export default function VcDashboardHeaderActions({
  businessTypes = [],
  businessType,
  onBusinessTypeChange,
  icpMode = 'mixed',
  onIcpModeChange,
  periodFrom,
  periodTo,
  onPeriodChange,
  showPeriod = true,
}) {
  return (
    <PageHeaderActions
      deps={[
        businessTypes,
        businessType,
        onBusinessTypeChange,
        icpMode,
        onIcpModeChange,
        periodFrom,
        periodTo,
        onPeriodChange,
        showPeriod,
      ]}
    >
      <HeaderFilterControls>
        <div className={styles.icpToggle} role="group" aria-label="ICP view">
          {ICP_OPTIONS.map((opt) => {
            const active = icpMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={active ? `${styles.icpToggleBtn} ${styles.icpToggleActive}` : styles.icpToggleBtn}
                aria-pressed={active}
                onClick={() => onIcpModeChange?.(opt.id)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <CardSelect
          options={businessTypes}
          value={businessType}
          onChange={onBusinessTypeChange}
          placeholder="Business type"
          ariaLabel="Business type"
        />
        {showPeriod ? (
          <PeriodCardPicker
            from={periodFrom}
            to={periodTo}
            onChange={onPeriodChange}
            label="Select Period"
          />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
