import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import styles from './TcPages.module.css';

function TcInRecapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h13" />
      <path d="M12 4l4 4-4 4" />
      <path d="M21 16H8" />
      <path d="M12 20l-4-4 4-4" />
    </svg>
  );
}

export default function TcFormHeaderActions({
  listHref,
  disabled = false,
  onGeneratePdf,
  pdfLoading = false,
  showTcInRecap = false,
  onTcInRecap,
}) {
  return (
    <PageHeaderActions deps={[listHref, disabled, onGeneratePdf, pdfLoading, showTcInRecap, onTcInRecap]}>
      <HeaderFilterControls>
        {showTcInRecap ? (
          <button
            type="button"
            className={styles.tcInRecapBtn}
            title="Add the linked TC In leg of this sub-charter"
            onClick={onTcInRecap}
            disabled={disabled}
          >
            <TcInRecapIcon />
            TC In Recap
          </button>
        ) : null}
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
