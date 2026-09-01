import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchEstimateDetail, fetchEstimateLookups } from '../../../services/estimateDetail.js';
import EstimateDetailSections from './EstimateDetailSections.jsx';
import EstimateDetailHeaderActions from './EstimateDetailHeaderActions.jsx';
import { applyEstimateCalculations } from './estimateCalculations.js';
import { toFormState } from './estimateDetail.constants.js';
import styles from './UpdateEstimatePage.module.css';

/** PHP viewestimate.php $redirect from rttype (in_ops / post_ops / history). */
const RTTYPE_BACK = {
  1: '/internal-user/vc/ops/in-ops-glance',
  3: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  4: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

function resolveViewEstimateBackHref(searchParams, { businessType, estimateType }) {
  const returnToRaw = searchParams.get('returnTo') || '';
  if (returnToRaw) {
    try {
      const decoded = decodeURIComponent(returnToRaw);
      if (decoded.startsWith('/internal-user/')) return appPath(decoded);
    } catch {
      /* ignore bad returnTo */
    }
  }
  const opsBack = RTTYPE_BACK[String(searchParams.get('rttype') || '')];
  if (opsBack) return appPath(opsBack);
  return appPath(
    `/internal-user/sopf/estimate_list?selBType=${businessType}&estimatetype=${estimateType}`,
  );
}

export default function ViewEstimatePage() {
  const [searchParams] = useSearchParams();
  const estimateId = searchParams.get('id');
  const estimateType = searchParams.get('estimatetype') || searchParams.get('selBType') || '2';
  const businessType = searchParams.get('selBType') || estimateType;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(toFormState({}));
  const [lookups, setLookups] = useState({
    cargos: [],
    bunkerGrades: [],
    ownerCosts: [],
    owners: [],
    complianceFactors: {},
    complianceYear: new Date().getFullYear(),
  });

  const listHref = resolveViewEstimateBackHref(searchParams, { businessType, estimateType });

  const loadDetail = useCallback(async () => {
    if (!estimateId) {
      setError('Missing estimate id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [data, lookupData] = await Promise.all([
        fetchEstimateDetail(estimateId),
        fetchEstimateLookups(estimateType),
      ]);
      const resolvedType = data?.estimateType || estimateType;
      const lookupsForType = String(resolvedType) === String(estimateType)
        ? lookupData
        : await fetchEstimateLookups(resolvedType);
      const nextLookups = {
        cargos: lookupsForType.cargos ?? [],
        bunkerGrades: lookupsForType.bunkerGrades ?? [],
        ownerCosts: lookupsForType.ownerCosts ?? [],
        owners: lookupsForType.owners ?? [],
        charteringTeams: lookupsForType.charteringTeams ?? [],
        charteringPics: lookupsForType.charteringPics ?? [],
        complianceFactors: lookupsForType.complianceFactors ?? {},
        complianceYear: lookupsForType.complianceYear || new Date().getFullYear(),
      };
      setDetail(data);
      setLookups(nextLookups);
      setForm(applyEstimateCalculations(toFormState(data), nextLookups));
    } catch (err) {
      setError(err.message || 'Failed to load estimate.');
    } finally {
      setLoading(false);
    }
  }, [estimateId, estimateType]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (!estimateId) {
    return <p className={styles.error}>Missing estimate id.</p>;
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <LoadingOverlay show={loading} />
      <EstimateDetailHeaderActions listHref={listHref} />

      {error ? <p className={styles.error}>{error}</p> : null}

      {!loading && detail ? (
        <div>
          <EstimateDetailSections detail={detail} form={form} readOnly lookups={lookups} />
          <div className={styles.actions}>
            <Button variant="outline" label="Back to List" href={listHref} />
          </div>
        </div>
      ) : null}

      {loading ? <p className={styles.loading}>Loading estimate...</p> : null}
    </div>
  );
}
