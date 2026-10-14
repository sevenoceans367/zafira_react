import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

/** Injects Back (+ optional Calculate) into the layout page header. */
export default function EstimateDetailHeaderActions({
  listHref,
  disabled = false,
  onCalculate,
}) {
  return (
    <PageHeaderActions deps={[listHref, disabled, onCalculate]}>
      <HeaderFilterControls>
        <Button variant="outline" label="Back" href={listHref} disabled={disabled} />
        {typeof onCalculate === 'function' ? (
          <Button
            type="button"
            variant="accent"
            label="Calculate"
            onClick={onCalculate}
            disabled={disabled}
          />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
