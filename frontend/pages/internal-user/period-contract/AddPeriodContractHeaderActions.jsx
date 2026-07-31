import React from 'react';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';

export default function AddPeriodContractHeaderActions({
  listPath,
  saving = false,
  showSaveActions = true,
  onSaveOpen,
  onSaveClose,
}) {
  return (
    <PageHeaderActions deps={[listPath, saving, showSaveActions, onSaveOpen, onSaveClose]}>
      <HeaderFilterControls>
        <Button variant="outline" label="Back" to={listPath} disabled={saving} />
        {showSaveActions ? (
          <>
            <Button
              type="button"
              variant="primary"
              label="Save & Open Period Contract"
              disabled={saving}
              onClick={onSaveOpen}
            />
            <Button
              type="button"
              variant="accent"
              label="Close Period Contract"
              disabled={saving}
              onClick={onSaveClose}
            />
          </>
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
