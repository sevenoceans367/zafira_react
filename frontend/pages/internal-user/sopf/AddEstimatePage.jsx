import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, useAlert } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  createEstimateDetail,
  fetchEstimateLookups,
  fetchPeriodPrefill,
} from '../../../services/estimateDetail.js';
import EstimateDetailSections from './EstimateDetailSections.jsx';
import { applyEstimateCalculations } from './estimateCalculations.js';
import { buildEstimateSubmitPayload } from './buildEstimateSubmitPayload.js';
import { createEmptyDetail, toFormState } from './estimateDetail.constants.js';
import styles from './UpdateEstimatePage.module.css';

export default function AddEstimatePage() {
  const navigate = useNavigate();
  const alert = useAlert();
  const [searchParams] = useSearchParams();
  const estimateType = searchParams.get('estimatetype') || searchParams.get('selBType') || '2';
  const businessType = searchParams.get('selBType') || estimateType;
  const periodId = searchParams.get('periodid') || '';

  const detail = useMemo(() => createEmptyDetail(estimateType), [estimateType]);
  const [form, setForm] = useState(() => toFormState({}));
  const [lookups, setLookups] = useState({
    cargos: [],
    bunkerGrades: [],
    ownerCosts: [],
    owners: [],
    complianceFactors: {},
    complianceYear: new Date().getFullYear(),
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const listHref = appPath(
    `/internal-user/sopf/estimate_list?selBType=${businessType}&estimatetype=${estimateType}`,
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError('');
      try {
        const [lookupData, periodData] = await Promise.all([
          fetchEstimateLookups(estimateType),
          periodId ? fetchPeriodPrefill(periodId) : Promise.resolve(null),
        ]);
        if (cancelled) return;

        setLookups({
          cargos: lookupData.cargos ?? [],
          bunkerGrades: lookupData.bunkerGrades ?? [],
          ownerCosts: lookupData.ownerCosts ?? [],
          owners: lookupData.owners ?? [],
          complianceFactors: lookupData.complianceFactors ?? {},
          complianceYear: lookupData.complianceYear || new Date().getFullYear(),
        });

        setForm((current) => {
          let next = { ...current };
          if (periodData) {
            next = {
              ...next,
              brokeragePercent: periodData.brokeragePercent || next.brokeragePercent,
              addCommPercent: periodData.addCommPercent || next.addCommPercent,
              hireRate: periodData.hireRate || next.hireRate,
            };
          }
          return applyEstimateCalculations(next, {
            bunkerGrades: lookupData.bunkerGrades ?? [],
            complianceFactors: lookupData.complianceFactors ?? {},
          });
        });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load estimate form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [estimateType, periodId]);

  const updateField = useCallback((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const handleRecalc = useCallback((key, value) => {
    setForm((current) => {
      const next = key && value !== undefined && !Array.isArray(value) && typeof value !== 'object'
        ? { ...current, [key]: value }
        : key && Array.isArray(value)
          ? { ...current, [key]: value }
          : key && typeof value === 'boolean'
            ? { ...current, [key]: value }
            : { ...current };
      return applyEstimateCalculations(next, lookups);
    });
  }, [lookups]);

  const handleVesselSelect = (vessel) => {
    if (!vessel) {
      setForm((current) => applyEstimateCalculations({
        ...current,
        vesselImoId: '',
        vesselName: '',
        vesselType: '',
        flag: '',
        dwtSummer: '',
        gnrt: '',
        loa: '',
        tpc: '',
      }, lookups));
      return;
    }

    setForm((current) => applyEstimateCalculations({
      ...current,
      vesselImoId: vessel.id,
      vesselName: vessel.vesselName,
      vesselType: String(vessel.vesselType ?? ''),
      flag: String(vessel.flag ?? ''),
      dwtSummer: vessel.dwt ? String(vessel.dwt) : '',
      gnrt: vessel.gnrt ? String(vessel.gnrt) : '',
      loa: vessel.loa ? String(vessel.loa) : '',
      tpc: current.tpc || '',
    }, lookups));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const computed = applyEstimateCalculations(form, lookups);
      setForm(computed);
      const files = computed.attachmentFiles || [];
      await createEstimateDetail(
        buildEstimateSubmitPayload(computed, estimateType, periodId),
        files,
      );
      await alert({
        title: 'Success',
        message: 'Congratulations! Estimate added successfully.',
        confirmLabel: 'OK',
      });
      navigate(`${listHref}&msg=0`, { replace: true });
    } catch (err) {
      const message = err.message || 'Failed to create estimate.';
      setError(message);
      await alert({
        title: 'Error',
        message,
        confirmLabel: 'OK',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      <LoadingOverlay show={saving || loading} />

      <div className={styles.toolbar}>
        <Button variant="outline" label="Back" href={listHref} />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {!loading ? (
        <form onSubmit={handleSubmit}>
          <EstimateDetailSections
            detail={detail}
            form={form}
            isAdd
            lookups={lookups}
            onFieldChange={updateField}
            onVesselSelect={handleVesselSelect}
            onRecalc={handleRecalc}
          />
          <div className={styles.actions}>
            <Button type="submit" variant="primary" label="Submit" disabled={saving} />
            <Button variant="outline" label="Cancel" href={listHref} />
          </div>
        </form>
      ) : (
        <p className={styles.loading}>Loading estimate form…</p>
      )}
    </div>
  );
}
