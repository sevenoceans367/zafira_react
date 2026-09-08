import React from 'react';

export function shortPortTabLabel(label) {
  const text = String(label || '').trim();
  if (!text) return '';
  const slash = text.indexOf('/');
  if (slash === -1) return text;
  return text.slice(0, slash).trim() || text;
}

export function PortTabLabel({ label }) {
  const full = String(label || '').trim();
  const short = shortPortTabLabel(full);
  return (
    <span title={short && short !== full ? full : undefined}>
      {short || full}
    </span>
  );
}
