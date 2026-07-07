import React, { createContext, useCallback, useContext, useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';

const ConfirmContext = createContext(null);

const EMPTY_STATE = {
  open: false,
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

function normalizeConfirmInput(messageOrOptions, maybeOptions = {}) {
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

  const confirm = useCallback((messageOrOptions, maybeOptions = {}) => {
    const options = normalizeConfirmInput(messageOrOptions, maybeOptions);
    return new Promise((resolve) => {
      setState({
        open: true,
        title: options.title || 'Confirmation',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'Confirm',
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

  const close = (result) => {
    state.resolve?.(result);
    setState(EMPTY_STATE);
  };

  const handleCancel = () => {
    if (state.busy) return;
    close(false);
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
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={state.open}
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
