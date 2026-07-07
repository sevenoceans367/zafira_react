import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchRecentWork } from '../services/recentWork.js';
import { fetchUserAlerts } from '../services/userAlerts.js';
import styles from './AppHeader.module.css';

const AppHeader = ({
  toggleSidebar,
  isSidebarOpen = true,
  companyName = '',
  profileHref,
  onSignOut,
}) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentActivityLoading, setRecentActivityLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [pageTrail, setPageTrail] = useState(null);
  const profileRef = useRef(null);
  const userLabel = companyName || 'User';

  const loadRecentActivity = useCallback(async () => {
    try {
      setRecentActivityLoading(true);
      const data = await fetchRecentWork();
      setRecentActivity(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch (error) {
      console.error('Failed to load recent work:', error);
      setRecentActivity([]);
    } finally {
      setRecentActivityLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setNotificationsLoading(true);
      const data = await fetchUserAlerts();
      setNotifications(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handlePageHeaderChange = (event) => {
      setPageTrail(event.detail ?? null);
    };

    window.addEventListener('app-page-header-change', handlePageHeaderChange);
    return () => window.removeEventListener('app-page-header-change', handlePageHeaderChange);
  }, []);

  useEffect(() => {
    const onRecentWorkUpdated = () => {
      if (activeDropdown === 'history') {
        loadRecentActivity();
      }
    };
    window.addEventListener('recent-work-updated', onRecentWorkUpdated);
    return () => window.removeEventListener('recent-work-updated', onRecentWorkUpdated);
  }, [activeDropdown, loadRecentActivity]);

  useEffect(() => {
    const onAlertsUpdated = () => {
      if (activeDropdown === 'activity') {
        loadNotifications();
      }
    };
    window.addEventListener('alerts-updated', onAlertsUpdated);
    return () => window.removeEventListener('alerts-updated', onAlertsUpdated);
  }, [activeDropdown, loadNotifications]);

  const handleDropdown = (e, menu) => {
    e.preventDefault();
    const opening = activeDropdown !== menu;
    setActiveDropdown(opening ? menu : null);
    if (opening && menu === 'history') {
      loadRecentActivity();
    }
    if (opening && menu === 'activity') {
      loadNotifications();
    }
  };

  const handleProfileToggle = (e) => {
    e.preventDefault();
    setActiveDropdown((current) => (current === 'profile' ? null : 'profile'));
  };

  const handleSignOut = async (e) => {
    e.preventDefault();
    setActiveDropdown(null);
    if (onSignOut) {
      await onSignOut();
    }
  };

  useEffect(() => {
    if (activeDropdown !== 'profile') return undefined;

    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeDropdown]);

  const activityCount = recentActivity.length;
  const activityBadgeCount = activityCount > 9 ? '9+' : activityCount;
  const notificationCount = notifications.length;
  const notificationBadgeCount = notificationCount > 9 ? '9+' : notificationCount;
  const userInitial = (userLabel.trim().charAt(0) || 'U').toUpperCase();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.leftSide}>
          <button
            type="button"
            onClick={toggleSidebar}
            className={styles.toggleButton}
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <i className="bi bi-layout-sidebar-inset"></i>
          </button>
          {pageTrail && (
            <nav className={styles.headerBreadcrumbWrap} aria-label="Breadcrumb">
              <ol className={styles.headerBreadcrumb}>
                <li>
                  <a href={pageTrail.homeHref} className={styles.headerBreadcrumbLink}>
                    <i className="bi bi-house-door-fill"></i> Home
                  </a>
                </li>
                {(pageTrail.breadcrumbs ?? []).map((crumb, index) => (
                  <React.Fragment key={`${crumb.label}-${index}`}>
                    <li className={styles.headerBreadcrumbSeparator}>/</li>
                    <li>
                      {crumb.href ? (
                        <a href={crumb.href} className={styles.headerBreadcrumbMuted}>
                          {crumb.label}
                        </a>
                      ) : (
                        <span className={styles.headerBreadcrumbMuted}>{crumb.label}</span>
                      )}
                    </li>
                  </React.Fragment>
                ))}
                {pageTrail.currentPage && (
                  <>
                    <li className={styles.headerBreadcrumbSeparator}>/</li>
                    <li className={styles.headerBreadcrumbCurrent}>{pageTrail.currentPage}</li>
                  </>
                )}
              </ol>
            </nav>
          )}
        </div>

        <div className={styles.navbarRight}>
          <ul className={styles.navList}>
            <li className={styles.dropdown}>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.historyButton}`}
                aria-label="Recent activity"
                title="Recent activity"
                aria-expanded={activeDropdown === 'history'}
                onClick={(e) => handleDropdown(e, 'history')}
              >
                <i className="bi bi-clock-history"></i>
                {activityCount > 0 && (
                  <span className={styles.historyBadge}>{activityBadgeCount}</span>
                )}
              </button>
            </li>
            <li className={styles.dropdown}>
              <a
                href="#activity"
                className={styles.dropdownToggle}
                onClick={(e) => handleDropdown(e, 'activity')}
                aria-label="Notifications"
                title="Notifications"
                aria-expanded={activeDropdown === 'activity'}
              >
                <i className="bi bi-bell-fill"></i>
                {notificationCount > 0 && (
                  <span className={styles.badge}>{notificationBadgeCount}</span>
                )}
              </a>
            </li>
            <li className={styles.dropdown} ref={profileRef}>
              <button
                type="button"
                className={styles.profileToggle}
                onClick={handleProfileToggle}
                aria-expanded={activeDropdown === 'profile'}
                aria-haspopup="menu"
              >
                <span className={styles.profileName}>{userLabel}</span>
                <span className={styles.profileAvatar} aria-hidden>
                  {userInitial}
                </span>
              </button>
              {activeDropdown === 'profile' && (
                <ul className={styles.profileMenu} role="menu">
                  {profileHref ? (
                    <li role="none">
                      <Link
                        to={profileHref}
                        className={styles.profileMenuItem}
                        role="menuitem"
                        onClick={() => setActiveDropdown(null)}
                      >
                        <i className="bi bi-person" aria-hidden />
                        Profile
                      </Link>
                    </li>
                  ) : null}
                  <li role="none">
                    <button
                      type="button"
                      className={styles.profileMenuItem}
                      role="menuitem"
                      onClick={handleSignOut}
                    >
                      <i className="bi bi-box-arrow-right" aria-hidden />
                      Logout
                    </button>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </div>
      </header>

      {activeDropdown === 'history' && (
        <>
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Close recent activity"
            onClick={() => setActiveDropdown(null)}
          />
          <aside className={styles.notificationDrawer} aria-label="Recent activity">
            <section>
              <h3 className={styles.drawerTitle}>Recent Activity</h3>
              <ul className={styles.drawerList}>
                {recentActivity.map((item, index) => (
                  <li key={`${item.datetime}-${index}`} className={styles.drawerItem}>
                    <span className={styles.drawerIcon}>
                      <i className="bi bi-clock-history"></i>
                    </span>
                    <span>
                      <strong>{item.work}</strong>
                      <small>{item.datetime}</small>
                    </span>
                  </li>
                ))}
                {recentActivityLoading && (
                  <li className={styles.drawerItem}>
                    <span className={styles.drawerIcon}>
                      <i className="bi bi-arrow-repeat"></i>
                    </span>
                    <span>
                      <strong>Loading recent activity...</strong>
                      <small>Please wait</small>
                    </span>
                  </li>
                )}
                {!recentActivityLoading && recentActivity.length === 0 && (
                  <li className={styles.drawerEmpty}>No recent activity.</li>
                )}
              </ul>
            </section>
          </aside>
        </>
      )}

      {activeDropdown === 'activity' && (
        <>
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Close notifications"
            onClick={() => setActiveDropdown(null)}
          />
          <aside className={styles.notificationDrawer} aria-label="Notifications">
            <section>
              <h3 className={styles.drawerTitle}>Notifications</h3>
              <ul className={styles.drawerList}>
                {notifications.map((item) => (
                  <li key={item.alertId} className={styles.drawerItem}>
                    <span className={styles.drawerIcon}>
                      <i className="bi bi-bell-fill"></i>
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      {item.message ? <small className={styles.drawerMessage}>{item.message}</small> : null}
                      <small>{item.datetime}</small>
                    </span>
                  </li>
                ))}
                {notificationsLoading && (
                  <li className={styles.drawerItem}>
                    <span className={styles.drawerIcon}>
                      <i className="bi bi-arrow-repeat"></i>
                    </span>
                    <span>
                      <strong>Loading notifications...</strong>
                      <small>Please wait</small>
                    </span>
                  </li>
                )}
                {!notificationsLoading && notifications.length === 0 && (
                  <li className={styles.drawerEmpty}>No new notifications.</li>
                )}
              </ul>
            </section>

            <section className={styles.drawerSection}>
              <h3 className={styles.drawerTitle}>Tasks</h3>
              <ul className={styles.drawerList}>
                <li className={styles.drawerEmpty}>No tasks available.</li>
              </ul>
            </section>
          </aside>
        </>
      )}
    </>
  );
};

export default AppHeader;
