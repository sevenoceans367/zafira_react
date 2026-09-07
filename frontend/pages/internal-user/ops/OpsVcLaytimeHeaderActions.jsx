import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

function buildLaytimePdfHref({
  comId,
  laytimeId,
  portType,
  portId,
  randomId,
}) {
  if (!comId || !laytimeId) return '';
  const params = new URLSearchParams({
    comId: String(comId),
    laytimeId: String(laytimeId),
  });
  if (portType) params.set('portType', String(portType));
  if (portId) params.set('portId', String(portId));
  if (randomId) params.set('randomId', String(randomId));
  return `/api/internal-user/vc/ops/laytime/pdf?${params.toString()}`;
}

/** Injects PDF + Back into the layout page header on Laytime Calculations. */
export default function OpsVcLaytimeHeaderActions({
  backHref,
  comId = '',
  laytimeId = '',
  portType = '',
  portId = '',
  randomId = '',
  disabled = false,
}) {
  const pdfHref = buildLaytimePdfHref({
    comId,
    laytimeId,
    portType,
    portId,
    randomId,
  });
  const canPdf = Boolean(pdfHref);

  return (
    <PageHeaderActions deps={[backHref, comId, laytimeId, portType, portId, randomId, disabled, pdfHref]}>
      <HeaderFilterControls>
        <Button
          variant="outline"
          label="PDF"
          icon="download"
          href={canPdf ? pdfHref : undefined}
          target="_blank"
          rel="noopener noreferrer"
          disabled={disabled || !canPdf}
          title={canPdf ? 'Download Laytime Report' : 'Save laytime for this port before downloading PDF.'}
          ariaLabel="PDF"
        />
        <Button variant="back" label="Back" href={backHref} disabled={disabled} />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
