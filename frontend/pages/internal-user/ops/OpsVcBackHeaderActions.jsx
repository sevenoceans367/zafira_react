import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

/** Injects Back into the layout page header on Ops VC detail pages. */
export default function OpsVcBackHeaderActions({ backHref, disabled = false }) {
  return (
    <PageHeaderActions deps={[backHref, disabled]}>
      <HeaderFilterControls>
        <Button variant="secondary" label="Back" href={backHref} disabled={disabled} />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
