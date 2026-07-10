import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MASTERS_MODULES } from '../../constants/mastersModules.js';
import { masterAppPath, parseMastersModuleFromPath } from '../../constants/mastersModule.js';

export default function MastersSidebarTree({ isOpen }) {
  const { pathname } = useLocation();
  const module = parseMastersModuleFromPath(pathname);
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    setExpanded((value) => !value);
  };

  return (
    <li className={`treeview ${expanded ? 'open' : ''}`}>
      <button
        type="button"
        className={expanded ? 'expanded' : ''}
        onClick={toggleExpanded}
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
                <i className="bi bi-chevron-double-right icon" aria-hidden />
                <span>{master.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
