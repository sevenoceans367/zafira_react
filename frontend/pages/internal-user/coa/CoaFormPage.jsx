import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DmyDateInput, LoadingOverlay, PeriodCardPicker } from '@bainbridge/shared-ui';
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
import styles from './CoaFormPage.module.css';

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

function Field({ id, label, children, className = '' }) {
  return (
    <div className={`${styles.field} ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

export default function CoaFormPage({ mode = 'edit' }) {
  const { coaId } = useParams();
  const navigate = useNavigate();
  const { coaPath } = useCoaModule();
  const [searchParams] = useSearchParams();
  const fileRef = useRef(null);
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
      setError('COA No. is required.');
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
        <LoadingOverlay show label="Loading COA…" />
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <CoaFormHeaderActions listHref={listHref} disabled={saving} />
      {saving ? <LoadingOverlay show fullScreen={false} label="Saving COA…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <form onSubmit={handleSave}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>COA Details</div>

          <div className={styles.gridFields}>
            <Field id="coaIdentity" label="COA No.">
              <input
                id="coaIdentity"
                className={!isAdd ? styles.readonly : undefined}
                readOnly={!isAdd}
                value={form.coaIdentity}
                onChange={(e) => patch('coaIdentity', e.target.value)}
                required
              />
            </Field>
            <Field id="coaDate" label="Date">
              <DmyDateInput
                id="coaDate"
                value={form.coaDate || ''}
                onChange={(value) => patch('coaDate', value)}
              />
            </Field>
            <Field id="coaRoute" label="Route">
              <CoaCardSelect
                label="Route"
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
            <Field id="loadOptions" label="Load Options">
              <CoaCardSelect
                label="Load Options"
                value={form.loadOptions}
                options={lookups?.loadOptions || []}
                onChange={(value) => patch('loadOptions', value)}
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
            <Field id="totalShipments" label="Total Shipments (Count)">
              <input id="totalShipments" value={form.totalShipments} onChange={(e) => patch('totalShipments', e.target.value)} />
            </Field>
            <Field id="tolerance" label="Tolerance (%)">
              <input id="tolerance" value={form.tolerance} onChange={(e) => patch('tolerance', e.target.value)} />
            </Field>
            <Field id="coaNotice" label="COA Notice Days">
              <input id="coaNotice" value={form.coaNotice} onChange={(e) => patch('coaNotice', e.target.value)} />
            </Field>

            <Field id="minGuaranteedQty" label="Min Qty Guaranteed (MT)">
              <input id="minGuaranteedQty" value={form.minGuaranteedQty} onChange={(e) => patch('minGuaranteedQty', e.target.value)} />
            </Field>
            <Field id="lpEtaNotices" label="Load Port ETA Notices">
              <input id="lpEtaNotices" value={form.lpEtaNotices} onChange={(e) => patch('lpEtaNotices', e.target.value)} />
            </Field>
            <Field id="vesselSubstitute" label="Vessel Substitutions">
              <CoaCardSelect
                label="Vessel Substitutions"
                value={form.vesselSubstitute}
                options={lookups?.vesselSubstitutes || []}
                includeEmpty={false}
                onChange={(value) => patch('vesselSubstitute', value)}
              />
            </Field>
            <Field id="duration" label="COA Duration">
              <input id="duration" value={form.duration} onChange={(e) => patch('duration', e.target.value)} />
            </Field>
            <Field id="period" label="Select Period" className={`${styles.span2} ${styles.periodField}`}>
              <PeriodCardPicker
                from={form.startDate || ''}
                to={form.endDate || ''}
                align="start"
                onChange={({ from, to }) => {
                  setForm((prev) => ({ ...prev, startDate: from || '', endDate: to || '' }));
                }}
              />
            </Field>
            <Field id="currency" label="Working Currency">
              <CoaCardSelect
                label="Working Currency"
                value={form.currency}
                options={lookups?.currencies || []}
                includeEmpty={false}
                onChange={(value) => patch('currency', value)}
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
            <Field id="coaNo" label="Internal COA No.">
              <input id="coaNo" value={form.coaNo} onChange={(e) => patch('coaNo', e.target.value)} />
            </Field>
          </div>

          <hr className={styles.divider} />

          <div className={styles.miniWrap}>
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th style={{ width: 24 }} />
                  <th>Min Qty Guaranteed (CBM/MT)</th>
                  <th>Ex-Port</th>
                </tr>
              </thead>
              <tbody>
                {(form.exclusions || []).map((row, index) => (
                  <tr key={`ex-${index}`}>
                    <td>
                      <button
                        type="button"
                        className={styles.rowDel}
                        title="Remove row"
                        disabled={(form.exclusions || []).length <= 1}
                        onClick={() => patch('exclusions', form.exclusions.filter((_, i) => i !== index))}
                      >
                        <i className="bi bi-x-lg" aria-hidden />
                      </button>
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              className={styles.dashedAdd}
              onClick={() => patch('exclusions', [...(form.exclusions || []), { minGuaranteed: '', exPort: '' }])}
            >
              <PlusIcon />
              Add
            </button>
          </div>

          <hr className={styles.divider} />

          <div className={styles.gridFields}>
            <Field id="freightDetails" label="Freight Details" className={styles.span3}>
              <textarea id="freightDetails" value={form.freightDetails} placeholder="Freight Details" onChange={(e) => patch('freightDetails', e.target.value)} />
            </Field>
            <Field id="lpDetails" label="Load Port Details" className={styles.span3}>
              <textarea id="lpDetails" value={form.lpDetails} placeholder="Load Port Details" onChange={(e) => patch('lpDetails', e.target.value)} />
            </Field>
            <Field id="dpDetails" label="Discharge Port Details" className={styles.span3}>
              <textarea id="dpDetails" value={form.dpDetails} placeholder="Discharge Port Details" onChange={(e) => patch('dpDetails', e.target.value)} />
            </Field>
            <Field id="foPrice" label="Contract FO Price (USD/MT)">
              <input id="foPrice" value={form.foPrice} onChange={(e) => patch('foPrice', e.target.value)} />
            </Field>
            <Field id="bafAmt" label="BAF">
              <input id="bafAmt" value={form.bafAmt} onChange={(e) => patch('bafAmt', e.target.value)} />
            </Field>
            <Field id="demmLaytime" label="Demurrage & Laytime" className={styles.span3}>
              <textarea id="demmLaytime" value={form.demmLaytime} placeholder="Demurrage & Laytime" onChange={(e) => patch('demmLaytime', e.target.value)} />
            </Field>
            <Field id="remarks" label="Overall Remarks" className={styles.span6}>
              <textarea id="remarks" value={form.remarks} placeholder="Overall Remarks..." onChange={(e) => patch('remarks', e.target.value)} />
            </Field>
          </div>

          <hr className={styles.divider} />

          <div className={styles.sectionTitle}>Monthly Remarks</div>
          <div className={styles.miniWrap}>
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th style={{ width: 24 }} />
                  <th>Date</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {(form.monthlyRemarks || []).map((row, index) => (
                  <tr key={`mr-${index}`}>
                    <td>
                      <button
                        type="button"
                        className={styles.rowDel}
                        title="Remove row"
                        onClick={() => patch('monthlyRemarks', form.monthlyRemarks.filter((_, i) => i !== index))}
                      >
                        <i className="bi bi-x-lg" aria-hidden />
                      </button>
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              className={styles.dashedAdd}
              onClick={() => patch('monthlyRemarks', [...(form.monthlyRemarks || []), { remarkDate: '', remarks: '' }])}
            >
              <PlusIcon />
              Add
            </button>
          </div>

          <hr className={styles.divider} />

          <Field id="attachment" label="Attach COA Recap">
            <div className={styles.dropzone}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M21 12.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9.5" />
                <path d="M16 3l5 5-9 9H7v-5z" />
              </svg>
              <div className={styles.dzText}>Drag & drop files here, or browse</div>
              <div className={styles.dzSub}>
                {form.attachmentName || 'No file attached'}
              </div>
              <label className={styles.attachBtn}>
                Attach
                <input
                  ref={fileRef}
                  id="attachment"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    patch('attachmentName', file?.name || '');
                  }}
                />
              </label>
            </div>
          </Field>
        </div>

        <div className={styles.formFooter}>
          <button type="submit" className={styles.btnSave} disabled={saving}>
            <SaveIcon />
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
