import React from 'react';
import { Link } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import AddCircleButton from '../AddCircleButton/AddCircleButton.jsx';
import EditRecapIcon from '../icons/EditRecapIcon.jsx';
import DownloadIcon from '../icons/DownloadIcon.jsx';
import styles from './Button.module.css';

const VARIANT_CLASS = {
  outline: styles.outline,
  'outline-secondary': styles.outline,
  secondary: styles.secondary,
  /** PHP Update_COA `.btn-outline-sm` back control */
  back: styles.back,
  primary: styles.primary,
  /** Global form Submit / Submit & Close (navy, SOF-style) */
  submit: styles.submit,
  /** Secondary form action beside Submit (outline Save / draft Submit) */
  saveOutline: styles.saveOutline,
  accent: styles.accent,
  outlineAccent: styles.outlineAccent,
  add: styles.add,
  sensitivity: styles.sensitivity,
  /** Circular dismiss control (form Cancel → X, red on hover) */
  close: styles.close,
  danger: styles.danger,
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  link: styles.link,
};

function isBackLabel(label) {
  return typeof label === 'string' && /^Back\b/i.test(label.trim());
}

function isSubmitLabel(label) {
  return typeof label === 'string' && /^Submit\b/i.test(label.trim());
}

function isSaveLabel(label) {
  return typeof label === 'string' && /^Save\b/i.test(label.trim());
}

function isCancelLabel(label) {
  return typeof label === 'string' && /^Cancel$/i.test(label.trim());
}

/** Header / toolbar PDF actions — latest UI is download-icon only (no "PDF" text). */
function isPdfDownloadLabel(label) {
  if (typeof label !== 'string') return false;
  const t = label.trim().toLowerCase().replace(/…/g, '...');
  return (
    t === 'pdf'
    || t === 'generate pdf'
    || t === 'generating...'
    || t === 'generating pdf...'
    || t === 'download pdf'
  );
}

function BackChevronIcon() {
  return (
    <svg
      className={styles.backSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function SubmitSendIcon() {
  return (
    <svg
      className={styles.submitSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function SaveOutlineIcon() {
  return (
    <svg
      className={styles.saveOutlineSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

function CloseXIcon() {
  return (
    <svg
      className={styles.closeSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className={styles.submitSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * Design-system button.
 * When `label` is "+", renders the shared circular AddCircleButton.
 * When `icon` is "download", uses the brand DownloadIcon (gloablDownload.svg).
 * PDF labels ("PDF", "Generate PDF", …) auto-render as icon-only download
 * (latest header style). Pass `iconOnly` to force icon-only for any action.
 * Labels starting with "Back" (with outline/secondary) use the Update COA
 * outline-sm style (+ chevron). Pass `variant="back"` to force that look.
 * Form primary CTA: prefer `variant="submit"` (navy SOF-style Submit).
 * Labels starting with "Submit" with default/primary resolve to submit style.
 * Labels starting with "Save" with primary/outline resolve to saveOutline.
 * Label "Cancel" (outline/secondary) renders as circular X close (red on hover).
 */
const Button = ({
  href,
  to,
  onClick,
  label,
  icon,
  iconSrc,
  iconAlt = '',
  iconOnly = false,
  variant = 'outline',
  type = 'button',
  disabled = false,
  size = 'md',
  className = '',
  ariaLabel,
  title,
  target,
  rel,
  form,
}) => {
  if (label === '+') {
    return (
      <AddCircleButton
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={className}
        ariaLabel={ariaLabel || 'Add'}
      />
    );
  }

  const useBackStyle = variant === 'back' || (
    isBackLabel(label)
    && (variant === 'outline' || variant === 'secondary' || variant === 'outline-secondary')
  );
  const useCloseStyle = variant === 'close' || (
    isCancelLabel(label)
    && (variant === 'outline' || variant === 'secondary' || variant === 'outline-secondary')
  );
  const useSubmitStyle = !useCloseStyle && (variant === 'submit' || (
    isSubmitLabel(label)
    && (variant === 'primary' || variant === 'submit')
  ));
  const useSaveStyle = !useCloseStyle && !useSubmitStyle && (variant === 'saveOutline' || (
    isSaveLabel(label)
    && (variant === 'primary' || variant === 'outline' || variant === 'secondary' || variant === 'saveOutline')
  ));
  const pdfIconOnly = isPdfDownloadLabel(label);
  const useIconOnly = Boolean(iconOnly) || pdfIconOnly;
  const resolvedVariant = useBackStyle
    ? 'back'
    : useCloseStyle
      ? 'close'
      : useSubmitStyle
        ? 'submit'
        : useSaveStyle
          ? 'saveOutline'
          : variant;
  const variantClass = VARIANT_CLASS[resolvedVariant] || VARIANT_CLASS.outline;
  const sizeClass = (
    useBackStyle
    || resolvedVariant === 'submit'
    || resolvedVariant === 'saveOutline'
    || resolvedVariant === 'close'
    || useIconOnly
  )
    ? ''
    : (styles[size] || styles.md);
  const baseClass = [
    styles.button,
    variantClass,
    sizeClass,
    useIconOnly ? styles.iconOnly : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const accessibleName = ariaLabel
    || (useCloseStyle ? 'Close' : null)
    || (pdfIconOnly ? (title || 'Download PDF') : null)
    || label
    || icon
    || iconAlt;
  const resolvedIcon =
    variant === 'add' && (!icon || icon === 'plus')
      ? 'plus-circle'
      : (icon || (pdfIconOnly ? 'download' : icon));
  const iconSize = useIconOnly ? 16 : (size === 'sm' ? 14 : 16);

  let iconNode = null;
  if (useCloseStyle && !icon && !iconSrc) {
    iconNode = <CloseXIcon />;
  } else if (useBackStyle && !icon && !iconSrc) {
    iconNode = <BackChevronIcon />;
  } else if (resolvedVariant === 'submit' && !icon && !iconSrc) {
    iconNode = <SubmitSendIcon />;
  } else if (resolvedVariant === 'saveOutline' && !icon && !iconSrc) {
    iconNode = <SaveOutlineIcon />;
  } else if (iconSrc) {
    iconNode = (
      <img
        src={iconSrc}
        alt={iconAlt}
        className={styles.icon}
        aria-hidden={!iconAlt}
        width={iconSize}
        height={iconSize}
      />
    );
  } else if (resolvedIcon === 'download') {
    iconNode = <DownloadIcon className={styles.icon} size={iconSize} title="" />;
  } else if (resolvedIcon === 'lock') {
    iconNode = <LockIcon />;
  } else if (resolvedIcon === 'pencil' || resolvedIcon === 'pencil-square') {
    iconNode = <EditRecapIcon className={styles.icon} size={iconSize} />;
  } else if (resolvedIcon) {
    iconNode = <i className={`bi bi-${resolvedIcon} ${styles.icon}`} aria-hidden />;
  }

  const content = (
    <>
      {iconNode}
      {useCloseStyle || useIconOnly ? null : label}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={baseClass}
        title={accessibleName}
        aria-label={accessibleName}
        onClick={disabled ? (event) => event.preventDefault() : undefined}
        aria-disabled={disabled || undefined}
      >
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={appPath(href)}
        className={baseClass}
        title={title || accessibleName}
        aria-label={accessibleName}
        aria-disabled={disabled || undefined}
        target={target}
        rel={rel}
        onClick={disabled ? (event) => event.preventDefault() : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={baseClass}
      title={title || accessibleName}
      aria-label={accessibleName}
      form={form}
    >
      {content}
    </button>
  );
};

export default Button;
