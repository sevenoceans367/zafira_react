import React, { useEffect, useLayoutEffect } from 'react';
import { usePageHeaderActions } from './PageHeaderContext.jsx';

/**
 * Injects controls into the layout BusinessPageHeader actions slot.
 * Clears only on unmount so the header does not flash empty while
 * search/filters update.
 */
export default function PageHeaderActions({ children, deps = [] }) {
  const setActions = usePageHeaderActions();
  const depsKey = deps.map((value) => {
    if (value == null || typeof value !== 'object') return String(value);
    if (Array.isArray(value)) {
      return `arr:${value.length}:${value.map((item) => item?.id ?? item?.value ?? '').join(',')}`;
    }
    if (typeof value === 'function') return 'fn';
    return `obj:${value.label ?? value.id ?? ''}`;
  }).join('|');

  useLayoutEffect(() => {
    setActions(children);
  }, [setActions, children, depsKey]);

  useEffect(() => () => setActions(null), [setActions]);

  return null;
}
