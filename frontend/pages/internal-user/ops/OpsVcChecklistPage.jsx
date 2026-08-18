import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchOpsChecklist } from '../../../services/opsVc.js';
import OpsVcBackHeaderActions from './OpsVcBackHeaderActions.jsx';
import OpsChecklistTimeline from './OpsChecklistTimeline.jsx';
import styles from './OpsPages.module.css';

const BACK_BY_PAGE = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

function ReadField({ label, value }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <div className={styles.fieldRead}>{value || '—'}</div>
    </div>
  );
}

export default function OpsVcChecklistPage() {
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = Number(searchParams.get('page') || 1);
  const backHref = appPath(BACK_BY_PAGE[page] || BACK_BY_PAGE[1]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!comId) {
      setError('Missing comid.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setData(await fetchOpsChecklist(comId, 'vc'));
    } catch (err) {
      setError(err.message || 'Failed to load Ops Checklist.');
    } finally {
      setLoading(false);
    }
  }, [comId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <OpsVcBackHeaderActions backHref={backHref} />
        <LoadingOverlay active label="Loading Ops Checklist…" />
        {error ? <div className={styles.error}>{error}</div> : null}
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <OpsVcBackHeaderActions backHref={backHref} />
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Fixture</h4>
        <div className={styles.formGrid}>
          <ReadField label="Vessel" value={data.fixture?.vesselName || data.vessel} />
          <ReadField label="Voy No." value={data.fixture?.voyageNo || data.voy} />
          <ReadField label="CP Date" value={data.fixture?.cpDate || data.cpDate} />
          <ReadField label="Load port" value={data.fixture?.loadPort} />
          <ReadField label="Discharge port" value={data.fixture?.dischargePort} />
        </div>
      </div>

      <OpsChecklistTimeline
        steps={data.steps || []}
        wipId={data.wipId}
        statusLabel={data.statusLabel}
      />
    </div>
  );
}
