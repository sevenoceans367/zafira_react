import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import SidebarSubmenuArrow from '../icons/SidebarSubmenuArrow.jsx';
import spotIcon from '../../assets/010-pie-chart.png';
import { OPS_VC_GLANCE_PATH, opsVcGlanceHref, parseOpsVcTab } from '../../pages/internal-user/ops/OpsVcStatusTabs.jsx';

export const OPS_VC_ITEMS = [
  { id: 'ops', label: 'Spot Ops', to: OPS_VC_GLANCE_PATH },
  { id: 'post-ops', label: 'Post-Ops', to: opsVcGlanceHref('post-ops') },
  { id: 'history', label: 'Voyage History', to: opsVcGlanceHref('history') },
  { id: 'year-updation', label: 'Year Updation-VC/COA', to: '/internal-user/vc/ops/year-updation', hidden: true },
];

export default function OpsVcSidebarTree({ isOpen }) {
  const { pathname, search } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);
  const firstHref = appPath(OPS_VC_GLANCE_PATH);
  const branchActive = pathname.includes('/internal-user/vc/ops/');
  const glanceTab = pathname.includes('/internal-user/vc/ops/in-ops-glance')
    ? parseOpsVcTab(new URLSearchParams(search).get('tab'))
    : null;

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

  const itemActive = (item) => {
    if (item.id === 'year-updation') {
      return pathname.includes('/internal-user/vc/ops/year-updation');
    }
    return glanceTab === item.id;
  };

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
          const active = itemActive(item);
          return (
            <li key={item.id}>
              <Link
                to={appPath(item.to)}
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
