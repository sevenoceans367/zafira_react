import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, useAlert } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchEstimateDetail, fetchEstimateLookups, fetchPeriodPrefill, fetchVesselEstimatePrefill, updateEstimateDetail } from '../../../services/estimateDetail.js';
import EstimateDetailSections from './EstimateDetailSections.jsx';
import { applyEstimateCalculations } from './estimateCalculations.js';
import { buildEstimateSubmitPayload } from './buildEstimateSubmitPayload.js';
import { toFormState } from './estimateDetail.constants.js';
import { applyPeriodPrefillToForm, applyVesselPrefillToForm } from './estimatePrefill.js';
import styles from './UpdateEstimatePage.module.css';

const EMPTY_FORM = toFormState({});

export default function UpdateEstimatePage() {
  const navigate = useNavigate();
  const alert = useAlert();
  const [searchParams] = useSearchParams();
  const estimateId = searchParams.get('id');
  const estimateType = searchParams.get('estimatetype') || '2';
  const businessType = searchParams.get('selBType') || estimateType;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lookups, setLookups] = useState({
    cargos: [],
    bunkerGrades: [],
    ownerCosts: [],
    owners: [],
    complianceFactors: {},
    complianceYear: new Date().getFullYear(),
  });

  const listHref = appPath(
    `/internal-user/sopf/estimate_list?selBType=${businessType}&estimatetype=${estimateType}`,
  );

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
      setDetail(data);
      const nextLookups = {
        cargos: lookupData.cargos ?? [],
        bunkerGrades: lookupData.bunkerGrades ?? [],
        ownerCosts: lookupData.ownerCosts ?? [],
        owners: lookupData.owners ?? [],
        ownBusiness: lookupData.ownBusiness ?? [],
        charteringTeams: lookupData.charteringTeams ?? [],
        charteringPics: lookupData.charteringPics ?? [],
        periodContracts: lookupData.periodContracts ?? [],
        complianceFactors: lookupData.complianceFactors ?? {},
        complianceYear: lookupData.complianceYear || new Date().getFullYear(),
        marketPrices: lookupData.marketPrices ?? {},
      };
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

  const handleApplyPatch = useCallback((patch) => {
    setForm((current) => applyEstimateCalculations({ ...current, ...patch }, lookups));
  }, [lookups]);

  const handlePeriodContractChange = async (nextPeriodId) => {
    if (!nextPeriodId) {
      setForm((current) => applyEstimateCalculations({ ...current, periodId: '' }, lookups));
      return;
    }
    try {
      const periodData = await fetchPeriodPrefill(nextPeriodId);
      let vesselPrefill = null;
      if (periodData?.vesselImoId) {
        vesselPrefill = await fetchVesselEstimatePrefill(periodData.vesselImoId);
      }
      setForm((current) => {
        let next = { ...current, periodId: nextPeriodId };
        if (periodData) next = applyPeriodPrefillToForm(next, periodData);
        if (vesselPrefill) {
          next = applyVesselPrefillToForm(next, vesselPrefill, lookups);
        }
        return applyEstimateCalculations(next, lookups);
      });
    } catch (err) {
      await alert({
        title: 'Error',
        message: err.message || 'Failed to load period contract.',
        confirmLabel: 'OK',
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!estimateId) return;

    setSaving(true);
    setError('');
    try {
      const computed = applyEstimateCalculations(form, lookups);
      setForm(computed);
      const files = computed.attachmentFiles || [];
      await updateEstimateDetail(
        estimateId,
        buildEstimateSubmitPayload(computed, estimateType),
        files,
      );
      await alert({
        title: 'Success',
        message: 'Congratulations! Estimate updated successfully.',
        confirmLabel: 'OK',
      });
      navigate(`${listHref}&msg=0`, { replace: true });
    } catch (err) {
      const message = err.message || 'Failed to save estimate.';
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

  if (!estimateId) {
    return <p className={styles.error}>Missing estimate id.</p>;
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <LoadingOverlay show={loading || saving} />

      <div className={styles.toolbar}>
        <Button variant="outline" label="Back" href={listHref} />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {!loading && detail ? (
        <form onSubmit={handleSubmit}>
          <EstimateDetailSections
            detail={detail}
            form={form}
            lookups={lookups}
            onFieldChange={updateField}
            onPeriodContractChange={handlePeriodContractChange}
            onRecalc={handleRecalc}
            onApplyPatch={handleApplyPatch}
          />
          <div className={styles.actions}>
            <Button type="submit" variant="primary" label="Submit" disabled={saving} />
            <Button variant="outline" label="Cancel" href={listHref} />
          </div>
        </form>
      ) : null}

      {loading ? <p className={styles.loading}>Loading estimate...</p> : null}
    </div>
  );
}
