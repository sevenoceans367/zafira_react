import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchEstimateDetail, updateEstimateDetail } from '../../../services/estimateDetail.js';
import EstimateDetailSections from './EstimateDetailSections.jsx';
import { toFormState } from './estimateDetail.constants.js';
import styles from './UpdateEstimatePage.module.css';

const EMPTY_FORM = toFormState({});

export default function UpdateEstimatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const estimateId = searchParams.get('id');
  const estimateType = searchParams.get('estimatetype') || '2';
  const businessType = searchParams.get('selBType') || estimateType;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

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
      const data = await fetchEstimateDetail(estimateId);
      setDetail(data);
      setForm(toFormState(data));
    } catch (err) {
      setError(err.message || 'Failed to load estimate.');
    } finally {
      setLoading(false);
    }
  }, [estimateId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!estimateId) return;

    setSaving(true);
    setError('');
    try {
      await updateEstimateDetail(estimateId, {
        fixtureTypeId: form.fixtureTypeId ? Number(form.fixtureTypeId) : null,
        vesselType: form.vesselType,
        flag: form.flag,
        transDate: form.transDate,
        voyageNo: form.voyageNo,
        voyageName: form.voyageName,
        dwtSummer: form.dwtSummer,
        gnrt: form.gnrt,
      });
      navigate(`${listHref}&msg=0`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to save estimate.');
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
            onFieldChange={updateField}
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
