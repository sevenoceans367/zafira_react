import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SidebarSubmenuArrow from '../icons/SidebarSubmenuArrow.jsx';
import cargoReletIcon from '../../assets/cargo-relet.svg';
import {
  CARGO_RELET_SIDEBAR_ITEMS,
  cargoReletAppPath,
  isCargoReletPath,
  parseCargoReletModuleFromPath,
} from '../../constants/cargoReletModule.js';

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
        <img src={cargoReletIcon} alt="" className="icon" aria-hidden />
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
