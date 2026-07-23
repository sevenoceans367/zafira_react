import React from 'react';
import { Button } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function OpsTcPaymentGridHeaderActions({ backHref, disabled = false }) {
  return (
    <PageHeaderActions deps={[backHref, disabled]}>
      <Button variant="secondary" label="Back" href={backHref} disabled={disabled} />
    </PageHeaderActions>
  );
}
