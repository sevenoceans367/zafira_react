import React, { useEffect } from 'react';
import { usePageHeaderActions } from './PageHeaderContext.jsx';

/**
 * Injects controls into the layout PageHeader actions slot.
 * Clears on unmount; re-runs when deps change.
 */
export default function PageHeaderActions({ children, deps = [] }) {
  const setActions = usePageHeaderActions();

  useEffect(() => {
    setActions(children);
    return () => setActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return null;
}
