import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import { getLegacyDryoutHref } from '@bainbridge/shared-routing';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function OpsVcSoaReportHeaderActions({
  backHref,
  comId,
  disabled = false,
}) {
  const pdfHref = comId
    ? getLegacyDryoutHref(`allPdf.php?id=81&comid=${encodeURIComponent(comId)}`)
    : '';

  return (
    <PageHeaderActions deps={[backHref, comId, disabled, pdfHref]}>
      <HeaderFilterControls>
        {pdfHref ? (
          <Button
            variant="outline"
            label="PDF"
            icon="download"
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            disabled={disabled}
            ariaLabel="PDF"
          />
        ) : null}
        <Button variant="back" label="Back" href={backHref} disabled={disabled} />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
