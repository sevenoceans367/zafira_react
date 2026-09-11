import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AttachmentDropzone, DmyDateInput, LoadingOverlay, PeriodCardPicker } from '@bainbridge/shared-ui';
import { useCoaModule } from '../../../hooks/useCoaModule.js';
import {
  createCoa,
  fetchCoa,
  fetchCoaLookups,
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
    minQtyPerShipment: '',
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
    freightUsd: '',
    foPrice: '',
    bafAmt: '',
    attachment: '',
    attachmentName: '',
    exclusions: [{ minGuaranteed: '', ports: [] }],
    monthlyRemarks: [{ remarkDate: '', remarks: '' }],
  };
}

function parsePorts(exPort) {
  if (Array.isArray(exPort)) return exPort.map(String).filter(Boolean);
  if (!exPort) return [];
  return String(exPort)
    .split(/\s*\|\s*|\s*,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function normalizeExclusions(rows) {
  if (!rows?.length) return [{ minGuaranteed: '', ports: [] }];
  return rows.map((row) => ({
    minGuaranteed: row.minGuaranteed || '',
    ports: parsePorts(row.ports || row.exPort),
  }));
}

function CardHead({ icon, title }) {
  return (
    <div className={styles.cardHead}>
      <span className={styles.cardHeadIcon}>{icon}</span>
      <span className={styles.cardTitle}>{title}</span>
    </div>
  );
}

function Field({ id, label, children, className = '', hint = '' }) {
  return (
    <div className={`${styles.field} ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
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

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
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
  const [pendingFiles, setPendingFiles] = useState([]);
  const isAdd = mode === 'add' || !coaId;
  const [lookups, setLookups] = useState(null);
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
        const lookupData = await fetchCoaLookups();
        if (cancelled) return;
        setLookups(lookupData);
        if (isAdd) {
          setForm(emptyForm(searchParams.get('selBType') || '2', lookupData.nextCoaId));
        } else {
          const detail = await fetchCoa(coaId);
          if (cancelled) return;
          if (!detail) throw new Error('COA not found.');
          setForm({
            ...emptyForm(detail.businessTypeId),
            ...detail,
            exclusions: normalizeExclusions(detail.exclusions),
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

  // Cargo Name = cargo_master.MATERIAL_TYPE; Tanker/Gas/Dry via MATERIAL_TYPEID (= business type).
  const cargos = useMemo(() => {
    const all = lookups?.cargos || [];
    const bType = String(form.businessTypeId || '');
    const filtered = all.filter((item) => {
      if (!item.materialTypeId) return true;
      return String(item.materialTypeId) === bType;
    });
    return filtered.length ? filtered : all;
  }, [form.businessTypeId, lookups]);

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addPendingFiles = (added) => {
    if (!added?.length) return;
    setPendingFiles((prev) => {
      const files = [...prev, ...added];
      patch('attachmentName', files[0]?.name || '');
      return files;
    });
  };

  const removePendingFile = (index) => {
    setPendingFiles((prev) => {
      const files = prev.filter((_, i) => i !== index);
      patch('attachmentName', files[0]?.name || '');
      return files;
    });
  };

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
        exclusions: (form.exclusions || [])
          .filter((row) => row.minGuaranteed || (row.ports || []).length)
          .map((row) => ({
            minGuaranteed: row.minGuaranteed || '',
            exPort: (row.ports || []).join(' | '),
          })),
      };
      if (isAdd) await createCoa(payload);
      else await updateCoa(coaId, payload);
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
          <CardHead
            title="Contract Information"
            icon={(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5.5" />
                <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
              </svg>
            )}
          />

          <div className={styles.gridFields}>
            <Field id="coaIdentity" label="COA No.">
              <input
                id="coaIdentity"
                value={form.coaIdentity}
                onChange={(e) => patch('coaIdentity', e.target.value)}
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
              <CoaCardSelect className={styles.select}
                label="Route"
                value={form.coaRoute}
                options={lookups?.routes || []}
                onChange={(value) => patch('coaRoute', value)}
              />
            </Field>
            <Field id="charterer" label="Charterer">
              <CoaCardSelect className={styles.select}
                label="Charterer"
                value={form.charterer}
                options={lookups?.charterers || []}
                onChange={(value) => patch('charterer', value)}
              />
            </Field>
            <Field id="owner" label="Owner">
              <CoaCardSelect className={styles.select}
                label="Owner"
                value={form.owner}
                options={lookups?.owners || []}
                onChange={(value) => patch('owner', value)}
              />
            </Field>
            <Field id="broker" label="Broker">
              <CoaCardSelect className={styles.select}
                label="Broker"
                value={form.broker}
                options={lookups?.brokers || []}
                onChange={(value) => patch('broker', value)}
              />
            </Field>

            <Field id="vesselType" label="Trade Type">
              <CoaCardSelect className={styles.select}
                label="Trade Type"
                value={form.vesselType}
                options={vesselTypes}
                onChange={(value) => patch('vesselType', value)}
              />
            </Field>
            <Field id="loadOptions" label="Load Options">
              <input
                id="loadOptions"
                type="text"
                placeholder="e.g. 1/1 Safe Berth Safe Port"
                value={form.loadOptions}
                onChange={(e) => patch('loadOptions', e.target.value)}
              />
            </Field>
            <Field id="cargo" label="Cargo">
              <CoaCardSelect className={styles.select}
                label="Cargo"
                value={form.cargo}
                options={cargos}
                onChange={(value) => patch('cargo', value)}
              />
            </Field>
            <Field id="totalShipments" label="Total Shipments (Count)">
              <input
                id="totalShipments"
                type="number"
                placeholder="0"
                value={form.totalShipments}
                onChange={(e) => patch('totalShipments', e.target.value)}
              />
            </Field>
            <Field id="tolerance" label="Tolerance (%)">
              <input
                id="tolerance"
                type="number"
                placeholder="0.00"
                value={form.tolerance}
                onChange={(e) => patch('tolerance', e.target.value)}
              />
            </Field>
            <Field id="coaNotice" label="COA Notice Days">
              <input
                id="coaNotice"
                type="number"
                placeholder="0"
                value={form.coaNotice}
                onChange={(e) => patch('coaNotice', e.target.value)}
              />
            </Field>

            <Field id="lpEtaNotices" label="Load Port ETA Notices">
              <input
                id="lpEtaNotices"
                value={form.lpEtaNotices}
                onChange={(e) => patch('lpEtaNotices', e.target.value)}
              />
            </Field>
            <Field id="vesselSubstitute" label="Vessel Substitutions">
              <CoaCardSelect className={styles.select}
                label="Vessel Substitutions"
                value={form.vesselSubstitute}
                options={lookups?.vesselSubstitutes || []}
                includeEmpty={false}
                onChange={(value) => patch('vesselSubstitute', value)}
              />
            </Field>
            <Field id="duration" label="COA Duration (Days)">
              <input
                id="duration"
                type="number"
                placeholder="e.g. 365"
                value={form.duration}
                onChange={(e) => patch('duration', e.target.value)}
              />
            </Field>
            <Field id="period" label="Select Period" className={`${styles.span2} ${styles.periodField}`}>
              <PeriodCardPicker
                from={form.startDate || ''}
                to={form.endDate || ''}
                align="end"
                onChange={({ from, to }) => {
                  setForm((prev) => ({ ...prev, startDate: from || '', endDate: to || '' }));
                }}
              />
            </Field>
            <Field id="currency" label="Working Currency">
              <CoaCardSelect className={styles.select}
                label="Working Currency"
                value={form.currency}
                options={lookups?.currencies || []}
                includeEmpty={false}
                onChange={(value) => patch('currency', value)}
              />
            </Field>
          </div>
        </div>

        <div className={styles.qtyAttachRow}>
        <div className={styles.card}>
          <CardHead
            title="Quantity & Load Ports"
            icon={(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" />
                <circle cx="12" cy="9" r="2.4" />
              </svg>
            )}
          />
          <div className={styles.qtyFields}>
            <Field id="minGuaranteedQty" label="Minimum Quantity Guaranteed (MT)" className={styles.qtyMatchField}>
              <input
                id="minGuaranteedQty"
                type="number"
                placeholder="0.00"
                value={form.minGuaranteedQty}
                onChange={(e) => patch('minGuaranteedQty', e.target.value)}
              />
            </Field>
            <Field id="minQtyPerShipment" label="Minimum Quantity per Shipment (MT)" className={styles.qtyMatchField}>
              <input
                id="minQtyPerShipment"
                type="number"
                placeholder="0.00"
                value={form.minQtyPerShipment}
                onChange={(e) => patch('minQtyPerShipment', e.target.value)}
              />
            </Field>
          </div>
          <div className={styles.miniWrap}>
            <table className={`${styles.miniTable} ${styles.qtyTable}`}>
              <thead>
                <tr>
                  <th className={styles.actionCol} />
                  <th>Qty/Shipment (MT)</th>
                  <th>Load Port</th>
                </tr>
              </thead>
              <tbody>
                {(form.exclusions || []).map((row, index) => (
                  <tr key={`ex-${index}`}>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.rowAdd}
                          title="Add row"
                          onClick={() => patch(
                            'exclusions',
                            [
                              ...(form.exclusions || []).slice(0, index + 1),
                              { minGuaranteed: '', ports: [] },
                              ...(form.exclusions || []).slice(index + 1),
                            ],
                          )}
                        >
                          <PlusIcon />
                        </button>
                        <button
                          type="button"
                          className={styles.rowDel}
                          title="Remove row"
                          disabled={(form.exclusions || []).length <= 1}
                          onClick={() => patch('exclusions', form.exclusions.filter((_, i) => i !== index))}
                        >
                          <XIcon />
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        placeholder="0.00"
                        value={row.minGuaranteed}
                        onChange={(e) => {
                          const next = [...form.exclusions];
                          next[index] = { ...next[index], minGuaranteed: e.target.value };
                          patch('exclusions', next);
                        }}
                      />
                    </td>
                    <td>
                      <div className={styles.lpChipField}>
                        {(row.ports || []).length ? (
                          <div className={styles.lpChips}>
                            {(row.ports || []).map((port) => (
                              <span key={port} className={styles.lpChip}>
                                {port}
                                <button
                                  type="button"
                                  className={styles.lpChipX}
                                  title="Remove port"
                                  onClick={() => {
                                    const next = [...form.exclusions];
                                    next[index] = {
                                      ...next[index],
                                      ports: (next[index].ports || []).filter((p) => p !== port),
                                    };
                                    patch('exclusions', next);
                                  }}
                                >
                                  <XIcon />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <input
                          className={styles.lpAddInput}
                          placeholder="+ Add port"
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const value = e.currentTarget.value.trim();
                            if (!value) return;
                            const next = [...form.exclusions];
                            const ports = next[index].ports || [];
                            if (!ports.includes(value)) {
                              next[index] = { ...next[index], ports: [...ports, value] };
                              patch('exclusions', next);
                            }
                            e.currentTarget.value = '';
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.docsSection}>
          <div className={`${styles.docsSectionHead} ${styles.docsSectionHeadGrey}`}>
            <div className={styles.docsSectionTitleWrap}>
              <div className={styles.sectionIco}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </div>
              <div className={styles.docsSectionTitle}>Attachments</div>
              {pendingFiles.length ? <div className={styles.docsCount}>{pendingFiles.length}</div> : null}
            </div>
          </div>
          <div className={styles.docsSectionBody}>
            <AttachmentDropzone
              files={pendingFiles}
              existing={!pendingFiles.length && form.attachmentName
                ? [{ name: form.attachmentName }]
                : []}
              onAddFiles={addPendingFiles}
              onRemoveFile={removePendingFile}
            />
          </div>
        </div>
        </div>

        <div className={styles.card}>
          <CardHead
            title="Financials & Commercial Terms"
            icon={(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v18" />
                <path d="M16.5 7.5c0-2-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.3 9 2 9 6.3 0 2-2 3.2-4.5 3.2s-4.5-1-4.5-3" />
              </svg>
            )}
          />
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
            <Field id="freightUsd" label="Freight (USD/MT)">
              <input
                id="freightUsd"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.freightUsd}
                onChange={(e) => patch('freightUsd', e.target.value)}
              />
            </Field>
            <Field id="foPrice" label="Contract FO Price (USD/MT)">
              <input
                id="foPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.foPrice}
                onChange={(e) => patch('foPrice', e.target.value)}
              />
            </Field>
            <Field id="bafAmt" label="BAF">
              <input
                id="bafAmt"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.bafAmt}
                onChange={(e) => patch('bafAmt', e.target.value)}
              />
            </Field>
            <div className={styles.noteRow}>
              <Field id="demmLaytime" label="Demurrage & Laytime">
                <textarea id="demmLaytime" className={styles.shortNote} value={form.demmLaytime} placeholder="Demurrage & Laytime" onChange={(e) => patch('demmLaytime', e.target.value)} />
              </Field>
              <Field id="remarks" label="Overall Remarks">
                <textarea id="remarks" className={styles.shortNote} value={form.remarks} placeholder="Overall Remarks..." onChange={(e) => patch('remarks', e.target.value)} />
              </Field>
            </div>
          </div>
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
