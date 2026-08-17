import React from 'react';
import { CardSelect, HeaderFilterControls, PeriodCardPicker } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function VcDashboardHeaderActions({
  businessTypes = [],
  businessType,
  onBusinessTypeChange,
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
        periodFrom,
        periodTo,
        onPeriodChange,
        showPeriod,
      ]}
    >
      <HeaderFilterControls>
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
