import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

const PageHeaderContext = createContext(null);

/**
 * Header actions/heading slot for BusinessPageHeader.
 * setActions(node, ownerId) / clearActions(ownerId) so route transitions cannot
 * wipe the next page's Back button (previous page unmount cleanup racing after
 * the next page's layout effect).
 */
export function PageHeaderProvider({ children }) {
  const [actions, setActionsState] = useState(null);
  const [heading, setHeading] = useState(null);
  const actionsOwnerRef = useRef(null);

  const setActions = useCallback((node, ownerId = null) => {
    actionsOwnerRef.current = ownerId;
    setActionsState(node);
  }, []);

  const clearActions = useCallback((ownerId = null) => {
    if (ownerId != null && actionsOwnerRef.current !== ownerId) return;
    actionsOwnerRef.current = null;
    setActionsState(null);
  }, []);

  const value = useMemo(
    () => ({ actions, setActions, clearActions, heading, setHeading }),
    [actions, setActions, clearActions, heading],
  );

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeaderState() {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error('usePageHeaderState must be used within PageHeaderProvider');
  }
  return context;
}

export function usePageHeaderActions() {
  const { setActions, clearActions } = usePageHeaderState();
  return { setActions, clearActions };
}

export function usePageHeaderHeading() {
  return usePageHeaderState().setHeading;
}
