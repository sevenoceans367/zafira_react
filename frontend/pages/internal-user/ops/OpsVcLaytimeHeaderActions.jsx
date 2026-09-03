import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

/** Injects PDF + Back into the layout page header on Laytime Calculations. */
export default function OpsVcLaytimeHeaderActions({ backHref, disabled = false }) {
  return (
    <PageHeaderActions deps={[backHref, disabled]}>
      <HeaderFilterControls>
        <Button
          variant="outline"
          label="PDF"
          icon="download"
          disabled
          title="PDF generation is not migrated yet."
          ariaLabel="PDF"
        />
        <Button variant="back" label="Back" href={backHref} disabled={disabled} />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
