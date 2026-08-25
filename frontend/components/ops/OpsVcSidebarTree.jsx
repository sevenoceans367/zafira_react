import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import SidebarSubmenuArrow from '../icons/SidebarSubmenuArrow.jsx';
import spotIcon from '../../assets/010-pie-chart.png';

export const OPS_VC_ITEMS = [
  { id: 'in-ops-glance', label: 'Spot Ops' },
  { id: 'post-ops', label: 'Post-Ops' },
  { id: 'history', label: 'Voyage History' },
  { id: 'year-updation', label: 'Year Updation-VC/COA', hidden: true },
];

export default function OpsVcSidebarTree({ isOpen }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);
  const firstHref = appPath(`/internal-user/vc/ops/${OPS_VC_ITEMS[0].id}`);
  const branchActive = pathname.includes('/internal-user/vc/ops/');

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
        {isOpen ? <span>Spot Ops</span> : null}
        {isOpen ? <SidebarSubmenuArrow className="icon master-chevron" /> : null}
      </Link>
      <ul className="treeview-menu">
        {OPS_VC_ITEMS.filter((item) => !item.hidden).map((item) => {
          const href = `/internal-user/vc/ops/${item.id}`;
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
