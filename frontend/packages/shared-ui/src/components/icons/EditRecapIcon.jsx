import React from 'react';

/**
 * Universal edit / “Edit Recap” glyph — stroke pencil (Cargo_Relet_Ops.html).
 */
export default function EditRecapIcon({
  size = 13,
  className = '',
  alt = '',
  title,
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={!alt && !title}
      role={alt || title ? 'img' : 'presentation'}
    >
      {title || alt ? <title>{title || alt}</title> : null}
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
