import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, useAlert, useConfirm } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  checkVoyageNoExists,
  createEstimateDetail,
  fetchEstimateDetail,
  fetchEstimateLookups,
  fetchPeriodPrefill,
  fetchVesselEstimatePrefill,
} from '../../../services/estimateDetail.js';
import EstimateDetailSections from './EstimateDetailSections.jsx';
import EstimateDetailHeaderActions from './EstimateDetailHeaderActions.jsx';
import { applyEstimateCalculations } from './estimateCalculations.js';
import { buildEstimateSubmitPayload } from './buildEstimateSubmitPayload.js';
import { createEmptyDetail, createEmptyPortLeg, toFormState, toReplicateFormState } from './estimateDetail.constants.js';
import { applyPeriodPrefillToForm, applyVesselPrefillToForm } from './estimatePrefill.js';
import { validateEstimateForm, focusEstimateValidationField } from './estimateValidation.js';
import { sanitizeDecimalInput, sanitizeEstimatePatch, ESTIMATE_DECIMAL_FIELDS } from './estimateInputSanitize.js';
import styles from './UpdateEstimatePage.module.css';

export default function AddEstimatePage() {
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const estimateType = searchParams.get('estimatetype') || searchParams.get('selBType') || '2';
  const businessType = searchParams.get('selBType') || estimateType;
  const periodId = searchParams.get('periodid') || '';
  const coaId = searchParams.get('coaid') || searchParams.get('coaId') || '';
  const replicateFrom = searchParams.get('replicateFrom') || '';

  const [form, setForm] = useState(() => toFormState({}));
  const detail = useMemo(
    () => createEmptyDetail(form.estimateType || estimateType),
    [estimateType, form.estimateType],
  );
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
        const sourceTypeHint = estimateType;
        const [lookupData, periodData, sourceDetail] = await Promise.all([
          fetchEstimateLookups(sourceTypeHint),
          periodId ? fetchPeriodPrefill(periodId) : Promise.resolve(null),
          replicateFrom ? fetchEstimateDetail(replicateFrom) : Promise.resolve(null),
        ]);
        if (cancelled) return;

        const resolvedType = sourceDetail?.estimateType || sourceTypeHint;
        const lookupsForType = String(resolvedType) === String(sourceTypeHint)
          ? lookupData
          : await fetchEstimateLookups(resolvedType);
        if (cancelled) return;

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

        if (sourceDetail) {
          setForm(applyEstimateCalculations(toReplicateFormState(sourceDetail), nextLookups));
          return;
        }

        let vesselPrefill = null;
        if (periodData?.vesselImoId) {
          vesselPrefill = await fetchVesselEstimatePrefill(periodData.vesselImoId);
        }
        if (cancelled) return;

        setForm((current) => {
          let next = {
            ...current,
            periodId: periodId || current.periodId || '',
            portLegs: (current.portLegs || []).length ? current.portLegs : [createEmptyPortLeg()],
          };
          if (coaId) {
            const coaMatch = (lookupsForType.coaContracts || []).find(
              (item) => String(item.id) === String(coaId),
            );
            next = {
              ...next,
              coaSpot: '2',
              coaNumber: String(coaId),
              coaNumberLabel: coaMatch?.name || next.coaNumberLabel || '',
              coaNumberLift: coaMatch?.noOfShipment != null
                ? String(coaMatch.noOfShipment)
                : next.coaNumberLift || '',
            };
          }
          if (periodData) {
            next = applyPeriodPrefillToForm(next, periodData);
            next = { ...next, periodId: periodData.periodId || periodId || next.periodId };
          }
          if (vesselPrefill) {
            next = applyVesselPrefillToForm(next, vesselPrefill, {
              marketPrices: lookupsForType.marketPrices ?? {},
            });
          } else if (lookupsForType.marketPrices) {
            next = {
              ...next,
              euaPrice: next.euaPrice || lookupsForType.marketPrices.euaPrice || '',
              sdrToUsd: next.sdrToUsd || lookupsForType.marketPrices.sdrToUsd || '',
            };
          }
          return applyEstimateCalculations(next, {
            bunkerGrades: lookupsForType.bunkerGrades ?? [],
            complianceFactors: lookupsForType.complianceFactors ?? {},
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
  }, [coaId, estimateType, periodId, replicateFrom]);

  const updateField = useCallback((key, value) => {
    const next = ESTIMATE_DECIMAL_FIELDS.has(key)
      ? sanitizeDecimalInput(value)
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
        resolved = sanitizeDecimalInput(value);
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
    setError('');

    const validationError = validateEstimateForm(form);
    if (validationError) {
      await alert({ title: 'Alert', message: validationError.message, confirmLabel: 'OK' });
      focusEstimateValidationField(validationError.fieldId);
      return;
    }

    try {
      const voyageExists = await checkVoyageNoExists(form.voyageNo);
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
      await createEstimateDetail(
        buildEstimateSubmitPayload(computed, form.estimateType || estimateType, periodId),
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
      <EstimateDetailHeaderActions listHref={listHref} disabled={saving} />

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
            onPeriodContractChange={handlePeriodContractChange}
            onRecalc={handleRecalc}
            onApplyPatch={handleApplyPatch}
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
