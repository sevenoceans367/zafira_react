import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { usePageHeaderActions } from './PageHeaderContext.jsx';

/**
 * Injects controls into the layout BusinessPageHeader actions slot.
 * Clears only on unmount so the header does not flash empty while
 * search/filters update.
 *
 * Sync only when `deps` change — do not depend on `children` identity, or any
 * page that also consumes PageHeaderContext (e.g. setHeading) will loop:
 * setActions → parent re-render → new children → setActions again.
 */
export default function PageHeaderActions({ children, deps = [] }) {
  const setActions = usePageHeaderActions();
  const childrenRef = useRef(children);
  childrenRef.current = children;

  const depsKey = deps.map((value) => {
    if (value == null || typeof value !== 'object') return String(value);
    if (Array.isArray(value)) {
      return `arr:${value.length}:${value.map((item) => item?.id ?? item?.value ?? '').join(',')}`;
    }
    if (typeof value === 'function') return 'fn';
    return `obj:${value.label ?? value.id ?? ''}`;
  }).join('|');

  useLayoutEffect(() => {
    setActions(childrenRef.current);
  }, [setActions, depsKey]);

  useEffect(() => () => setActions(null), [setActions]);

  return null;
}
