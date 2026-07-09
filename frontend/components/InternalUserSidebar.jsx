import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppSidebar } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fleetAppPath } from '../constants/fleetModule.js';
import { SOPF_SIDEBAR_ITEMS } from '../constants/sopfSidebarMenu.js';

function isSidebarItemActive(pathname, item) {
  if (typeof item.isActive === 'function') {
    return item.isActive(pathname);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

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

const FLEET_LINK = {
  icon: 'bi-anchor',
  label: 'Fleet',
};

export default function InternalUserSidebar({ isOpen }) {
  const { pathname: currentPath } = useLocation();
  const inSopf = currentPath.startsWith('/internal-user/sopf');
  const inVc = currentPath.startsWith('/internal-user/vc');
  const inTc = currentPath.startsWith('/internal-user/tc');

  return (
    <AppSidebar isOpen={isOpen}>
      <ul className="sidebar-menu">
        <SidebarLink
          to={appPath('/')}
          icon="bi-house"
          label="Home"
          active={currentPath === '/'}
        />

        {inSopf ? (
          <>
            <SidebarSection label="SOPF" />
            {SOPF_SIDEBAR_ITEMS.map((item) => (
              <SidebarLink
                key={item.id}
                to={item.href.startsWith('/') ? appPath(item.href) : item.href}
                icon={item.icon}
                label={item.label}
                active={isSidebarItemActive(currentPath, item)}
              />
            ))}
          </>
        ) : null}

        {inVc ? (
          <>
            <SidebarSection label="VC" />
            <SidebarLink
              to={appPath('/internal-user/vc')}
              icon="bi-speedometer2"
              label="Dashboard"
              active={currentPath === '/internal-user/vc'}
            />
            <SidebarLink
              to={fleetAppPath('vc')}
              icon={FLEET_LINK.icon}
              label={FLEET_LINK.label}
              active={currentPath.startsWith('/internal-user/vc/fleet')}
            />
          </>
        ) : null}

        {inTc ? (
          <>
            <SidebarSection label="TC" />
            <SidebarLink
              to={appPath('/internal-user/tc')}
              icon="bi-clock-history"
              label="Time Charter"
              active={currentPath === '/internal-user/tc'}
            />
            <SidebarLink
              to={fleetAppPath('tc')}
              icon={FLEET_LINK.icon}
              label={FLEET_LINK.label}
              active={currentPath.startsWith('/internal-user/tc/fleet')}
            />
          </>
        ) : null}
      </ul>
    </AppSidebar>
  );
}
