import React, { useEffect, useLayoutEffect } from 'react';
import { usePageHeaderActions } from './PageHeaderContext.jsx';

/**
 * Injects controls into the layout BusinessPageHeader actions slot.
 * Clears only on unmount (not on every deps refresh) so the header
 * does not flash empty while search/filters update.
 */
export default function PageHeaderActions({ children, deps = [] }) {
  const setActions = usePageHeaderActions();

  useLayoutEffect(() => {
    setActions(children);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => () => setActions(null), [setActions]);

  return null;
}
