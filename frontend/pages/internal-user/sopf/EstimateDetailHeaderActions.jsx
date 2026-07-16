import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

/** Injects Back into the layout page header (frees vertical space on estimate forms). */
export default function EstimateDetailHeaderActions({ listHref, disabled = false }) {
  return (
    <PageHeaderActions deps={[listHref, disabled]}>
      <HeaderFilterControls>
        <Button variant="outline" label="Back" href={listHref} disabled={disabled} />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
