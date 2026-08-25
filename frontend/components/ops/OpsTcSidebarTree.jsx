import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import SidebarSubmenuArrow from '../icons/SidebarSubmenuArrow.jsx';
import spotIcon from '../../assets/010-pie-chart.png';

export const OPS_TC_ITEMS = [
  { id: 'finalised-fixtures', label: 'Finalised Voyage Fixtures TC' },
  { id: 'in-ops-glance', label: 'In Ops at a glance TC' },
  { id: 'post-ops', label: 'Vessels in Post Ops TC' },
  { id: 'history', label: 'Vessels in History TC' },
  { id: 'year-updation', label: 'Year Updation-TC' },
];

export default function OpsTcSidebarTree({ isOpen }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);
  const firstHref = appPath(`/internal-user/vc/ops-tc/${OPS_TC_ITEMS[0].id}`);
  const branchActive = pathname.includes('/internal-user/vc/ops-tc/');

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
        <img src={spotIcon} alt="" className="icon" aria-hidden />
        {isOpen ? <span>TC Ops</span> : null}
        {isOpen ? <SidebarSubmenuArrow className="icon master-chevron" /> : null}
      </Link>
      <ul className="treeview-menu">
        {OPS_TC_ITEMS.map((item) => {
          const href = `/internal-user/vc/ops-tc/${item.id}`;
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
