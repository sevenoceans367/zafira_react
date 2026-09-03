import React from 'react';
import editRecapSrc from './edit-recap.png';

/** Universal edit / Edit Recap icon (hand + pen). */
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
