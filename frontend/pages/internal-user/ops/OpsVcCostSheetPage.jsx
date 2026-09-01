import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchOpsVcCostSheet } from '../../../services/opsVc.js';
import CostSheetEstimatePage from './voyage-financials/CostSheetEstimatePage.jsx';
import styles from './OpsPages.module.css';

/** PHP in_ops_at_glance page=1/2/3 → list return targets. */
const BACK_BY_PAGE = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

/**
 * Voyage Financials page (PHP cost_sheet_tci → updatecost_sheet_tci).
 * Dedicated cost-sheet form — not shared with SOPF Add/Update Estimate.
 */
export default function OpsVcCostSheetPage() {
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const costSheetId = searchParams.get('cost_sheet_id') || searchParams.get('costSheetId') || '';
  const page = Number(searchParams.get('page') || 1);
  const backPath = BACK_BY_PAGE[page] || BACK_BY_PAGE[1];
  const backHref = appPath(backPath);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);

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
        const data = await fetchOpsVcCostSheet(comId, costSheetId);
        if (cancelled) return;
        if (!data?.fcaId) {
          setError('Cost sheet estimate not found for this Voyage Financials entry.');
          setLoading(false);
          return;
        }
        setSheet(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to open Voyage Financials.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [comId, costSheetId]);

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay active label="Opening Voyage Financials…" />
      </div>
    );
  }

  if (error || !sheet?.fcaId) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <div className={styles.error}>{error || 'Voyage Financials not found.'}</div>
        <p>
          <Link to={backHref}>Back</Link>
        </p>
      </div>
    );
  }

  return (
    <CostSheetEstimatePage
      key={`${comId}-${costSheetId}-${sheet.fcaId}`}
      estimateIdProp={String(sheet.fcaId)}
      estimateTypeProp={sheet.estimateType || '2'}
      returnToProp={backPath}
      comIdProp={String(comId)}
      costSheetIdProp={String(costSheetId)}
      sheetNameProp={sheet.sheetName || ''}
      initialFinalStatus={Number(sheet.finalStatus || 0)}
    />
  );
}
