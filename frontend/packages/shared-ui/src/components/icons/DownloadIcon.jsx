import React from 'react';

/** Brand download glyph — matches frontend/assets/gloablDownload.svg */
export default function DownloadIcon({ className = '', size = 16, title = 'Download' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : 'presentation'}
    >
      {title ? <title>{title}</title> : null}
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        transform="translate(2 3)"
      >
        <line
          x1="16.1427"
          y1="6.4156"
          x2="4.1017"
          y2="6.4156"
          transform="translate(10.1222 6.4156) rotate(-270) translate(-10.1222 -6.4156)"
        />
        <polyline
          transform="translate(10.1222 10.9724) rotate(-270) translate(-10.1222 -10.9724)"
          points="8.6582 8.0564 11.5862 10.9724 8.6582 13.8884"
        />
        <path
          d="M4,6.617 L4,5.684 C4,3.649 5.649,2 7.685,2 L12.569,2 C14.599,2 16.244,3.645 16.244,5.675 L16.244,16.815 C16.244,18.85 14.594,20.5 12.559,20.5 L7.674,20.5 C5.645,20.5 4,18.854 4,16.825 L4,15.883"
          transform="translate(10.122 11.25) rotate(-270) translate(-10.122 -11.25)"
        />
      </g>
    </svg>
  );
}
