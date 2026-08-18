import React from 'react';

/** Iconly Arrow Right — used for all left-nav expand and flyout arrows. */
export default function SidebarSubmenuArrow({ className = 'icon submenuArrow' }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M8.75 5L15.75 12L8.75 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}
