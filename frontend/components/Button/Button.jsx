import React from 'react';
import { Link } from 'react-router-dom';
import { appPath } from '../../routing.js';
import styles from './Button.module.css';

const VARIANT_CLASS = {
  outline: styles.outline,
  'outline-secondary': styles.outline,
  secondary: styles.secondary,
  primary: styles.primary,
  accent: styles.accent,
  add: styles.add,
  close: styles.close,
  danger: styles.danger,
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  link: styles.link,
};

/**
 * Design-system button.
 * - `outline` / `secondary`: hollow #376EB8 border
 * - `primary`: solid brand blue fill
 * - `accent`: orange fill/stroke (brand CTA)
 * - `add`: blue #549AE7 fill for add/create actions
 * - `close`: light grey fill, medium grey border/text, pill radius — modal dismiss
 * - `danger`: orange CTA — #F99366 60% fill, #F4652C border; hover #FF986A fill, #F18154 stroke
 * - `info`: cyan fill for informational actions
 * - `success`: green fill for confirm/close actions
 * - `warning`: amber fill for caution actions
 * - `link`: borderless icon/text action
 * Use `to` for React Router navigation, or `href` for path-based navigation.
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
