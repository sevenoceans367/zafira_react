import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchOpsVcCostSheetIn } from '../../../services/opsVc.js';
import CostSheetEstimatePage from './voyage-financials/CostSheetEstimatePage.jsx';
import styles from './OpsPages.module.css';

/** PHP in_ops_at_glance page=1/2/3 → list return targets. */
const BACK_BY_PAGE = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

/**
 * VC-In worksheet (PHP updatecost_sheet_tci_in).
 * Same form as Voyage Worksheet, bound to freight_cost_estimete_in_* .
 */
export default function OpsVcCostSheetInPage() {
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || searchParams.get('id') || '';
  const costSheetId = searchParams.get('cost_sheet_id') || searchParams.get('costSheetId') || '';
  const page = Number(searchParams.get('page') || 1);
  const viewOnly = searchParams.get('view') === '1';
  const backPath = costSheetId
    ? `/internal-user/vc/ops/cost-sheet?comid=${encodeURIComponent(comId)}&cost_sheet_id=${encodeURIComponent(costSheetId)}&page=${page}`
    : (BACK_BY_PAGE[page] || BACK_BY_PAGE[1]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);

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
        const data = await fetchOpsVcCostSheetIn(comId);
        if (cancelled) return;
        if (!data?.fcaId) {
          setError('VC-In worksheet not found for this voyage.');
          setLoading(false);
          return;
        }
        setSheet(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to open VC-In worksheet.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [comId]);

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay active label="Opening VC-In worksheet…" />
      </div>
    );
  }

  if (error || !sheet?.fcaId) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <div className={styles.error}>{error || 'VC-In worksheet not found.'}</div>
        <p>
          <Link to={appPath(backPath)}>Back</Link>
        </p>
      </div>
    );
  }

  return (
    <CostSheetEstimatePage
      key={`vc-in-${comId}-${sheet.fcaId}`}
      estimateIdProp={String(sheet.fcaId)}
      estimateTypeProp={sheet.estimateType || '2'}
      returnToProp={backPath}
      comIdProp={String(comId)}
      sheetNameProp="VC-In"
      initialFinalStatus={Number(sheet.finalStatus || 0)}
      viewOnly={viewOnly}
      variant="vc-in"
    />
  );
}
