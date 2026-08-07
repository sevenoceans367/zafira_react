import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchAgencyLetterForm } from '../../../services/opsVc.js';
import OpsVcBackHeaderActions from './OpsVcBackHeaderActions.jsx';
import styles from './OpsPages.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

export default function OpsVcPdaFdaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';
  const tabParam = Number(searchParams.get('tab') || searchParams.get('tabs') || 0);

  const [form, setForm] = useState(null);
  const [activeKey, setActiveKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  useEffect(() => {
    if (!comId) {
      setError('COMID is required.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchAgencyLetterForm(comId);
        if (cancelled) return;
        setForm(data);
        const preferred = data.ports?.[Math.max(0, tabParam)]?.key
          || data.ports?.[0]?.key
          || '';
        setActiveKey(preferred);
      } catch (err) {
        if (!cancelled) {
          setForm(null);
          setError(err.message || 'Failed to load PDA/FDA.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [comId, tabParam]);

  const activePort = form?.ports?.find((port) => port.key === activeKey) || null;
  const nominated = Number(activePort?.letter?.status) === 2;

  const selectTab = (port, index) => {
    setActiveKey(port.key);
    const next = new URLSearchParams(searchParams);
    next.set('tab', String(index));
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <OpsVcBackHeaderActions backHref={backHref} disabled={loading} />

      <div className={`zafira-page ${styles.page}`}>
      {loading ? <LoadingOverlay show={loading} fullScreen={false} /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      {(form?.nomId || form?.vesselName) ? (
        <div className={styles.muted} style={{ marginBottom: 8 }}>
          {form?.nomId ? `Nom ID ${form.nomId}` : null}
          {form?.vesselName ? ` · ${form.vesselName}` : null}
        </div>
      ) : null}

      <h3 className={styles.title}>PDA/FDA</h3>

      {!loading && !form?.ports?.length ? (
        <div className={styles.empty}>
          No load/discharge ports found on the cost sheet
          {form?.costSheetId ? ` (sheet ${form.costSheetId}` : ''}
          {form?.legsCount != null ? `, ${form.legsCount} leg(s)` : ''}
          {form?.costSheetId ? ')' : ''}.
        </div>
      ) : null}

      {form?.ports?.length ? (
        <>
          <div className={styles.tabs}>
            {form.ports.map((port, index) => (
              <button
                key={port.key}
                type="button"
                className={port.key === activeKey ? styles.tabActive : styles.tab}
                onClick={() => selectTab(port, index)}
              >
                {port.tabLabel}
              </button>
            ))}
          </div>

          {activePort ? (
            <div className={styles.letterPanel}>
              {nominated ? (
                <>
                  <div className={styles.muted} style={{ marginBottom: 12 }}>
                    Nom ID :&nbsp;&nbsp;<strong>{form.nomId || '—'}</strong>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Vessel</th>
                          <th>Agent</th>
                          <th>Username</th>
                          <th>Password</th>
                          <th>Port Cost</th>
                          <th>Additional DA</th>
                          <th>Extra DA</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{form.vesselName || '—'}</td>
                          <td>{activePort.agentName || activePort.letter?.vendorId || '—'}</td>
                          <td>{activePort.letter?.username || '—'}</td>
                          <td>{activePort.letter?.password || '—'}</td>
                          <td>
                            <span className={styles.linkMuted} title="Port Costs (not migrated yet)">
                              Port Costs
                            </span>
                          </td>
                          <td>
                            <span className={styles.linkMuted} title="Additional DA (not migrated yet)">
                              Additional DA
                            </span>
                          </td>
                          <td>
                            <span className={styles.linkMuted} title="Extra DA (not migrated yet)">
                              Extra DA
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className={styles.empty}>
                  No nominated agent for this port. Nominate via Generate Port Related Letters.
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
    </>
  );
}
