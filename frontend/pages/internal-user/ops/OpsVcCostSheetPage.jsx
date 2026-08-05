import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchOpsVcCostSheet } from '../../../services/opsVc.js';
import styles from './OpsPages.module.css';

/** PHP in_ops_at_glance page=1/2/3 → list return targets. */
const BACK_BY_PAGE = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

/**
 * Voyage Financials gateway (PHP cost_sheet_tci → updatecost_sheet_tci).
 * Resolves COMID + COST_SHEETID → FCAID, then opens SOPF Update Estimate.
 */
export default function OpsVcCostSheetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const costSheetId = searchParams.get('cost_sheet_id') || searchParams.get('costSheetId') || '';
  const page = Number(searchParams.get('page') || 1);
  const backPath = BACK_BY_PAGE[page] || BACK_BY_PAGE[1];
  const backHref = appPath(backPath);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!comId || !costSheetId) {
        setError('COMID and cost sheet id are required.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const sheet = await fetchOpsVcCostSheet(comId, costSheetId);
        if (cancelled) return;
        if (!sheet?.fcaId) {
          setError('Cost sheet estimate not found for this Voyage Financials entry.');
          setLoading(false);
          return;
        }
        const estimateType = sheet.estimateType || '2';
        const returnTo = encodeURIComponent(backPath);
        navigate(
          appPath(
            `/internal-user/sopf/updateestimate?id=${encodeURIComponent(sheet.fcaId)}`
            + `&estimatetype=${encodeURIComponent(estimateType)}`
            + `&selBType=${encodeURIComponent(estimateType)}`
            + `&returnTo=${returnTo}`
            + `&comid=${encodeURIComponent(comId)}`
            + `&cost_sheet_id=${encodeURIComponent(costSheetId)}`
            + `&page=${encodeURIComponent(String(page))}`,
          ),
          { replace: true },
        );
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to open Voyage Financials.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [backHref, backPath, comId, costSheetId, navigate, page]);

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay active label="Opening Voyage Financials…" />
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <div className={styles.error}>{error || 'Voyage Financials not found.'}</div>
      <p>
        <Link to={backHref}>Back</Link>
      </p>
    </div>
  );
}
