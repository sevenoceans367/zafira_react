import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { AppSidebar } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';

function SidebarLink({ to, icon, label, active }) {
  return (
    <li>
      <Link to={to} className={active ? 'active' : ''}>
        <i className={`bi ${icon} icon`} aria-hidden />
        <span>{label}</span>
      </Link>
    </li>
  );
}

function SidebarSection({ label }) {
  return (
    <li className="sidebar-section" aria-hidden>
      {label}
    </li>
  );
}

export default function AgentSidebar({ isOpen }) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') || '';
  const onDashboard = pathname === '/agent' || pathname === '/agent/';

  return (
    <AppSidebar isOpen={isOpen}>
      <ul className="sidebar-menu">
        <SidebarSection label="Agent Portal" />
        <SidebarLink
          to={appPath('/agent/')}
          icon="bi-speedometer2"
          label="Dashboard"
          active={onDashboard && !filter}
        />
        <SidebarLink
          to={appPath('/agent/?filter=open-initial')}
          icon="bi-clipboard-check"
          label="Open Initial PDA"
          active={onDashboard && filter === 'open-initial'}
        />
        <SidebarLink
          to={appPath('/agent/?filter=working-fda')}
          icon="bi-hourglass-split"
          label="Working FDA"
          active={onDashboard && filter === 'working-fda'}
        />
      </ul>
    </AppSidebar>
  );
}
