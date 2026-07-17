import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function TcFormHeaderActions({
  listHref,
  disabled = false,
  onGeneratePdf,
  pdfLoading = false,
}) {
  return (
    <PageHeaderActions deps={[listHref, disabled, onGeneratePdf, pdfLoading]}>
      <HeaderFilterControls>
        {onGeneratePdf ? (
          <Button
            variant="outline"
            label={pdfLoading ? 'Generating PDF…' : 'Generate PDF'}
            onClick={onGeneratePdf}
            disabled={disabled || pdfLoading}
          />
        ) : null}
        <Button variant="outline" label="Back" href={listHref} disabled={disabled} />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
