import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { getUser, logout } from '@bainbridge/shared-auth';
import { initialsFromName } from './agentVoyages.js';
import styles from './AgentPortal.module.css';

function IconDash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="3" width="7" height="9" rx="1.5" />
      <rect x="3" y="12" width="7" height="9" rx="1.5" />
      <rect x="14" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8v4l3 2" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export default function AgentLayout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') || '';
  const user = getUser();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = useMemo(
    () => user?.name || user?.username || user?.fullName || 'Agent',
    [user],
  );

  const orgName = useMemo(
    () => user?.organisation || user?.companyName || user?.orgName || 'Agent Company',
    [user],
  );

  const avatar = initialsFromName(orgName === 'Agent Company' ? displayName : orgName);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/agent/login', { replace: true });
  };

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <div className={styles.hamburger} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className={styles.logo}>
            <div className={styles.logoMark}>S</div>
            <div className={styles.logoWord}>
              SO
              <span>C</span>
            </div>
          </div>
          <span className={styles.agentBadge}>Agent Portal</span>
        </div>
        <div className={styles.topbarRight}>
          <button
            type="button"
            className={styles.userBtn}
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
          >
            {displayName}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {menuOpen ? (
            <div className={styles.userMenu}>
              <button type="button" onClick={handleLogout}>Sign out</button>
            </div>
          ) : null}
        </div>
      </header>

      <aside className={styles.sidebar}>
        <div className={styles.agentCard}>
          <div className={styles.avatar}>{avatar}</div>
          <div>
            <div className={styles.welcome}>Welcome, Agent</div>
            <div className={styles.org}>{orgName}</div>
          </div>
        </div>

        <NavLink
          to="/agent/"
          end
          className={() => `${styles.sideItem} ${!filter ? styles.sideItemActive : ''}`}
        >
          <IconDash />
          Dashboard
        </NavLink>
        <NavLink
          to="/agent/?filter=open-initial"
          className={() => `${styles.sideSubitem} ${filter === 'open-initial' ? styles.sideSubitemActive : ''}`}
        >
          <IconClipboard />
          Open Initial PDA
        </NavLink>
        <NavLink
          to="/agent/?filter=working-fda"
          className={() => `${styles.sideSubitem} ${filter === 'working-fda' ? styles.sideSubitemActive : ''}`}
        >
          <IconClock />
          Working FDA
        </NavLink>
      </aside>

      <main className={styles.main}>
        <Outlet context={{ displayName, orgName }} />
      </main>
    </div>
  );
}
