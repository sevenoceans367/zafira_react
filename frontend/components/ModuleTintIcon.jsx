import React from 'react';

/** Renders a module icon tinted to match parent text color (currentColor). */
export default function ModuleTintIcon({ src, className, alt = '' }) {
  if (!src) return null;

  return (
    <span
      className={className}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
      }}
    />
  );
}
