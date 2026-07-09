import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { createEstimateDetail } from '../../../services/estimateDetail.js';
import EstimateDetailSections from './EstimateDetailSections.jsx';
import { createEmptyDetail, toFormState } from './estimateDetail.constants.js';
import styles from './UpdateEstimatePage.module.css';

export default function AddEstimatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const estimateType = searchParams.get('estimatetype') || searchParams.get('selBType') || '2';
  const businessType = searchParams.get('selBType') || estimateType;
  const periodId = searchParams.get('periodid') || '';

  const detail = useMemo(() => createEmptyDetail(estimateType), [estimateType]);
  const [form, setForm] = useState(() => toFormState({}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const listHref = appPath(
    `/internal-user/sopf/estimate_list?selBType=${businessType}&estimatetype=${estimateType}`,
  );

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleVesselSelect = (vessel) => {
    if (!vessel) {
      setForm((current) => ({
        ...current,
        vesselImoId: '',
        vesselName: '',
        vesselType: '',
        flag: '',
        dwtSummer: '',
        gnrt: '',
        loa: '',
        tpc: '',
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      vesselImoId: vessel.id,
      vesselName: vessel.vesselName,
      vesselType: String(vessel.vesselType ?? ''),
      flag: String(vessel.flag ?? ''),
      dwtSummer: vessel.dwt ? String(vessel.dwt) : '',
      gnrt: vessel.gnrt ? String(vessel.gnrt) : '',
      loa: vessel.loa ? String(vessel.loa) : '',
      tpc: '',
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await createEstimateDetail({
        fixtureTypeId: form.fixtureTypeId ? Number(form.fixtureTypeId) : null,
        vesselImoId: form.vesselImoId ? Number(form.vesselImoId) : null,
        estimateType: Number(estimateType),
        periodId: periodId || null,
        vesselType: form.vesselType,
        flag: form.flag,
        transDate: form.transDate,
        voyageNo: form.voyageNo,
        voyageName: form.voyageName || form.voyageNo,
        dwtSummer: form.dwtSummer,
        gnrt: form.gnrt,
        loa: form.loa,
        tpc: form.tpc,
      });
      navigate(`${listHref}&msg=0`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to create estimate.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      <LoadingOverlay show={saving} />

      <div className={styles.toolbar}>
        <Button variant="outline" label="Back" href={listHref} />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <form onSubmit={handleSubmit}>
        <EstimateDetailSections
          detail={detail}
          form={form}
          isAdd
          onFieldChange={updateField}
          onVesselSelect={handleVesselSelect}
        />
        <div className={styles.actions}>
          <Button type="submit" variant="primary" label="Submit" disabled={saving} />
          <Button variant="outline" label="Cancel" href={listHref} />
        </div>
      </form>
    </div>
  );
}
