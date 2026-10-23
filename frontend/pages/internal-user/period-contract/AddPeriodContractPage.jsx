import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, LoadingOverlay, useAlert, useConfirm } from '@bainbridge/shared-ui';
import { fetchVesselEstimatePrefill } from '../../../services/estimateDetail.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import {
  createPeriodContract,
  fetchPeriodContract,
  fetchPeriodContractLookups,
  updatePeriodContract,
} from '../../../services/periodContracts.js';
import { usePeriodContractModule } from '../../../hooks/usePeriodContractModule.js';
import {
  EMPTY_FORM,
  formFromPeriodContract,
  resolveChartererAddress,
  toCreatePayload,
} from './addPeriodContract.constants.js';
import {
  calculatePeriodSpan,
  defaultBunkerGradeId,
  periodTypeLabel,
  recalcHireAndOffHireRows,
  sumAmounts,
  withDefaultBunkerGrade,
} from './periodContractCalculations.js';
import AddPeriodContractHeaderActions from './AddPeriodContractHeaderActions.jsx';
import AddPeriodContractSections from './AddPeriodContractSections.jsx';
import styles from './AddPeriodContractPage.module.css';

export default function AddPeriodContractPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const alert = useAlert();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { periodContractPath } = usePeriodContractModule();

  const [lookups, setLookups] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [updateStatus, setUpdateStatus] = useState('1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef(null);
  const formStateRef = useRef(form);
  const selectedVesselRef = useRef({ vesselImoId: '', vesselName: '' });
  formStateRef.current = form;

  const isLocked = Number(updateStatus) > 1;
  const periodUnit = periodTypeLabel(form.periodType);
  const defaultGradeId = defaultBunkerGradeId(lookups?.bunkers);

  const deliveryBunkerTotal = useMemo(
    () => sumAmounts(form.deliveryBunkers),
    [form.deliveryBunkers],
  );

  const redeliveryBunkerTotal = useMemo(
    () => sumAmounts(form.redeliveryBunkers),
    [form.redeliveryBunkers],
  );

  const updateField = useCallback((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const updateForm = useCallback((updater) => {
    setForm((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return recalcHireAndOffHireRows(next);
    });
  }, []);

  const handleVesselSelect = useCallback(async (vessel) => {
    if (isLocked) return;
    if (!vessel) {
      selectedVesselRef.current = { vesselImoId: '', vesselName: '' };
      setForm((current) => ({
        ...current,
        vesselImoId: '',
        vesselName: '',
        vesselType: '',
        vesselTypeId: '',
      }));
      return;
    }

    const vesselImoId = String(vessel.id ?? vessel.vesselImoId ?? '').trim();
    const vesselName = vessel.vesselName || vessel.name || '';
    selectedVesselRef.current = { vesselImoId, vesselName };
    const searchType = vessel.vesselType ? String(vessel.vesselType) : '';
    const searchTypeIsId = /^\d+$/.test(searchType);
    setForm((current) => ({
      ...current,
      vesselImoId,
      vesselName,
      vesselType: searchTypeIsId ? '' : searchType,
      vesselTypeId: searchTypeIsId ? searchType : '',
    }));

    try {
      const prefill = await fetchVesselEstimatePrefill(vesselImoId);
      if (!prefill) return;
      setForm((current) => ({
        ...current,
        vesselImoId: prefill.vesselImoId || vesselImoId,
        vesselName: prefill.vesselName || vesselName,
        vesselType: prefill.vesselType || current.vesselType,
        vesselTypeId: prefill.vesselTypeId || current.vesselTypeId,
      }));
    } catch (err) {
      await alert({
        title: 'Error',
        message: err.message || 'Failed to load vessel details.',
        confirmLabel: 'OK',
      });
    }
  }, [alert, isLocked]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [lookupData, types] = await Promise.all([
        fetchPeriodContractLookups(),
        fetchVcBusinessTypes('2'),
      ]);
      setLookups(lookupData);

      const usd = lookupData.currencies?.find((item) => String(item.id).toUpperCase() === 'USD')
        || lookupData.currencies?.find((item) => /USD/i.test(item.name || ''));
      const firstPeriodType = lookupData.periodTypes?.[0]?.id || '1';

      if (isEdit) {
        const record = await fetchPeriodContract(id);
        setUpdateStatus(record.updateStatus || '1');
        setAttachments(record.attachments || []);
        setFiles([]);
        setForm(withDefaultBunkerGrade(
          recalcHireAndOffHireRows(formFromPeriodContract(record)),
          lookupData.bunkers,
        ));
      } else {
        setUpdateStatus('1');
        setAttachments([]);
        setFiles([]);
        setForm(withDefaultBunkerGrade({
          ...EMPTY_FORM,
          contractId: lookupData.contractId,
          contractNo: lookupData.contractId || EMPTY_FORM.contractNo,
          contractDate: lookupData.today || EMPTY_FORM.contractDate,
          businessType: types[0]?.id || '2',
          ownBusinessAccount: lookupData.obaVendors?.[0]?.id || '',
          currency: usd?.id || 'USD',
          periodType: firstPeriodType,
        }, lookupData.bunkers));
      }
    } catch (err) {
      setError(err.message || 'Failed to load period contract form.');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!lookups) return;
    setForm((current) => {
      if (!current.charterer) {
        return current.charterersAddress ? { ...current, charterersAddress: '' } : current;
      }
      const nextAddress = resolveChartererAddress(lookups, current.charterer);
      return current.charterersAddress === nextAddress
        ? current
        : { ...current, charterersAddress: nextAddress };
    });
  }, [lookups, form.charterer]);

  useEffect(() => {
    if (!form.deliveryDate || !form.periodType) return;
    const span = calculatePeriodSpan({
      deliveryDate: form.deliveryDate,
      reDelMinDate: form.reDelMinDate,
      reDelMaxDate: form.reDelMaxDate,
      periodType: form.periodType,
    });
    setForm((current) => {
      if (current.periodMin === span.periodMin && current.periodMax === span.periodMax) {
        return current;
      }
      return { ...current, periodMin: span.periodMin, periodMax: span.periodMax };
    });
  }, [
    form.deliveryDate,
    form.reDelMinDate,
    form.reDelMaxDate,
    form.periodType,
  ]);

  const removeAttachment = async (file) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to remove this attachment permanently?',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    setAttachments((current) => current.filter((item) => item.file !== file));
  };

  const handleSubmit = async (nextStatus) => {
    if (isLocked) return;

    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you have checked each entry?',
      confirmLabel: 'Submit',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const latest = formStateRef.current;
      const payload = toCreatePayload({
        ...latest,
        vesselImoId: latest.vesselImoId || selectedVesselRef.current.vesselImoId,
        vesselName: latest.vesselName || selectedVesselRef.current.vesselName,
      }, nextStatus);
      if (isEdit) {
        await updatePeriodContract(id, payload, {
          files,
          existingFiles: attachments.map((item) => item.file),
          existingNames: attachments.map((item) => item.name),
        });
      } else {
        await createPeriodContract(payload, files);
      }
      navigate(`${periodContractPath}?msg=0`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to save period contract.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOpen = () => {
    if (isLocked) return;
    if (formRef.current && !formRef.current.reportValidity()) return;
    handleSubmit(1);
  };

  const handleSaveClose = () => {
    if (isLocked) return;
    if (formRef.current && !formRef.current.reportValidity()) return;
    handleSubmit(2);
  };

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <AddPeriodContractHeaderActions
          listPath={periodContractPath}
          saving={saving}
          showSaveActions={!isLocked}
          onSaveOpen={handleSaveOpen}
          onSaveClose={handleSaveClose}
        />
        <LoadingOverlay active label="Loading period recap form…" />
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <AddPeriodContractHeaderActions
        listPath={periodContractPath}
        saving={saving}
        showSaveActions={!isLocked}
        onSaveOpen={handleSaveOpen}
        onSaveClose={handleSaveClose}
      />

      {error ? <div className={styles.error}>{error}</div> : null}

      <form
        ref={formRef}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          handleSaveOpen();
        }}
      >
        <AddPeriodContractSections
          form={form}
          lookups={lookups}
          periodUnit={periodUnit}
          updateField={updateField}
          updateForm={updateForm}
          setForm={setForm}
          onVesselSelect={handleVesselSelect}
          files={files}
          setFiles={setFiles}
          attachments={attachments}
          removeAttachment={removeAttachment}
          deliveryBunkerTotal={deliveryBunkerTotal}
          redeliveryBunkerTotal={redeliveryBunkerTotal}
          defaultGradeId={defaultGradeId}
          disabled={isLocked}
          footer={(
            <div className={styles.footerActions}>
              <Button variant="close" label="Cancel" to={periodContractPath} disabled={saving} />
              {!isLocked ? (
                <>
                  <Button
                    type="button"
                    variant="saveOutline"
                    label="Submit"
                    disabled={saving}
                    onClick={handleSaveOpen}
                  />
                  <Button
                    type="button"
                    variant="submit"
                    label="Submit & Close"
                    disabled={saving}
                    onClick={handleSaveClose}
                  />
                </>
              ) : null}
            </div>
          )}
        />
      </form>

      {saving ? <LoadingOverlay active label="Saving period recap…" /> : null}
    </div>
  );
}
