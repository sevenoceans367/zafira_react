import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  CardSelect,
  HeaderFilterControls,
  LoadingOverlay,
  PageHeaderSearch,
} from '@bainbridge/shared-ui';
import { fetchAgentDashboard } from '../../services/agentPortal.js';
import PageHeaderActions from '../internal-user/PageHeaderActions.jsx';
import {
  STATUS_LABEL,
  filterVoyages,
  canOpenFda,
} from './agentVoyages.js';
import styles from './AgentPortal.module.css';

const STATUS_CLASS = {
  notstarted: styles.status_notstarted,
  draft: styles.status_draft,
  submitted: styles.status_submitted,
  approved: styles.status_approved,
};

function greetingPrefix(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function firstName(fullName) {
  const parts = String(fullName || 'Agent').trim().split(/\s+/);
  return parts[0] || 'Agent';
}

function StatusChip({ status }) {
  return (
    <span className={`${styles.statusChip} ${STATUS_CLASS[status] || ''}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function PortRotation({ ports }) {
  return (
    <div className={styles.portChips}>
      {(ports || []).map((port, index) => (
        <React.Fragment key={`${port}-${index}`}>
          {index > 0 ? <span className={styles.locArrow}>→</span> : null}
          <span className={styles.locChip}>{port}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function AgentDashboardPage() {
  const { displayName = 'Agent', orgName = 'Agency' } = useOutletContext() || {};
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') || '';
  const [query, setQuery] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [voyages, setVoyages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const timestamp = useMemo(() => {
    const now = new Date();
    return now.toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const greeting = useMemo(() => greetingPrefix(), []);
  const greetName = useMemo(() => firstName(displayName), [displayName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchAgentDashboard();
        if (cancelled) return;
        setVoyages(Array.isArray(data.voyages) ? data.voyages : []);
        const firstYear = data.voyages?.[0]?.year;
        if (firstYear) setYear(String(firstYear));
      } catch (err) {
        if (!cancelled) {
          setVoyages([]);
          setError(err.message || 'Failed to load dashboard.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const yearOptions = useMemo(() => {
    const years = new Set(voyages.map((v) => String(v.year || new Date().getFullYear())));
    years.add(String(new Date().getFullYear()));
    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [voyages]);

  const rows = useMemo(() => {
    const filtered = filterVoyages(voyages, filter).filter((v) => {
      if (!year) return true;
      return String(v.year || '') === String(year);
    });
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (v) =>
        String(v.id || '').toLowerCase().includes(q)
        || String(v.vessel || '').toLowerCase().includes(q),
    );
  }, [voyages, filter, query, year]);

  const pageTitle = filter === 'open-initial'
    ? 'Open Initial PDA'
    : filter === 'working-fda'
      ? 'Working FDA'
      : 'Dashboard';

  const showHero = !filter;

  return (
    <div className={styles.dashboardPage}>
      {showHero ? (
        <>
          <div className={styles.bgSplash} aria-hidden>
            <span className={styles.bgSplashS1} />
            <span className={styles.bgSplashS2} />
          </div>
          <div className={styles.accessLine}>
            <span>
              Viewing as
              {' '}
              <b>{displayName}</b>
              {' '}
              <span className={styles.accessSep}>/</span>
              {' '}
              <b>{orgName}</b>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span>
              you have access to
              {' '}
              <b>Agency Module</b>
            </span>
          </div>
          <div className={styles.hero}>
            <div className={styles.heroLine1}>
              <span>{greeting}</span>
              ,
              {' '}
              <span className={styles.accentName}>{greetName}</span>
              .
            </div>
            <div className={styles.heroLine2}>What would you like to do today?</div>
          </div>
        </>
      ) : null}

      {loading ? <LoadingOverlay show fullScreen={false} /> : null}

      <PageHeaderActions deps={[query, year, yearOptions.join(',')]}>
        <HeaderFilterControls>
          <PageHeaderSearch
            value={query}
            onChange={setQuery}
            placeholder="Search voyage or vessel..."
          />
          <CardSelect
            options={yearOptions.map((y) => ({ id: y, name: y }))}
            value={year}
            onChange={setYear}
            placeholder="Year"
            ariaLabel="Year filter"
          />
        </HeaderFilterControls>
      </PageHeaderActions>

      {!filter ? (
        <div className={styles.pageHead}>
          <div className={styles.pageHeadLeft}>
            <div className={styles.pageHeadIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="3" width="7" height="9" rx="1.5" />
                <rect x="3" y="12" width="7" height="9" rx="1.5" />
                <rect x="14" y="16" width="7" height="5" rx="1.5" />
              </svg>
            </div>
            <div>
              <h1 className={styles.pageTitle}>{pageTitle}</h1>
              <div className={styles.pageSub}>{timestamp}</div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className={styles.formError}>{error}</div> : null}

      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>#</th>
                <th>Voyage No.</th>
                <th>Vessel</th>
                <th>Port</th>
                <th>SOF</th>
                <th>Initial PDA</th>
                <th>FDA</th>
                <th>Voyage Documents</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    No voyages match this view.
                  </td>
                </tr>
              ) : (
                rows.map((voyage, index) => (
                  <tr key={voyage.genAgencyId || voyage.id}>
                    <td>{index + 1}</td>
                    <td className={styles.accentCell}>{voyage.id}</td>
                    <td>{voyage.vessel}</td>
                    <td><PortRotation ports={voyage.ports} /></td>
                    <td>
                      <div className={styles.pdaCol}>
                        <StatusChip status={voyage.sof || 'notstarted'} />
                        <Link
                          to="/agent/sof"
                          className={`${styles.btnMini} ${styles.btnOutline}`}
                        >
                          {(voyage.sof || 'notstarted') === 'notstarted' ? 'Start SOF' : 'Open SOF'}
                        </Link>
                      </div>
                    </td>
                    <td>
                      <div className={styles.pdaCol}>
                        <StatusChip status={voyage.initial} />
                        <Link
                          to="/agent/port-cost?mode=pda"
                          className={`${styles.btnMini} ${styles.btnNavy}`}
                        >
                          {voyage.initial === 'notstarted' ? 'Start PDA' : 'Open PDA'}
                        </Link>
                      </div>
                    </td>
                    <td>
                      <div className={styles.pdaCol}>
                        <StatusChip status={voyage.fda} />
                        {canOpenFda(voyage) ? (
                          <Link
                            to="/agent/port-cost?mode=fda"
                            className={`${styles.btnMini} ${styles.btnOutline}`}
                          >
                            Open FDA
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.btnMini} ${styles.btnDisabled}`}
                            disabled
                            title="Available once Initial PDA has been submitted"
                          >
                            Awaiting PDA
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.docCol}>
                        <button type="button" className={styles.docBtn} disabled title="Documents coming soon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 15V3M7 10l5 5 5-5" />
                            <path d="M4 21h16" />
                          </svg>
                          PDA Request Letter
                        </button>
                        <button type="button" className={styles.docBtn} disabled title="Documents coming soon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 15V3M7 10l5 5 5-5" />
                            <path d="M4 21h16" />
                          </svg>
                          Bunker Stemmed Letter
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
