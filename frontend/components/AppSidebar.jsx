import React, { useEffect, useRef } from 'react';
import { theme } from '../theme.js';
import defaultBrandLogo from '../assets/sevenOceanLogo.svg';
import defaultBrandText from '../assets/sevenoceanText.svg';
import './AppSidebar.css';

const VIEWPORT_EDGE = 12;

function clearFlyoutAnchor(menu) {
  if (!menu) return;
  menu.style.top = '';
  menu.style.left = '';
  menu.style.maxHeight = '';
  menu.removeAttribute('data-anchored');
}

function positionTreeviewFlyout(treeviewLi) {
  const menu = Array.from(treeviewLi.children).find(
    (el) => el.classList?.contains('treeview-menu'),
  );
  if (!menu) return;

  const liRect = treeviewLi.getBoundingClientRect();
  const gap = 6;
  const vh = window.innerHeight;
  menu.style.left = `${Math.round(liRect.right + gap)}px`;
  menu.style.top = `${Math.round(liRect.top)}px`;
  menu.style.maxHeight = '';
  void menu.offsetHeight;

  const rect = menu.getBoundingClientRect();
  let top = liRect.top;
  if (rect.bottom > vh - VIEWPORT_EDGE) {
    top -= rect.bottom - (vh - VIEWPORT_EDGE);
  }
  if (top < VIEWPORT_EDGE) {
    top = VIEWPORT_EDGE;
    menu.style.maxHeight = `${Math.max(160, vh - VIEWPORT_EDGE * 2)}px`;
  }
  menu.style.top = `${Math.round(top)}px`;
  menu.setAttribute('data-anchored', 'true');
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
      positionTreeviewFlyout(li);
      requestAnimationFrame(() => positionTreeviewFlyout(li));
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
      clearFlyoutAnchor(menu);
    };

    const repositionOpen = () => {
      root.querySelectorAll('li.treeview:hover, li.treeview.open, li.treeview:focus-within').forEach((li) => {
        positionTreeviewFlyout(li);
      });
    };

    const handleClick = (event) => {
      const li = event.target.closest?.('li.treeview');
      if (!li || !root.contains(li)) return;
      requestAnimationFrame(() => schedulePosition(li));
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;
        const li = mutation.target;
        if (!(li instanceof HTMLElement) || !li.classList.contains('treeview')) continue;
        if (li.classList.contains('open') || li.matches(':hover, :focus-within')) {
          schedulePosition(li);
        } else {
          const menu = Array.from(li.children).find((el) => el.classList?.contains('treeview-menu'));
          clearFlyoutAnchor(menu);
        }
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });

    const nav = root.querySelector('.sidebar-nav');
    root.addEventListener('mouseover', handleOver);
    root.addEventListener('focusin', handleOver);
    root.addEventListener('mouseout', handleLeave);
    root.addEventListener('click', handleClick);
    window.addEventListener('resize', repositionOpen);
    nav?.addEventListener('scroll', repositionOpen, { passive: true });
    return () => {
      observer.disconnect();
      root.removeEventListener('mouseover', handleOver);
      root.removeEventListener('focusin', handleOver);
      root.removeEventListener('mouseout', handleLeave);
      root.removeEventListener('click', handleClick);
      window.removeEventListener('resize', repositionOpen);
      nav?.removeEventListener('scroll', repositionOpen);
    };
  }, []);

  useEffect(() => {
    const root = asideRef.current;
    if (!root) return;
    root.querySelectorAll('li.treeview:hover, li.treeview.open, li.treeview:focus-within').forEach((li) => {
      positionTreeviewFlyout(li);
    });
  }, [isOpen]);

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
