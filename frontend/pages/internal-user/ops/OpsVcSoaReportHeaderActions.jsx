import React from 'react';
import { Button } from '@bainbridge/shared-ui';
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
      {pdfHref ? (
        <Button
          variant="secondary"
          label="Generate PDF"
          href={pdfHref}
          target="_blank"
          rel="noopener noreferrer"
          disabled={disabled}
        />
      ) : null}
      <Button variant="secondary" label="Back" href={backHref} disabled={disabled} />
    </PageHeaderActions>
  );
}
