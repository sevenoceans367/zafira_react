import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  coaAppPath,
  coaSidebarItems,
  isCoaOpsPath,
  parseCoaModuleFromPath,
} from '../../constants/coaModule.js';
import coaIcon from '../../assets/COA.svg';
import SidebarSubmenuArrow from '../icons/SidebarSubmenuArrow.jsx';

export default function CoasSidebarTree({ isOpen }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);
  const module = parseCoaModuleFromPath(pathname);
  const menuItems = coaSidebarItems(module);
  const firstHref = coaAppPath(module, menuItems[0].id);
  const branchActive = pathname.includes(`/internal-user/${module}/coas`);

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
        {isOpen ? <SidebarSubmenuArrow className="icon master-chevron" /> : null}
      </Link>
      <ul className="treeview-menu">
        {menuItems.map((item) => {
          const href = coaAppPath(module, item.id);
          const active = item.id === 'in-ops'
            ? isCoaOpsPath(pathname)
            : pathname.includes(`/internal-user/${module}/coas/${item.id}`);
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
