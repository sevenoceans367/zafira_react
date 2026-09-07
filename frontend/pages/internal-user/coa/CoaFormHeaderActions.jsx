import React, { useEffect, useLayoutEffect } from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import styles from './CoaFormHeaderActions.module.css';

/** Injects Back into the layout page header on COA add/edit forms. */
export default function CoaFormHeaderActions({
  listHref,
  disabled = false,
  currencyChip = null,
}) {
  const setHeading = usePageHeaderHeading();

  useLayoutEffect(() => {
    if (!currencyChip) {
      setHeading(null);
      return;
    }
    setHeading({
      titleExtra: <span className={styles.usdChip}>{currencyChip}</span>,
    });
  }, [currencyChip, setHeading]);

  useEffect(() => () => setHeading(null), [setHeading]);

  return (
    <PageHeaderActions deps={[listHref, disabled]}>
      <HeaderFilterControls>
        <Button variant="outline" label="Back" href={listHref} disabled={disabled} />
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
