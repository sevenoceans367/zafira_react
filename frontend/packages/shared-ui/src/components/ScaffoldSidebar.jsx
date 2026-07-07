import React from 'react';
import { appPath, getAppRoute } from '@bainbridge/shared-routing';
import AppSidebar from './AppSidebar.jsx';

/**
 * Minimal sidebar for scaffold apps (superadmin, external-user, agent).
 */
const ScaffoldSidebar = ({ isOpen, setIsOpen, companyName = '', items = [] }) => {
  const currentPath = getAppRoute();

  return (
    <AppSidebar isOpen={isOpen} setIsOpen={setIsOpen} companyName={companyName}>
      <ul className="sidebar-menu">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={appPath(item.href)}
              className={currentPath === item.href ? 'active' : ''}
            >
              <i className={`bi ${item.icon} icon`} style={{ fontSize: '18px' }}></i>{' '}
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </AppSidebar>
  );
};

export default ScaffoldSidebar;
