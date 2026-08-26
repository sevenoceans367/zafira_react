import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchOpsTcFixtureNote } from '../../../services/opsTc.js';
import TcFixtureFormPage from '../tc/TcFixtureFormPage.jsx';
import styles from './OpsPages.module.css';

const BACK_BY_PAGE = {
  1: '/internal-user/vc/ops-tc/in-ops-glance',
  2: '/internal-user/vc/ops-tc/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops-tc/in-ops-glance?tab=history',
};

/** Mirrors php/viewtcfixturenote.php — read-only TC Fixture Note from Ops. */
export default function OpsTcFixtureNotePage() {
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = Number(searchParams.get('page') || 1);
  const backHref = appPath(BACK_BY_PAGE[page] || BACK_BY_PAGE[1]);

  const [tcOutId, setTcOutId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!comId) {
        setError('COMID is required.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await fetchOpsTcFixtureNote(comId);
        if (!cancelled) setTcOutId(data.tcOutId);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load TC Fixture Note.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [comId]);

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay active label="Loading fixture note…" />
      </div>
    );
  }

  if (error || !tcOutId) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <div className={styles.error}>{error || 'TC Fixture Note not found.'}</div>
        <Link to={backHref}>Back</Link>
      </div>
    );
  }

  return (
    <TcFixtureFormPage
      mode="view"
      overrideTcOutId={tcOutId}
      backHref={backHref}
    />
  );
}
