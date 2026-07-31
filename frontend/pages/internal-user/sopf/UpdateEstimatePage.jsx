import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, useAlert, useConfirm } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  checkVoyageNoExists,
  fetchEstimateDetail,
  fetchEstimateLookups,
  fetchPeriodPrefill,
  fetchVesselEstimatePrefill,
  updateEstimateDetail,
} from '../../../services/estimateDetail.js';
import EstimateDetailSections from './EstimateDetailSections.jsx';
import EstimateDetailHeaderActions from './EstimateDetailHeaderActions.jsx';
import { applyEstimateCalculations } from './estimateCalculations.js';
import { buildEstimateSubmitPayload } from './buildEstimateSubmitPayload.js';
import { toFormState } from './estimateDetail.constants.js';
import { applyPeriodPrefillToForm, applyVesselPrefillToForm } from './estimatePrefill.js';
import { validateEstimateForm, focusEstimateValidationField } from './estimateValidation.js';
import { sanitizeFieldDecimal, sanitizeEstimatePatch, ESTIMATE_DECIMAL_FIELDS } from './estimateInputSanitize.js';
import styles from './UpdateEstimatePage.module.css';

const EMPTY_FORM = toFormState({});

export default function UpdateEstimatePage() {
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
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
      const resolvedType = data?.estimateType || estimateType;
      const lookupsForType = String(resolvedType) === String(estimateType)
        ? lookupData
        : await fetchEstimateLookups(resolvedType);
      setDetail(data);
      const nextLookups = {
        cargos: lookupsForType.cargos ?? [],
        bunkerGrades: lookupsForType.bunkerGrades ?? [],
        ownerCosts: lookupsForType.ownerCosts ?? [],
        owners: lookupsForType.owners ?? [],
        ownBusiness: lookupsForType.ownBusiness ?? [],
        charteringTeams: lookupsForType.charteringTeams ?? [],
        charteringPics: lookupsForType.charteringPics ?? [],
        periodContracts: lookupsForType.periodContracts ?? [],
        zones: lookupsForType.zones ?? [],
        fixtureBrokers: lookupsForType.fixtureBrokers ?? [],
        coaContracts: lookupsForType.coaContracts ?? [],
        complianceFactors: lookupsForType.complianceFactors ?? {},
        complianceYear: lookupsForType.complianceYear || new Date().getFullYear(),
        marketPrices: lookupsForType.marketPrices ?? {},
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
    const next = ESTIMATE_DECIMAL_FIELDS.has(key)
      ? sanitizeFieldDecimal(key, value)
      : value;
    setForm((current) => ({ ...current, [key]: next }));
  }, []);

  const handleRecalc = useCallback((key, value) => {
    setForm((current) => {
      let resolved = value;
      if (
        key
        && value !== undefined
        && !Array.isArray(value)
        && typeof value !== 'object'
        && typeof value !== 'boolean'
        && ESTIMATE_DECIMAL_FIELDS.has(key)
      ) {
        resolved = sanitizeFieldDecimal(key, value);
      }
      const next = key && resolved !== undefined && !Array.isArray(resolved) && typeof resolved !== 'object'
        ? { ...current, [key]: resolved }
        : key && Array.isArray(resolved)
          ? { ...current, [key]: resolved }
          : key && typeof resolved === 'boolean'
            ? { ...current, [key]: resolved }
            : { ...current };
      return applyEstimateCalculations(next, lookups);
    });
  }, [lookups]);

  const handleApplyPatch = useCallback((patch) => {
    setForm((current) => applyEstimateCalculations(
      { ...current, ...sanitizeEstimatePatch(patch) },
      lookups,
    ));
  }, [lookups]);

  const handleVesselSelect = async (vessel) => {
    if (!vessel) {
      setForm((current) => applyEstimateCalculations({
        ...current,
        vesselImoId: '',
        vesselName: '',
        vesselType: '',
        flag: '',
        dwtSummer: '',
        dwtTropical: '',
        gnrt: '',
        nrt: '',
        loa: '',
        beam: '',
        gear: '',
        builtYear: '',
        tpc: '',
        grainCap: '',
        baleCap: '',
        loadable: '',
        bFullSpeed: '',
        bEcoSpeed1: '',
        lFullSpeed: '',
        lEcoSpeed1: '',
        bFoFullSpeed: '',
        lFoFullSpeed: '',
        bDoFullSpeed: '',
        lDoFullSpeed: '',
        pIfoFullSpeed: '',
        pWfoFullSpeed: '',
        pIdoFullSpeed: '',
        pWdoFullSpeed: '',
      }, lookups));
      return;
    }

    try {
      const prefill = await fetchVesselEstimatePrefill(vessel.id);
      if (!prefill) {
        setForm((current) => applyEstimateCalculations({
          ...current,
          vesselImoId: vessel.id,
          vesselName: vessel.vesselName || vessel.name || '',
          vesselType: String(vessel.vesselType ?? ''),
          flag: String(vessel.flag ?? ''),
          dwtSummer: vessel.dwt ? String(vessel.dwt) : '',
          gnrt: vessel.gnrt ? String(vessel.gnrt) : '',
          loa: vessel.loa ? String(vessel.loa) : '',
        }, lookups));
        return;
      }

      if (!prefill.hasCommercialParameters) {
        await alert({
          title: 'Alert',
          message: 'Please ensure commercial parameters are completed before proceeding.',
          confirmLabel: 'OK',
        });
      }

      setForm((current) => applyEstimateCalculations(
        applyVesselPrefillToForm(current, prefill, lookups),
        lookups,
      ));
    } catch (err) {
      await alert({
        title: 'Error',
        message: err.message || 'Failed to load vessel fleet details.',
        confirmLabel: 'OK',
      });
    }
  };

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
    setError('');

    const validationError = validateEstimateForm(form);
    if (validationError) {
      await alert({ title: 'Missing Information', message: validationError.message, confirmLabel: 'OK' });
      focusEstimateValidationField(validationError.fieldId);
      return;
    }

    try {
      const voyageExists = await checkVoyageNoExists(form.voyageNo, { excludeId: estimateId });
      if (voyageExists) {
        await alert({
          title: 'Alert',
          message: 'Voyage number already exists',
          confirmLabel: 'OK',
        });
        focusEstimateValidationField('voyageNo');
        return;
      }
    } catch (err) {
      await alert({
        title: 'Error',
        message: err.message || 'Failed to check voyage number.',
        confirmLabel: 'OK',
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you have checked each entry ?',
      confirmLabel: 'OK',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    setSaving(true);
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
      <EstimateDetailHeaderActions listHref={listHref} disabled={saving} />

      {error ? <p className={styles.error}>{error}</p> : null}

      {!loading && detail ? (
        <form onSubmit={handleSubmit}>
          <EstimateDetailSections
            detail={detail}
            form={form}
            lookups={lookups}
            voyageExcludeId={estimateId}
            onFieldChange={updateField}
            onVesselSelect={handleVesselSelect}
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
