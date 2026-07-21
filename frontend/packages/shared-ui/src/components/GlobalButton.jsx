import React from 'react';
import { Link } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
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
const SECONDARY_CLASS = 'global-btn-secondary';
const ACCENT_CLASS = 'global-btn-accent';
const CLOSE_CLASS = 'global-btn-close';

/** @deprecated use `secondary` */
const OUTLINE_CLASS = SECONDARY_CLASS;

const ACCENT_STYLE = {
  backgroundColor: 'rgba(249, 147, 102, 0.6)',
  border: '1px solid #f4652c',
  borderRadius: '10px',
  color: '#f4652c',
  boxShadow: 'none',
};

const SECONDARY_STYLE = {
  backgroundColor: 'transparent',
  border: '1px solid #376eb8',
  borderRadius: '10px',
  color: '#376eb8',
  boxShadow: 'none',
};

const CLOSE_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #9cc0fb',
  borderRadius: '999px',
  color: '#3b82f6',
  boxShadow: 'none',
  fontWeight: '600',
};

/** @deprecated use SECONDARY_STYLE */
const OUTLINE_STYLE = SECONDARY_STYLE;

function resolveVariantClass(variant) {
  if (variant === 'danger') return DANGER_HOVER_CLASS;
  if (variant === 'accent') return ACCENT_CLASS;
  if (variant === 'close') return CLOSE_CLASS;
  if (variant === 'secondary' || variant === 'outline') return SECONDARY_CLASS;
  return `btn-${variant}`;
}

const SQUARE_VARIANTS = new Set(['secondary', 'outline', 'accent', 'close']);

/**
 * Shared pill button used across admin, internal-user, and other apps.
 * - `secondary`: hollow #376EB8 border/text, 10px radius, hover fill #BCCADB
 * - `accent`: #F99366 60% fill, #F4652C stroke; hover #FF986A / #F18154, 10px radius
 * - `close`: light grey fill, medium grey stroke/text, pill radius
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
  const pillClass = SQUARE_VARIANTS.has(variant) ? '' : (pill ? 'rounded-pill' : '');
  const paddingClass = size === 'sm' ? 'px-3' : 'px-4';
  const shadowClass = SQUARE_VARIANTS.has(variant) ? '' : 'shadow-sm';
  const baseClass = [
    'btn',
    resolveVariantClass(variant),
    pillClass,
    paddingClass,
    shadowClass,
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
  if (variant === 'secondary' || variant === 'outline') {
    Object.assign(customStyle, SECONDARY_STYLE);
  }
  if (variant === 'close') {
    Object.assign(customStyle, CLOSE_STYLE);
  }
  if (variant === 'accent') {
    Object.assign(customStyle, ACCENT_STYLE);
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
