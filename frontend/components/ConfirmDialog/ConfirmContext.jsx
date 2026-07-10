import React, { createContext, useCallback, useContext, useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';

const ConfirmContext = createContext(null);

const EMPTY_STATE = {
  open: false,
  mode: 'confirm',
  title: 'Confirmation',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  confirmVariant: 'primary',
  validation: null,
  children: null,
  validate: null,
  error: '',
  busy: false,
  resolve: null,
};

function normalizeDialogInput(messageOrOptions, maybeOptions = {}) {
  if (messageOrOptions && typeof messageOrOptions === 'object' && !Array.isArray(messageOrOptions)) {
    return messageOrOptions;
  }
  return {
    message: String(messageOrOptions ?? ''),
    ...maybeOptions,
  };
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE);

  const openDialog = useCallback((mode, messageOrOptions, maybeOptions = {}) => {
    const options = normalizeDialogInput(messageOrOptions, maybeOptions);
    const isAlert = mode === 'alert';

    return new Promise((resolve) => {
      setState({
        open: true,
        mode,
        title: options.title || (isAlert ? 'Alert' : 'Confirmation'),
        message: options.message || '',
        confirmLabel: options.confirmLabel || (isAlert ? 'OK' : 'Confirm'),
        cancelLabel: options.cancelLabel || 'Cancel',
        confirmVariant: options.confirmVariant || 'primary',
        validation: options.validation ?? null,
        children: options.children ?? null,
        validate: options.validate ?? null,
        error: '',
        busy: false,
        resolve,
      });
    });
  }, []);

  const confirm = useCallback(
    (messageOrOptions, maybeOptions = {}) => openDialog('confirm', messageOrOptions, maybeOptions),
    [openDialog],
  );

  const alert = useCallback(
    (messageOrOptions, maybeOptions = {}) => openDialog('alert', messageOrOptions, maybeOptions),
    [openDialog],
  );

  const close = (result) => {
    state.resolve?.(result);
    setState(EMPTY_STATE);
  };

  const handleCancel = () => {
    if (state.busy) return;
    close(state.mode === 'alert' ? true : false);
  };

  const handleConfirm = () => {
    if (state.busy) return;
    if (typeof state.validate === 'function') {
      const validationError = state.validate();
      if (validationError) {
        setState((prev) => ({ ...prev, error: String(validationError) }));
        return;
      }
    }
    close(true);
  };

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      <ConfirmDialog
        open={state.open}
        mode={state.mode}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        confirmVariant={state.confirmVariant}
        validation={state.validation}
        error={state.error}
        busy={state.busy}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      >
        {state.children}
      </ConfirmDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx.confirm;
}

export function useAlert() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useAlert must be used within ConfirmProvider');
  }
  return ctx.alert;
}
