import React from 'react';
import { Link } from 'react-router-dom';
import { appPath } from '../routing.js';
import { theme } from '../theme.js';

const THEMED_VARIANTS = {
  primary: theme.colors.primary,
  info: theme.colors.info,
  success: theme.colors.success,
};

const DANGER_STYLE = {
  backgroundColor: 'rgba(249, 147, 102, 0.6)',
  border: '1px solid #f4652c',
  color: '#f4652c',
};

const DANGER_HOVER_CLASS = 'global-btn-danger';

/**
 * Shared pill button used across admin, internal-user, and other apps.
 * Use `to` for React Router navigation, or `href` for path-based navigation.
 */
const GlobalButton = ({
  href,
  to,
  onClick,
  label,
  icon,
  variant = 'primary',
  type = 'button',
  disabled = false,
  size = 'md',
  pill = true,
  className = '',
  ariaLabel,
}) => {
  const sizeClass = size === 'sm' ? 'btn-sm' : '';
  const pillClass = pill ? 'rounded-pill' : '';
  const paddingClass = size === 'sm' ? 'px-3' : 'px-4';
  const baseClass = [
    'btn',
    variant === 'danger' ? DANGER_HOVER_CLASS : `btn-${variant}`,
    pillClass,
    paddingClass,
    'shadow-sm',
    'd-inline-flex',
    'align-items-center',
    'justify-content-center',
    sizeClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const customStyle = { fontWeight: '500' };
  if (variant === 'danger') {
    Object.assign(customStyle, DANGER_STYLE);
  }
  const themedColor = THEMED_VARIANTS[variant];
  if (themedColor) {
    customStyle.backgroundColor = themedColor;
    customStyle.borderColor = themedColor;
    customStyle.color = '#fff';
  }
  if (variant === 'link') {
    customStyle.backgroundColor = 'transparent';
    customStyle.borderColor = 'transparent';
    customStyle.color = '';
    customStyle.boxShadow = 'none';
  }
  if (disabled) {
    customStyle.opacity = 0.7;
    customStyle.cursor = 'not-allowed';
  }

  const accessibleName = ariaLabel || label || icon;
  const iconSize = size === 'sm' ? '1rem' : '1.2rem';
  const content = (
    <>
      {icon && (
        <i
          className={`bi bi-${icon} ${label ? 'me-2' : ''}`}
          style={{ fontSize: iconSize }}
        />
      )}
      {label}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={baseClass}
        style={customStyle}
        title={accessibleName}
        aria-label={accessibleName}
        onClick={disabled ? (event) => event.preventDefault() : undefined}
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
        style={customStyle}
        title={accessibleName}
        aria-label={accessibleName}
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
      style={customStyle}
      title={accessibleName}
      aria-label={accessibleName}
    >
      {content}
    </button>
  );
};

export default GlobalButton;
