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

/**
 * Design-system button.
 * When `label` is "+", renders the shared circular AddCircleButton.
 * When `icon` is "download", uses the brand DownloadIcon (gloablDownload.svg).
 * Labels starting with "Back" (with outline/secondary) use the Update COA
 * outline-sm style (+ chevron). Pass `variant="back"` to force that look.
 * Form primary CTA: prefer `variant="submit"` (navy SOF-style Submit).
 * Labels starting with "Submit" with default/primary resolve to submit style.
 */
const Button = ({
  href,
  to,
  onClick,
  label,
  icon,
  iconSrc,
  iconAlt = '',
  variant = 'outline',
  type = 'button',
  disabled = false,
  size = 'md',
  className = '',
  ariaLabel,
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
  const useSubmitStyle = variant === 'submit' || (
    isSubmitLabel(label)
    && (variant === 'primary' || variant === 'submit')
  );
  const resolvedVariant = useBackStyle
    ? 'back'
    : (useSubmitStyle ? 'submit' : variant);
  const variantClass = VARIANT_CLASS[resolvedVariant] || VARIANT_CLASS.outline;
  const sizeClass = (useBackStyle || resolvedVariant === 'submit' || resolvedVariant === 'saveOutline')
    ? ''
    : (styles[size] || styles.md);
  const baseClass = [
    styles.button,
    variantClass,
    sizeClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const accessibleName = ariaLabel || label || icon || iconAlt;
  const resolvedIcon =
    variant === 'add' && (!icon || icon === 'plus') ? 'plus-circle' : icon;
  const iconSize = size === 'sm' ? 14 : 16;

  let iconNode = null;
  if (useBackStyle && !icon && !iconSrc) {
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
  } else if (resolvedIcon === 'pencil' || resolvedIcon === 'pencil-square') {
    iconNode = <EditRecapIcon className={styles.icon} size={iconSize} />;
  } else if (resolvedIcon) {
    iconNode = <i className={`bi bi-${resolvedIcon} ${styles.icon}`} aria-hidden />;
  }

  const content = (
    <>
      {iconNode}
      {label}
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
        title={accessibleName}
        aria-label={accessibleName}
        aria-disabled={disabled || undefined}
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
      title={accessibleName}
      aria-label={accessibleName}
    >
      {content}
    </button>
  );
};

export default Button;
