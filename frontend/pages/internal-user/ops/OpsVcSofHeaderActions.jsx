import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

/** Injects Download SOF (icon-only) + Back into the layout page header on Ops VC SOF. */
export default function OpsVcSofHeaderActions({ backHref, disabled = false }) {
  return (
    <PageHeaderActions deps={[backHref, disabled]}>
      <HeaderFilterControls>
        <Button
          variant="outline"
          label="Download PDF"
          icon="download"
          disabled
          title="SOF PDF generation is not migrated yet."
          ariaLabel="Download SOF"
        />
        <Button variant="back" label="Back" href={backHref} disabled={disabled} />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
