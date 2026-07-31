import { useEffect, useId, useRef } from 'react';
import styles from './ConfirmDialog.module.css';

function resolveTone(tone, title, mode) {
  if (tone) return tone;
  const t = String(title || '').toLowerCase();
  if (t.includes('error') || t.includes('failed')) return 'error';
  if (t.includes('success') || t.includes('saved')) return 'success';
  if (mode === 'confirm') return 'confirm';
  return 'warning';
}

function AlertIcon({ tone }) {
  if (tone === 'success') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  if (tone === 'error') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 9l-6 6M9 9l6 6" />
      </svg>
    );
  }
  if (tone === 'confirm') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    );
  }
  // warning — mockup uses plain "!"
  return <span className={styles.iconGlyph}>!</span>;
}

const BADGE_CLASS = {
  warning: styles.iconBadge,
  confirm: `${styles.iconBadge} ${styles.iconBadgeConfirm}`,
  error: `${styles.iconBadge} ${styles.iconBadgeError}`,
  success: `${styles.iconBadge} ${styles.iconBadgeSuccess}`,
};

function ValidationList({ validation }) {
  if (!validation || typeof validation !== 'object') return null;
  const entries = Object.entries(validation);
  if (!entries.length) return null;
  return (
    <ul className={styles.validationList}>
      {entries.map(([key, value]) => (
        <li key={key}>
          {Number(value) === 1 ? '✓' : '✗'} {key.replace(/_/g, ' ')}
        </li>
      ))}
    </ul>
  );
}

/**
 * Seven Oceans alert / confirm dialog shell.
 * @param {'alert'|'confirm'} mode
 * @param {'warning'|'confirm'|'error'|'success'} [tone]
 */
export default function ConfirmDialog({
  open,
  mode = 'confirm',
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  tone,
  validation,
  children,
  error,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const messageId = useId();
  const confirmRef = useRef(null);
  const resolvedTone = resolveTone(tone, title, mode);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    confirmRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onCancel?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const handleOverlayClick = (event) => {
    if (busy) return;
    if (event.target === event.currentTarget) onCancel?.();
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={handleOverlayClick}
    >
      <div
        className={styles.dialog}
        role={mode === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeBtn}
          aria-label="Close"
          disabled={busy}
          onClick={() => onCancel?.()}
        >
          ×
        </button>

        <div className={styles.head}>
          <div className={BADGE_CLASS[resolvedTone] || BADGE_CLASS.warning} aria-hidden="true">
            <AlertIcon tone={resolvedTone} />
          </div>
          <div className={styles.copy}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {message ? (
              <p id={messageId} className={styles.message}>
                {message}
              </p>
            ) : null}
            <ValidationList validation={validation} />
            {children ? <div className={styles.body}>{children}</div> : null}
            {error ? <p className={styles.error}>{error}</p> : null}
          </div>
        </div>

        <div className={styles.actions}>
          {mode === 'confirm' ? (
            <button
              type="button"
              className={styles.btnCancel}
              disabled={busy}
              onClick={() => onCancel?.()}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            ref={confirmRef}
            type="button"
            className={styles.btnOk}
            disabled={busy}
            onClick={() => onConfirm?.()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
