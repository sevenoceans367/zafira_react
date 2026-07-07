import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppSidebar } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { SOPF_SIDEBAR_ITEMS } from '../constants/sopfSidebarMenu.js';

function isActivePath(currentPath, href) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export default function InternalUserSidebar({ isOpen }) {
  const { pathname: currentPath } = useLocation();
  const sopfActive = currentPath.startsWith('/internal-user/sopf');
  const [sopfOpen, setSopfOpen] = useState(false);

  useEffect(() => {
    setSopfOpen(false);
  }, [currentPath]);

  return (
    <AppSidebar isOpen={isOpen}>
      <ul className="sidebar-menu">
        <li>
          <Link
            to={appPath('/')}
            className={currentPath === '/' ? 'active' : ''}
          >
            <i className="bi bi-house icon" aria-hidden />
            <span>Dashboard</span>
          </Link>
        </li>

        <li>
          <Link
            to={appPath('/reports')}
            className={currentPath === '/reports' ? 'active' : ''}
          >
            <i className="bi bi-table icon" aria-hidden />
            <span>Reports</span>
          </Link>
        </li>

        <li className={`treeview${sopfOpen ? ' open' : ''}`}>
          <a
            href="#sopf"
            className={sopfOpen || sopfActive ? 'expanded' : ''}
            aria-expanded={sopfOpen || sopfActive}
            onClick={(event) => {
              event.preventDefault();
              setSopfOpen((open) => !open);
            }}
          >
            <i className="bi bi-folder2-open icon" aria-hidden />
            <span>SOPF</span>
            <i className="bi bi-chevron-right master-chevron" aria-hidden />
          </a>
          <ul className="treeview-menu sidebar-flyout">
            {SOPF_SIDEBAR_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  to={appPath(item.href)}
                  className={isActivePath(currentPath, item.href) ? 'active' : ''}
                  onClick={() => setSopfOpen(false)}
                >
                  <i className={`bi ${item.icon} icon`} aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </li>
      </ul>
    </AppSidebar>
  );
}
