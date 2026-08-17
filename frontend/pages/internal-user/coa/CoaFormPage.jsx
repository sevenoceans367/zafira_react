import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, DmyDateInput, LoadingOverlay } from '@bainbridge/shared-ui';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import { useCoaModule } from '../../../hooks/useCoaModule.js';
import {
  createCoa,
  fetchCoa,
  fetchCoaLookups,
  saveCoaMonthlyRemarks,
  updateCoa,
} from '../../../services/coas.js';
import CoaCardSelect from './CoaCardSelect.jsx';
import CoaFormHeaderActions from './CoaFormHeaderActions.jsx';
import styles from './CoaPages.module.css';

function emptyForm(businessTypeId = '2', nextCoaId = '') {
  return {
    coaIdentity: nextCoaId,
    messageNo: '',
    coaNo: '',
    coaDate: '',
    charterer: '',
    owner: '',
    coaRoute: '',
    totalShipments: '',
    broker: '',
    vesselType: '',
    loadOptions: '',
    cargo: '',
    tolerance: '',
    coaNotice: '',
    minGuaranteedQty: '',
    lpEtaNotices: '',
    vesselSubstitute: '1',
    duration: '',
    startDate: '',
    endDate: '',
    freightDetails: '',
    lpDetails: '',
    dpDetails: '',
    demmLaytime: '',
    remarks: '',
    updateStatus: '1',
    currency: 'USD',
    businessTypeId,
    foPrice: '',
    bafAmt: '',
    attachment: '',
    attachmentName: '',
    exclusions: [{ minGuaranteed: '', exPort: '' }],
    monthlyRemarks: [{ remarkDate: '', remarks: '' }],
  };
}

