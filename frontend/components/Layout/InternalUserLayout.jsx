import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import InternalUserSidebar from '../InternalUserSidebar.jsx';
import InternalUserPageHeader from '../../pages/internal-user/InternalUserPageHeader.jsx';
import { PageHeaderProvider } from '../../pages/internal-user/PageHeaderContext.jsx';
import styles from './InternalUserLayout.module.css';

export default function InternalUserLayout() {
  return (
    <PageHeaderProvider>
      <AppShell
        companyName="Internal User"
        sidebar={({ isOpen }) => <InternalUserSidebar isOpen={isOpen} />}
        profileHref={appPath('/profile')}
        onSignOut={() => window.alert('Sign out — wire your auth here')}
      >
        <div className={`${styles.shell} internal-user-shell`}>
          <InternalUserPageHeader />
          <Outlet />
        </div>
      </AppShell>
    </PageHeaderProvider>
  );
}
