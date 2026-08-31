import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { usePageHeaderActions } from './PageHeaderContext.jsx';

let nextHeaderActionsOwnerId = 0;

/**
 * Injects controls into the layout BusinessPageHeader actions slot.
 * Clears only on unmount so the header does not flash empty while
 * search/filters update.
 *
 * Sync only when `deps` change — do not depend on `children` identity, or any
 * page that also consumes PageHeaderContext (e.g. setHeading) will loop:
 * setActions → parent re-render → new children → setActions again.
 *
 * Clear is owner-scoped: a previous page's unmount must not wipe the next
 * page's Back button when cleanup runs after the next mount's layout effect.
 */
export default function PageHeaderActions({ children, deps = [] }) {
  const { setActions, clearActions } = usePageHeaderActions();
  const childrenRef = useRef(children);
  childrenRef.current = children;
  const ownerIdRef = useRef(null);
  if (ownerIdRef.current == null) {
    nextHeaderActionsOwnerId += 1;
    ownerIdRef.current = nextHeaderActionsOwnerId;
  }

  const depsKey = deps.map((value) => {
    if (value == null || typeof value !== 'object') return String(value);
    if (Array.isArray(value)) {
      return `arr:${value.length}:${value.map((item) => item?.id ?? item?.value ?? '').join(',')}`;
    }
    if (typeof value === 'function') return 'fn';
    return `obj:${value.label ?? value.id ?? ''}`;
  }).join('|');

  useLayoutEffect(() => {
    setActions(childrenRef.current, ownerIdRef.current);
  }, [setActions, depsKey]);

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    return () => clearActions(ownerId);
  }, [clearActions]);

  return null;
}
