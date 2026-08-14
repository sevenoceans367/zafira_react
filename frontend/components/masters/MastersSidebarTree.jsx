import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MASTERS_MODULES } from '../../constants/mastersModules.js';
import { masterAppPath, parseMastersModuleFromPath } from '../../constants/mastersModule.js';
import SidebarSubmenuArrow from '../icons/SidebarSubmenuArrow.jsx';

export default function MastersSidebarTree({ isOpen }) {
  const { pathname } = useLocation();
  const module = parseMastersModuleFromPath(pathname);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);

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
      <button
        type="button"
        className={expanded ? 'expanded' : ''}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-haspopup="true"
      >
        <i className="bi bi-folder icon" aria-hidden />
        {isOpen ? <span>Masters</span> : null}
        {isOpen ? (
          <i className="bi bi-chevron-down master-chevron" aria-hidden />
        ) : null}
      </button>
      <ul className="treeview-menu">
        {MASTERS_MODULES.map((master) => {
          const href = masterAppPath(module, master.id);
          const active = pathname.includes(`/masters/${master.id}`);
          return (
            <li key={master.id}>
              <Link to={href} className={active ? 'active' : ''} onClick={() => setExpanded(false)}>
                <SidebarSubmenuArrow />
                <span>{master.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
