import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { logout } from '@bainbridge/shared-auth';
import InternalUserSidebar from '../InternalUserSidebar.jsx';
import ModuleSwitcherRail from '../ModuleSwitcherRail.jsx';
import InternalUserPageHeader from '../../pages/internal-user/InternalUserPageHeader.jsx';
import { PageHeaderProvider } from '../../pages/internal-user/PageHeaderContext.jsx';
import styles from './InternalUserLayout.module.css';

const COLLAPSE_SIDEBAR_PATHS = [
  '/internal-user/sopf/addestimate',
  '/internal-user/sopf/updateestimate',
  '/internal-user/sopf/viewestimate',
];

export default function InternalUserLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const collapseSidebar = COLLAPSE_SIDEBAR_PATHS.some((path) => (
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  ));

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <PageHeaderProvider>
      <AppShell
        companyName="Internal User"
        collapseSidebar={collapseSidebar}
        sidebar={({ isOpen }) => (
          <div className={styles.navCluster}>
            <ModuleSwitcherRail />
            <InternalUserSidebar isOpen={isOpen} />
          </div>
        )}
        profileHref={appPath('/profile')}
        onSignOut={handleSignOut}
      >
        <div className={`${styles.shell} internal-user-shell`}>
          <InternalUserPageHeader />
          <Outlet />
        </div>
      </AppShell>
    </PageHeaderProvider>
  );
}
