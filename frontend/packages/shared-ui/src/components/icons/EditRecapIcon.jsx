import React from 'react';
import editRecapSrc from '../../assets/edit-recap.png';

/**
 * Universal edit / “Edit Recap” glyph — hand + pen on document.
 */
export default function EditRecapIcon({
  size = 16,
  className = '',
  alt = '',
  title,
}) {
  return (
    <img
      src={editRecapSrc}
      alt={alt}
      title={title}
      width={size}
      height={size}
      className={className}
      aria-hidden={!alt}
      draggable={false}
    />
  );
}
