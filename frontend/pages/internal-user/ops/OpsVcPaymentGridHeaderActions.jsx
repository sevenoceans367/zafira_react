import React from 'react';
import { Link } from 'react-router-dom';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import styles from './OpsVcPaymentGridPage.module.css';

/** Back + Go to Cash Flow (same cross-nav layout as Aging Report Payables). */
export default function OpsVcPaymentGridHeaderActions({
  backHref,
  cashHref,
  disabled = false,
}) {
  return (
    <PageHeaderActions deps={[backHref, cashHref, disabled]}>
      <HeaderFilterControls>
        <Button variant="secondary" label="Back" href={backHref} disabled={disabled} />
        {cashHref ? (
          <Link to={cashHref} className={styles.crossNavBtn} aria-disabled={disabled || undefined}>
            Go to Cash Flow
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
