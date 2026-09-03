import React from 'react';
import { useSearchParams } from 'react-router-dom';
import styles from './OpsVcInOpsGlancePage.module.css';

export const OPS_TC_GLANCE_PATH = '/internal-user/vc/ops-tc/in-ops-glance';

export const OPS_TC_STATUS_TABS = [
  { id: 'ops', label: 'Ops' },
  { id: 'post-ops', label: 'Post Ops' },
  { id: 'history', label: 'History' },
];

export function parseOpsTcTab(value) {
  if (value === 'post-ops' || value === 'postops' || value === '2') return 'post-ops';
  if (value === 'history' || value === '3') return 'history';
  return 'ops';
}

export function opsTcGlanceHref(tab = 'ops') {
  if (tab === 'post-ops') return `${OPS_TC_GLANCE_PATH}?tab=post-ops`;
  if (tab === 'history') return `${OPS_TC_GLANCE_PATH}?tab=history`;
  return OPS_TC_GLANCE_PATH;
}

export const OPS_TC_BACK_BY_PAGE = {
  1: OPS_TC_GLANCE_PATH,
  2: opsTcGlanceHref('post-ops'),
  3: opsTcGlanceHref('history'),
};

function TabIcon({ id }) {
  if (id === 'post-ops') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h13" />
        <path d="M13 6l6 6-6 6" />
        <path d="M3 6v12" />
      </svg>
    );
  }
  if (id === 'history') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export default function OpsTcStatusTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusTab = parseOpsTcTab(searchParams.get('tab'));

  const selectTab = (tabId) => {
    const next = new URLSearchParams(searchParams);
    if (tabId === 'ops') next.delete('tab');
    else next.set('tab', tabId);
    next.delete('msg');
    setSearchParams(next);
  };

  return (
    <div className={styles.statusTabs} role="tablist" aria-label="TC Ops status">
      {OPS_TC_STATUS_TABS.map((tab) => {
        const active = statusTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.statusTab} ${active ? styles.statusTabActive : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            <TabIcon id={tab.id} />
            {active ? <span className={styles.tabDot} aria-hidden="true" /> : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