function Field({ id, label, children, wide = false }) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export default function CoaFormPage({ mode = 'edit' }) {
  const { coaId } = useParams();
  const navigate = useNavigate();
  const { coaPath } = useCoaModule();
  const [searchParams] = useSearchParams();
  const isAdd = mode === 'add' || !coaId;
  const [lookups, setLookups] = useState(null);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [form, setForm] = useState(() => emptyForm(searchParams.get('selBType') || '2'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [lookupData, types] = await Promise.all([
          fetchCoaLookups(),
          fetchVcBusinessTypes(searchParams.get('selBType') || '2'),
        ]);
        if (cancelled) return;
        setLookups(lookupData);
        setBusinessTypes(types);
        if (isAdd) {
          setForm(emptyForm(searchParams.get('selBType') || '2', lookupData.nextCoaId));
        } else {
          const detail = await fetchCoa(coaId);
          if (cancelled) return;
          if (!detail) throw new Error('COA not found.');
          setForm({
            ...emptyForm(detail.businessTypeId),
            ...detail,
            exclusions: detail.exclusions?.length
              ? detail.exclusions
              : [{ minGuaranteed: '', exPort: '' }],
            monthlyRemarks: detail.monthlyRemarks?.length
              ? detail.monthlyRemarks
              : [{ remarkDate: '', remarks: '' }],
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load COA form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [coaId, isAdd, searchParams]);

  const vesselTypes = useMemo(() => {
    const all = lookups?.vesselTypes || [];
    return all.filter((item) => !item.businessTypeId || item.businessTypeId === form.businessTypeId);
  }, [form.businessTypeId, lookups]);

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.coaIdentity?.trim()) {
      setError('COA ID is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        exclusions: (form.exclusions || []).filter((row) => row.minGuaranteed || row.exPort),
      };
      const result = isAdd
        ? await createCoa(payload)
        : await updateCoa(coaId, payload);
      const id = result.coaId || coaId;
      await saveCoaMonthlyRemarks(
        id,
        (form.monthlyRemarks || []).filter((row) => row.remarkDate || row.remarks),
      );
      navigate(`${coaPath('running')}?selBType=${form.businessTypeId}&msg=0`);
    } catch (err) {
      setError(err.message || 'Failed to save COA.');
    } finally {
      setSaving(false);
    }
  };

  const listHref = `${coaPath('running')}?selBType=${form.businessTypeId || '2'}`;

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay active label="Loading COA…" />
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <CoaFormHeaderActions listHref={listHref} disabled={saving} />
      {saving ? <LoadingOverlay active label="Saving COA…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <form onSubmit={handleSave}>
        <div className={styles.formGrid}>
          <Field id="coaIdentity" label="COA ID">
            <input id="coaIdentity" value={form.coaIdentity} onChange={(e) => patch('coaIdentity', e.target.value)} required />
          </Field>
          <Field id="coaNo" label="COA No.">
            <input id="coaNo" value={form.coaNo} onChange={(e) => patch('coaNo', e.target.value)} />
          </Field>
          <Field id="coaDate" label="COA Date">
            <DmyDateInput
              id="coaDate"
              value={form.coaDate || ''}
              onChange={(value) => patch('coaDate', value)}
            />
          </Field>
          <Field id="businessTypeId" label="Business Type">
            <CoaCardSelect
              label="Business Type"
              value={form.businessTypeId}
              options={businessTypes}
              includeEmpty={false}
              onChange={(value) => patch('businessTypeId', value)}
            />
          </Field>
          <Field id="coaRoute" label="COA Route">
            <CoaCardSelect
              label="COA Route"
              value={form.coaRoute}
              options={lookups?.routes || []}
              onChange={(value) => patch('coaRoute', value)}
            />
          </Field>
          <Field id="charterer" label="Charterer">
            <CoaCardSelect
              label="Charterer"
              value={form.charterer}
              options={lookups?.charterers || []}
              onChange={(value) => patch('charterer', value)}
            />
          </Field>
          <Field id="owner" label="Owner">
            <CoaCardSelect
              label="Owner"
              value={form.owner}
              options={lookups?.owners || []}
              onChange={(value) => patch('owner', value)}
            />
          </Field>
          <Field id="broker" label="Broker">
            <CoaCardSelect
              label="Broker"
              value={form.broker}
              options={lookups?.brokers || []}
              onChange={(value) => patch('broker', value)}
            />
          </Field>
          <Field id="vesselType" label="Vessel Type">
            <CoaCardSelect
              label="Vessel Type"
              value={form.vesselType}
              options={vesselTypes}
              onChange={(value) => patch('vesselType', value)}
            />
          </Field>
          <Field id="cargo" label="Cargo">
            <CoaCardSelect
              label="Cargo"
              value={form.cargo}
              options={lookups?.cargos || []}
              onChange={(value) => patch('cargo', value)}
            />
          </Field>
          <Field id="loadOptions" label="Load Options">
            <CoaCardSelect
              label="Load Options"
              value={form.loadOptions}
              options={lookups?.loadOptions || []}
              onChange={(value) => patch('loadOptions', value)}
            />
          </Field>
          <Field id="totalShipments" label="Total Shipments">
            <input id="totalShipments" value={form.totalShipments} onChange={(e) => patch('totalShipments', e.target.value)} />
          </Field>
          <Field id="minGuaranteedQty" label="Min Guaranteed Qty (MT)">
            <input id="minGuaranteedQty" value={form.minGuaranteedQty} onChange={(e) => patch('minGuaranteedQty', e.target.value)} />
          </Field>
          <Field id="tolerance" label="Tolerance">
            <input id="tolerance" value={form.tolerance} onChange={(e) => patch('tolerance', e.target.value)} />
          </Field>
          <Field id="duration" label="COA Duration">
            <input id="duration" value={form.duration} onChange={(e) => patch('duration', e.target.value)} />
          </Field>
          <Field id="startDate" label="Start Date">
            <DmyDateInput
              id="startDate"
              value={form.startDate || ''}
              onChange={(value) => patch('startDate', value)}
            />
          </Field>
          <Field id="endDate" label="End Date">
            <DmyDateInput
              id="endDate"
              value={form.endDate || ''}
              onChange={(value) => patch('endDate', value)}
            />
          </Field>
          <Field id="coaNotice" label="COA Notice Days">
            <input id="coaNotice" value={form.coaNotice} onChange={(e) => patch('coaNotice', e.target.value)} />
          </Field>
          <Field id="lpEtaNotices" label="LP ETA Notices">
            <input id="lpEtaNotices" value={form.lpEtaNotices} onChange={(e) => patch('lpEtaNotices', e.target.value)} />
          </Field>
          <Field id="vesselSubstitute" label="Vessel Substitute">
            <CoaCardSelect
              label="Vessel Substitute"
              value={form.vesselSubstitute}
              options={lookups?.vesselSubstitutes || []}
              includeEmpty={false}
              onChange={(value) => patch('vesselSubstitute', value)}
            />
          </Field>
          <Field id="currency" label="Currency">
            <CoaCardSelect
              label="Currency"
              value={form.currency}
              options={lookups?.currencies || []}
              includeEmpty={false}
              onChange={(value) => patch('currency', value)}
            />
          </Field>
          <Field id="foPrice" label="FO Price">
            <input id="foPrice" value={form.foPrice} onChange={(e) => patch('foPrice', e.target.value)} />
          </Field>
          <Field id="bafAmt" label="BAF Amt">
            <input id="bafAmt" value={form.bafAmt} onChange={(e) => patch('bafAmt', e.target.value)} />
          </Field>
          <Field id="freightDetails" label="Freight Details" wide>
            <textarea id="freightDetails" value={form.freightDetails} onChange={(e) => patch('freightDetails', e.target.value)} />
          </Field>
          <Field id="lpDetails" label="LP Details" wide>
            <textarea id="lpDetails" value={form.lpDetails} onChange={(e) => patch('lpDetails', e.target.value)} />
          </Field>
          <Field id="dpDetails" label="DP Details" wide>
            <textarea id="dpDetails" value={form.dpDetails} onChange={(e) => patch('dpDetails', e.target.value)} />
          </Field>
          <Field id="demmLaytime" label="Demurrage / Laytime" wide>
            <textarea id="demmLaytime" value={form.demmLaytime} onChange={(e) => patch('demmLaytime', e.target.value)} />
          </Field>
          <Field id="remarks" label="Remarks" wide>
            <textarea id="remarks" value={form.remarks} onChange={(e) => patch('remarks', e.target.value)} />
          </Field>
        </div>

        <div className={styles.sectionTitle}>Exclusion Ports / Min Guaranteed</div>
        <table className={styles.nestedTable}>
          <thead>
            <tr>
              <th>Min Guaranteed</th>
              <th>Ex Port</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(form.exclusions || []).map((row, index) => (
              <tr key={`ex-${index}`}>
                <td>
                  <input
                    value={row.minGuaranteed}
                    onChange={(e) => {
                      const next = [...form.exclusions];
                      next[index] = { ...next[index], minGuaranteed: e.target.value };
                      patch('exclusions', next);
                    }}
                  />
                </td>
                <td>
                  <input
                    value={row.exPort}
                    onChange={(e) => {
                      const next = [...form.exclusions];
                      next[index] = { ...next[index], exPort: e.target.value };
                      patch('exclusions', next);
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.actionIcon}
                    onClick={() => patch('exclusions', form.exclusions.filter((_, i) => i !== index))}
                  >
                    <i className="bi bi-trash" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button
          variant="outline"
          size="sm"
          label="Add Exclusion"
          onClick={() => patch('exclusions', [...(form.exclusions || []), { minGuaranteed: '', exPort: '' }])}
        />

        <div className={styles.sectionTitle}>Monthly Remarks</div>
        <table className={styles.nestedTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Remarks</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(form.monthlyRemarks || []).map((row, index) => (
              <tr key={`mr-${index}`}>
                <td>
                  <DmyDateInput
                    value={row.remarkDate || ''}
                    onChange={(value) => {
                      const next = [...form.monthlyRemarks];
                      next[index] = { ...next[index], remarkDate: value };
                      patch('monthlyRemarks', next);
                    }}
                  />
                </td>
                <td>
                  <input
                    value={row.remarks}
                    onChange={(e) => {
                      const next = [...form.monthlyRemarks];
                      next[index] = { ...next[index], remarks: e.target.value };
                      patch('monthlyRemarks', next);
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.actionIcon}
                    onClick={() => patch('monthlyRemarks', form.monthlyRemarks.filter((_, i) => i !== index))}
                  >
                    <i className="bi bi-trash" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button
          variant="outline"
          size="sm"
          label="Add Remark"
          onClick={() => patch('monthlyRemarks', [...(form.monthlyRemarks || []), { remarkDate: '', remarks: '' }])}
        />

        <div className={styles.formActions}>
          <Button type="submit" variant="primary" label={isAdd ? 'Save COA' : 'Update COA'} disabled={saving} />
        </div>
      </form>
    </div>
  );
}
