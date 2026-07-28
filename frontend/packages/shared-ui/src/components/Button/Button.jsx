import React from 'react';
import { Link } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import AddCircleButton from '../AddCircleButton/AddCircleButton.jsx';
import styles from './Button.module.css';

const VARIANT_CLASS = {
  outline: styles.outline,
  'outline-secondary': styles.outline,
  secondary: styles.secondary,
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

/**
 * Design-system button.
 * When `label` is "+", renders the shared circular AddCircleButton.
 */
const Button = ({
  href,
  to,
  onClick,
  label,
  icon,
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

  const variantClass = VARIANT_CLASS[variant] || VARIANT_CLASS.outline;
  const baseClass = [
    styles.button,
    variantClass,
    styles[size] || styles.md,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const accessibleName = ariaLabel || label || icon;
  const resolvedIcon =
    variant === 'add' && (!icon || icon === 'plus') ? 'plus-circle' : icon;
  const content = (
    <>
      {resolvedIcon ? (
        <i className={`bi bi-${resolvedIcon} ${styles.icon}`} aria-hidden />
      ) : null}
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
