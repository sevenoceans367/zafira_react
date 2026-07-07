import React, { useState, useEffect } from 'react';
import { appPath } from '../routing.js';
import AppHeader from './AppHeader.jsx';
import styles from './AppShell.module.css';

const SIDEBAR_STORAGE_KEY = 'sidebarOpen';

const AppShell = ({
  children,
  companyName = '',
  sidebar,
  collapseSidebar = false,
  profileHref,
  homeHref,
  onSignOut,
  sidebarStorageKey = SIDEBAR_STORAGE_KEY,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem(sidebarStorageKey);
    return saved !== 'false';
  });

  useEffect(() => {
    if (collapseSidebar) {
      setIsSidebarOpen(false);
      localStorage.setItem(sidebarStorageKey, 'false');
    }
  }, [collapseSidebar, sidebarStorageKey]);

  const handleSetSidebarOpen = (open) => {
    setIsSidebarOpen(open);
    localStorage.setItem(sidebarStorageKey, String(open));
  };

  const toggleSidebar = () => handleSetSidebarOpen(!isSidebarOpen);

  const resolvedProfileHref = profileHref === undefined ? undefined : profileHref ?? appPath('/profile');
  const renderedSidebar =
    typeof sidebar === 'function'
      ? sidebar({ isOpen: isSidebarOpen, setIsOpen: handleSetSidebarOpen })
      : sidebar;

  return (
    <div className={styles.layout}>
      {renderedSidebar}
      <div className={styles.mainWrapper}>
        <AppHeader
          toggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
          companyName={companyName}
          homeHref={homeHref}
          profileHref={resolvedProfileHref}
          onSignOut={onSignOut}
        />
        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
