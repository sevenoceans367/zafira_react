import React from 'react';
import { Link } from 'react-router-dom';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import { getLegacyDryoutHref } from '@bainbridge/shared-routing';
import PageHeaderActions from '../PageHeaderActions.jsx';
import styles from './OpsVcSoaReportPage.module.css';

/** PDF + Back + Go to Contract Finance (mirrors Contract Finance → Cash Flow). */
export default function OpsVcSoaReportHeaderActions({
  backHref,
  financeHref,
  comId,
  disabled = false,
}) {
  const pdfHref = comId
    ? getLegacyDryoutHref(`allPdf.php?id=81&comid=${encodeURIComponent(comId)}`)
    : '';

  return (
    <PageHeaderActions deps={[backHref, financeHref, comId, disabled, pdfHref]}>
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
        {financeHref ? (
          <Link to={financeHref} className={styles.crossNavBtn} aria-disabled={disabled || undefined}>
            Go to Contract Finance
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </Link>
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
