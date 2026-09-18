import React, { useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppShell } from '@bainbridge/shared-ui';
import { getUser, logout } from '@bainbridge/shared-auth';
import InternalUserPageHeader from '../internal-user/InternalUserPageHeader.jsx';
import { PageHeaderProvider } from '../internal-user/PageHeaderContext.jsx';
import AgentSidebar from './AgentSidebar.jsx';
import styles from './AgentPortal.module.css';
import layoutStyles from '../../components/Layout/InternalUserLayout.module.css';

export default function AgentLayout() {
  const navigate = useNavigate();
  const user = getUser();

  const displayName = useMemo(
    () => user?.name || user?.username || user?.fullName || 'Agent',
    [user],
  );

  const orgName = useMemo(
    () => user?.organisation || user?.companyName || user?.orgName || 'Agent Company',
    [user],
  );

  const handleSignOut = async () => {
    await logout();
    navigate('/agent/login', { replace: true });
  };

  return (
    <PageHeaderProvider>
      <AppShell
        companyName={displayName}
        sidebar={({ isOpen }) => <AgentSidebar isOpen={isOpen} />}
        profileHref=""
        onSignOut={handleSignOut}
        sidebarStorageKey="agentSidebarOpen"
      >
        <div className={`${layoutStyles.shell} ${styles.portal} internal-user-shell`}>
          <InternalUserPageHeader />
          <div className={`zafira-page ${styles.content}`}>
            <Outlet context={{ displayName, orgName }} />
          </div>
        </div>
      </AppShell>
    </PageHeaderProvider>
  );
}
