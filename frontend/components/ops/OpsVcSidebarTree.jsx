import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';

export const OPS_VC_ITEMS = [
  { id: 'in-ops-glance', label: 'In Ops at a glance VC' },
  { id: 'post-ops', label: 'Vessels in Post Ops VC' },
  { id: 'history', label: 'Vessels in History VC' },
  { id: 'year-updation', label: 'Year Updation-VC/COA' },
];

export default function OpsVcSidebarTree({ isOpen }) {
  const { pathname } = useLocation();
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
        <i className="bi bi-geo-alt icon" aria-hidden />
        {isOpen ? <span>Ops - VC</span> : null}
        {isOpen ? (
          <i className="bi bi-chevron-down master-chevron" aria-hidden />
        ) : null}
      </button>
      <ul className="treeview-menu">
        {OPS_VC_ITEMS.map((item) => {
          const href = `/internal-user/vc/ops/${item.id}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={item.id}>
              <Link
                to={appPath(href)}
                className={active ? 'active' : ''}
                onClick={() => setExpanded(false)}
              >
                <i className="bi bi-chevron-double-right icon" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
