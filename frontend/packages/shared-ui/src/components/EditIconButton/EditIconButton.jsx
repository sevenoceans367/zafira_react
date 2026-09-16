import React from 'react';
import EditRecapIcon from '../icons/EditRecapIcon.jsx';
import styles from './EditIconButton.module.css';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

/**
 * Global table edit control — 26×26 bordered chip + stroke pencil
 * (Cargo_Relet_Ops.html `.icon-btn` layout and hover).
 */
export default function EditIconButton({
  title = 'Edit Details',
  className = '',
  as: Component = 'button',
  children,
  ...props
}) {
  const merged = {
    className: joinClasses(styles.iconBtn, className),
    title,
    'aria-label': props['aria-label'] ?? title,
    ...props,
  };

  if (Component === 'button' && merged.type === undefined) {
    merged.type = 'button';
  }

  return (
    <Component {...merged}>
      {children ?? <EditRecapIcon size={13} />}
    </Component>
  );
}

export { styles as editIconButtonStyles };
