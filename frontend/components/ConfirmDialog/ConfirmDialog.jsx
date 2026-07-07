import React from 'react';
import Button from '../Button/Button.jsx';
import styles from './ConfirmDialog.module.css';

const ValidationList = ({ validation }) => {
  if (!validation || typeof validation !== 'object') return null;
  const entries = Object.entries(validation);
  if (!entries.length) return null;

  return (
    <ul className={styles.validationList}>
      {entries.map(([key, value]) => (
        <li key={key}>
          {Number(value) === 1 ? '✅' : '❌'} {key.replace(/_/g, ' ')}
        </li>
      ))}
    </ul>
  );
};

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'primary',
  validation,
  children,
  error,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h4>

        <ValidationList validation={validation} />

        {children ? <div className={styles.body}>{children}</div> : null}

        {message ? <p className={styles.message}>{message}</p> : null}

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <Button
            type="button"
            label={cancelLabel}
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          />
          <Button
            type="button"
            label={confirmLabel}
            variant={confirmVariant}
            size="sm"
            disabled={busy}
            onClick={onConfirm}
          />
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
