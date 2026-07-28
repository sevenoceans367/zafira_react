import React, { useEffect, useRef } from 'react';
import { theme } from '../theme.js';
import defaultBrandLogo from '../assets/sevenOceanLogo.svg';
import defaultBrandText from '../assets/sevenoceanText.svg';
import './AppSidebar.css';

const VIEWPORT_EDGE = 12;

function positionTreeviewFlyout(treeviewLi) {
  const menu = Array.from(treeviewLi.children).find(
    (el) => el.classList?.contains('treeview-menu'),
  );
  if (!menu) return;

  menu.style.top = '0px';
  menu.style.maxHeight = '';
  void menu.offsetHeight;
  const rect = menu.getBoundingClientRect();
  const vh = window.innerHeight;
  let shift = 0;

  if (rect.bottom > vh - VIEWPORT_EDGE) {
    shift = (vh - VIEWPORT_EDGE) - rect.bottom;
  }
  if (rect.top + shift < VIEWPORT_EDGE) {
    shift = VIEWPORT_EDGE - rect.top;
    menu.style.maxHeight = `${Math.max(160, vh - VIEWPORT_EDGE * 2)}px`;
  }

  menu.style.top = `${shift}px`;
}

const AppSidebar = ({
  isOpen,
  children,
  brandLogo = defaultBrandLogo,
  brandText = defaultBrandText,
  brandLogoAlt = 'Logo',
}) => {
  const asideRef = useRef(null);

  useEffect(() => {
    const root = asideRef.current;
    if (!root) return undefined;

    let lastLi = null;

    const schedulePosition = (li) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => positionTreeviewFlyout(li));
      });
    };

    const handleOver = (event) => {
      const li = event.target.closest?.('li.treeview');
      if (!li || !root.contains(li)) return;
      lastLi = li;
      schedulePosition(li);
    };

    const handleLeave = (event) => {
      const li = event.target.closest?.('li.treeview');
      if (!li || !root.contains(li)) return;
      if (li.contains(event.relatedTarget)) return;
      if (lastLi === li) lastLi = null;
      const menu = Array.from(li.children).find((el) => el.classList?.contains('treeview-menu'));
      if (menu) {
        menu.style.top = '';
        menu.style.maxHeight = '';
      }
    };

    const handleResize = () => {
      root.querySelectorAll('li.treeview:hover, li.treeview.open, li.treeview:focus-within').forEach((li) => {
        positionTreeviewFlyout(li);
      });
    };

    root.addEventListener('mouseover', handleOver);
    root.addEventListener('focusin', handleOver);
    root.addEventListener('mouseout', handleLeave);
    window.addEventListener('resize', handleResize);
    return () => {
      root.removeEventListener('mouseover', handleOver);
      root.removeEventListener('focusin', handleOver);
      root.removeEventListener('mouseout', handleLeave);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <aside
      ref={asideRef}
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
