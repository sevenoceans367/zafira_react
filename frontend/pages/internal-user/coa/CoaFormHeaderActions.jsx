import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

/** Injects Back into the layout page header on COA add/edit forms. */
export default function CoaFormHeaderActions({ listHref, disabled = false }) {
  return (
    <PageHeaderActions deps={[listHref, disabled]}>
      <HeaderFilterControls>
        <Button variant="outline" label="Back" href={listHref} disabled={disabled} />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
