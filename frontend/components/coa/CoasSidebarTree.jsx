import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import coaIcon from '../../assets/COA.svg';
import SidebarSubmenuArrow from '../icons/SidebarSubmenuArrow.jsx';

const COA_ITEMS = [
  { id: 'running', label: 'Running COAs' },
  { id: 'cargo-relet', label: 'COA - Cargo Relet' },
  { id: 'in-ops', label: 'COA - In Ops' },
  { id: 'post-ops', label: 'COA - Post Ops' },
];

export default function CoasSidebarTree({ isOpen }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);
  const firstHref = appPath(`/internal-user/vc/coas/${COA_ITEMS[0].id}`);
  const branchActive = pathname.includes('/internal-user/vc/coas/');

  useEffect(() => {
    if (!expanded) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setExpanded(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [expanded]);

  return (
    <li ref={rootRef} className={`treeview ${expanded ? 'open' : ''}`}>
      <Link
        to={firstHref}
        className={`${expanded ? 'expanded' : ''} ${branchActive ? 'active' : ''}`.trim()}
        onClick={() => setExpanded(false)}
        aria-haspopup="true"
      >
        <img src={coaIcon} alt="" className="icon" aria-hidden />
        {isOpen ? <span>COAs</span> : null}
        {isOpen ? (
          <i className="bi bi-chevron-down master-chevron" aria-hidden />
        ) : null}
      </Link>
      <ul className="treeview-menu">
        {COA_ITEMS.map((item) => {
          const href = `/internal-user/vc/coas/${item.id}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={item.id}>
              <Link
                to={appPath(href)}
                className={active ? 'active' : ''}
                onClick={() => setExpanded(false)}
              >
                <SidebarSubmenuArrow />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
