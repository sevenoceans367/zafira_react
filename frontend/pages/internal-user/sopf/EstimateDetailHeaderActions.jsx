import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import styles from './UpdateEstimatePage.module.css';

const ESTIMATE_FORM_ID = 'estimate-worksheet-form';

/** Injects Back (+ optional Calculate / Submit) into the layout page header. */
export default function EstimateDetailHeaderActions({
  listHref,
  disabled = false,
  onCalculate,
  showSubmit = false,
  formId = ESTIMATE_FORM_ID,
}) {
  return (
    <PageHeaderActions deps={[listHref, disabled, onCalculate, showSubmit, formId]}>
      <HeaderFilterControls>
        <Button variant="outline" label="Back" href={listHref} disabled={disabled} />
        {typeof onCalculate === 'function' ? (
          <Button
            type="button"
            variant="outlineAccent"
            label="Calculate"
            onClick={onCalculate}
            disabled={disabled}
          />
        ) : null}
        {showSubmit ? (
          <Button
            type="submit"
            variant="submit"
            label="Submit"
            form={formId}
            disabled={disabled}
          />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}

export function EstimateDetailFooterActions({
  listHref,
  disabled = false,
}) {
  return (
    <div className={styles.actions}>
      <Button variant="close" label="Cancel" href={listHref} ariaLabel="Cancel" disabled={disabled} />
      <Button type="submit" variant="submit" label="Submit" disabled={disabled} />
    </div>
  );
}

export { ESTIMATE_FORM_ID };
