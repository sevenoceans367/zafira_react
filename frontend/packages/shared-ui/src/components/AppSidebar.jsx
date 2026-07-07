import React from 'react';
import { theme } from '../theme.js';
import sevenOceanLogo from '../../../../assets/sevenOceanLogo.svg';
import sevenOceanText from '../../../../assets/sevenoceanText.svg';
import './AppSidebar.css';

const AppSidebar = ({ isOpen, children }) => {
  return (
    <aside
      className={`sidebar-wrapper ${isOpen ? 'open' : 'closed'}`}
      style={{
        width: isOpen ? '220px' : '60px',
        minWidth: isOpen ? '220px' : '60px',
        maxWidth: isOpen ? '220px' : '60px',
        '--sidebar-font-size': theme.fontSizes.body,
        '--sidebar-sub-font-size': theme.fontSizes.small,
      }}
    >
      <div className="sidebar-user-panel">
        <img src={sevenOceanLogo} alt="Seven Ocean" className="sidebar-brand-logo" />
        {isOpen && <img src={sevenOceanText} alt="" className="sidebar-brand-text" />}
      </div>
      <nav className="sidebar-nav">{children}</nav>
    </aside>
  );
};

export default AppSidebar;
