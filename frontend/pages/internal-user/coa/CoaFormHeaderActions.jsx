import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import styles from './CoaFormHeaderActions.module.css';

/** Injects Back into the layout page header on COA add/edit forms. */
export default function CoaFormHeaderActions({
  listHref,
  disabled = false,
  currencyChip = null,
}) {
  return (
    <PageHeaderActions deps={[listHref, disabled, currencyChip]}>
      <HeaderFilterControls>
        {currencyChip ? <span className={styles.usdChip}>{currencyChip}</span> : null}
        <Button variant="outline" label="Back" href={listHref} disabled={disabled} />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
