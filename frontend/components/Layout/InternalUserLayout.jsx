import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppShell } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { logout } from '@bainbridge/shared-auth';
import InternalUserSidebar from '../InternalUserSidebar.jsx';
import ModuleSwitcherRail from '../ModuleSwitcherRail.jsx';
import InternalUserPageHeader from '../../pages/internal-user/InternalUserPageHeader.jsx';
import { PageHeaderProvider } from '../../pages/internal-user/PageHeaderContext.jsx';
import styles from './InternalUserLayout.module.css';

export default function InternalUserLayout() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <PageHeaderProvider>
      <AppShell
        companyName="Internal User"
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
