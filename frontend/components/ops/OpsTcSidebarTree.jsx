import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import SidebarSubmenuArrow from '../icons/SidebarSubmenuArrow.jsx';
import timeCharterIcon from '../../assets/TIME CHARTER.png';

const OPS_TC_GLANCE_PATH = '/internal-user/vc/ops-tc/in-ops-glance';

function parseOpsTcTab(value) {
  if (value === 'post-ops' || value === 'postops' || value === '2') return 'post-ops';
  if (value === 'history' || value === '3') return 'history';
  return 'ops';
}

function opsTcGlanceHref(tab = 'ops') {
  if (tab === 'post-ops') return `${OPS_TC_GLANCE_PATH}?tab=post-ops`;
  if (tab === 'history') return `${OPS_TC_GLANCE_PATH}?tab=history`;
  return OPS_TC_GLANCE_PATH;
}

export const OPS_TC_ITEMS = [
  { id: 'ops', label: 'TC Ops', to: opsTcGlanceHref('ops') },
  { id: 'post-ops', label: 'Post Ops', to: opsTcGlanceHref('post-ops') },
  { id: 'history', label: 'Voyage History', to: opsTcGlanceHref('history') },
];

export default function OpsTcSidebarTree({ isOpen }) {
  const { pathname, search } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);
  const firstHref = appPath(OPS_TC_GLANCE_PATH);
  const branchActive = pathname.includes('/internal-user/vc/ops-tc/');
  const glanceTab = pathname.includes('/internal-user/vc/ops-tc/in-ops-glance')
    ? parseOpsTcTab(new URLSearchParams(search).get('tab'))
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

  return (
    <li ref={rootRef} className={`treeview ${expanded ? 'open' : ''}`}>
      <Link
        to={firstHref}
        className={`${expanded ? 'expanded' : ''} ${branchActive ? 'active' : ''}`.trim()}
        onClick={() => setExpanded(false)}
        aria-haspopup="true"
      >
        <img src={timeCharterIcon} alt="" className="icon" aria-hidden />
        {isOpen ? <span>Time Charter Ops</span> : null}
        {isOpen ? <SidebarSubmenuArrow className="icon master-chevron" /> : null}
      </Link>
      <ul className="treeview-menu">
        {OPS_TC_ITEMS.map((item) => {
          const active = glanceTab === item.id;
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
