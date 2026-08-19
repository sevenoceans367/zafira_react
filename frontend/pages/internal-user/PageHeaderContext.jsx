import React, { createContext, useContext, useMemo, useState } from 'react';

const PageHeaderContext = createContext(null);

export function PageHeaderProvider({ children }) {
  const [actions, setActions] = useState(null);
  const [heading, setHeading] = useState(null);
  const value = useMemo(
    () => ({ actions, setActions, heading, setHeading }),
    [actions, heading],
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
  return usePageHeaderState().setActions;
}

export function usePageHeaderHeading() {
  return usePageHeaderState().setHeading;
}
