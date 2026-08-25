import React from 'react';
import { Link } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import AddCircleButton from '../AddCircleButton/AddCircleButton.jsx';
import DownloadIcon from '../icons/DownloadIcon.jsx';
import styles from './Button.module.css';

const VARIANT_CLASS = {
  outline: styles.outline,
  'outline-secondary': styles.outline,
  secondary: styles.secondary,
  /** PHP Update_COA `.btn-outline-sm` back control */
  back: styles.back,
  primary: styles.primary,
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

/**
 * Design-system button.
 * When `label` is "+", renders the shared circular AddCircleButton.
 * When `icon` is "download", uses the brand DownloadIcon (gloablDownload.svg).
 * Labels starting with "Back" (with outline/secondary) use the Update COA
 * outline-sm style (+ chevron). Pass `variant="back"` to force that look.
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
  const resolvedVariant = useBackStyle ? 'back' : variant;
  const variantClass = VARIANT_CLASS[resolvedVariant] || VARIANT_CLASS.outline;
  const sizeClass = useBackStyle ? '' : (styles[size] || styles.md);
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
