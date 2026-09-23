import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SidebarSubmenuArrow from '../icons/SidebarSubmenuArrow.jsx';
import {
  CARGO_RELET_SIDEBAR_ITEMS,
  cargoReletAppPath,
  isCargoReletPath,
  parseCargoReletModuleFromPath,
} from '../../constants/cargoReletModule.js';

function CargoReletIcon({ className = 'icon' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polyline points="16 3 21 3 21 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="4" y1="20" x2="21" y2="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="21 16 21 21 16 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="15" y1="15" x2="21" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="4" y1="4" x2="9" y2="9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CargoReletSidebarTree({ isOpen, module: moduleProp }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);
  const module = moduleProp || parseCargoReletModuleFromPath(pathname);
  const firstHref = cargoReletAppPath(module);
  const branchActive = isCargoReletPath(pathname);

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
        <CargoReletIcon />
        {isOpen ? <span>Cargo Relet</span> : null}
        {isOpen ? <SidebarSubmenuArrow className="icon master-chevron" /> : null}
      </Link>
      <ul className="treeview-menu">
        {CARGO_RELET_SIDEBAR_ITEMS.map((item) => {
          const href = cargoReletAppPath(module, item.segment);
          const active = item.id === 'ops'
            ? pathname.includes('/cargo-relets/ops')
            : (
              pathname.includes(`/internal-user/${module}/cargo-relets`)
              && !pathname.includes('/cargo-relets/ops')
            );
          return (
            <li key={item.id}>
              <Link
                to={href}
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
