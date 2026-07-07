import React from 'react';
import { theme } from '../theme.js';
import defaultBrandLogo from '../assets/sevenOceanLogo.svg';
import defaultBrandText from '../assets/sevenoceanText.svg';
import './AppSidebar.css';

const AppSidebar = ({
  isOpen,
  children,
  brandLogo = defaultBrandLogo,
  brandText = defaultBrandText,
  brandLogoAlt = 'Logo',
}) => {
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
        <img src={brandLogo} alt={brandLogoAlt} className="sidebar-brand-logo" />
        {isOpen && brandText ? <img src={brandText} alt="" className="sidebar-brand-text" /> : null}
      </div>
      <nav className="sidebar-nav">{children}</nav>
    </aside>
  );
};

export default AppSidebar;
