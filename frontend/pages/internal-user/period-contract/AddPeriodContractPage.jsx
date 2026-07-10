import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import {
  createPeriodContract,
  fetchPeriodContractLookups,
} from '../../../services/periodContracts.js';
import { usePeriodContractModule } from '../../../hooks/usePeriodContractModule.js';
import {
  EMPTY_BUNKER_ROW,
  EMPTY_DELIVERY_NOTICE,
  EMPTY_FORM,
  EMPTY_HIRE_RATE,
  EMPTY_OFF_HIRE,
  EMPTY_OFF_HIRE_BUNKER,
  toCreatePayload,
} from './addPeriodContract.constants.js';
import {
  calculateRedeliveryDates,
  periodTypeLabel,
  recalcBunkerRows,
  recalcHireAndOffHireRows,
  remainingDirties,
  sumAmounts,
} from './periodContractCalculations.js';
import PortSearchSelect from './PortSearchSelect.jsx';
import AddPeriodContractHeaderActions from './AddPeriodContractHeaderActions.jsx';
import styles from './AddPeriodContractPage.module.css';

function Field({ label, children, required = false }) {
  return (
    <div className={styles.field}>
      <label>
        {label}
        {required ? <span className={styles.required}>*</span> : null}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export default function AddPeriodContractPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { periodContractPath } = usePeriodContractModule();

  const [lookups, setLookups] = useState(null);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef(null);

  const periodUnit = periodTypeLabel(form.periodType);

  const vesselTypes = useMemo(
    () => lookups?.vesselTypesByBusiness?.[form.businessType] ?? [],
    [form.businessType, lookups],
  );

  const vessels = useMemo(
    () => lookups?.vesselsByBusiness?.[form.businessType] ?? [],
    [form.businessType, lookups],
  );

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

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [lookupData, types] = await Promise.all([
        fetchPeriodContractLookups(),
        fetchVcBusinessTypes('3'),
      ]);
      setLookups(lookupData);
      setBusinessTypes(types);
      setForm((current) => ({
        ...EMPTY_FORM,
        contractId: lookupData.contractId,
        contractDate: lookupData.today || current.contractDate,
        businessType: types[0]?.id || '3',
      }));
    } catch (err) {
      setError(err.message || 'Failed to load period contract form.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!form.deliveryDate || !form.periodType) return;
    const dates = calculateRedeliveryDates({
      deliveryDate: form.deliveryDate,
      periodMin: form.periodMin,
      periodMax: form.periodMax,
      periodType: form.periodType,
      aboutDaysMin: form.aboutDaysMin,
      aboutDaysMax: form.aboutDaysMax,
    });
    setForm((current) => ({
      ...current,
      reDelMinDate: dates.reDelMinDate,
      reDelMaxDate: dates.reDelMaxDate,
    }));
  }, [
    form.deliveryDate,
    form.periodMin,
    form.periodMax,
    form.periodType,
    form.aboutDaysMin,
    form.aboutDaysMax,
  ]);

  const handleDirtiesChange = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      next.dirtiesRemaining = remainingDirties(next.dirtiesAllowed, next.dirtiesDone);
      return next;
    });
  };

  const handleSubmit = async (updateStatus) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you have checked each entry?',
      confirmLabel: 'Save',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const payload = toCreatePayload(form, updateStatus);
      await createPeriodContract(payload, files);
      navigate(`${periodContractPath}?msg=0`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to save period contract.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOpen = () => {
    if (formRef.current && !formRef.current.reportValidity()) return;
    handleSubmit(1);
  };

  const handleSaveClose = () => {
    if (formRef.current && !formRef.current.reportValidity()) return;
    handleSubmit(2);
  };

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <AddPeriodContractHeaderActions
          listPath={periodContractPath}
          saving={saving}
          onSaveOpen={handleSaveOpen}
          onSaveClose={handleSaveClose}
        />
        <LoadingOverlay active label="Loading period contract form…" />
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <AddPeriodContractHeaderActions
        listPath={periodContractPath}
        saving={saving}
        onSaveOpen={handleSaveOpen}
        onSaveClose={handleSaveClose}
      />

      {error ? <div className={styles.error}>{error}</div> : null}

      <h2 className={styles.title}>Create a New Period Contract</h2>

      <form
        ref={formRef}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          handleSaveOpen();
        }}
      >
        <Section title="Contract Details">
          <div className={styles.grid}>
            <Field label="Contract ID">
              <input type="text" value={form.contractId} readOnly />
            </Field>
            <Field label="Contract No." required>
              <input
                type="text"
                value={form.contractNo}
                required
                onChange={(e) => updateField('contractNo', e.target.value)}
              />
            </Field>
            <Field label="Contract Date" required>
              <input
                type="text"
                placeholder="dd-mm-yyyy"
                value={form.contractDate}
                required
                onChange={(e) => updateField('contractDate', e.target.value)}
              />
            </Field>
            <Field label="Own Business Account" required>
              <select
                value={form.ownBusinessAccount}
                required
                onChange={(e) => updateField('ownBusinessAccount', e.target.value)}
              >
                <option value="">---Select from list---</option>
                {(lookups?.obaVendors ?? []).map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Business Type" required>
              <select
                value={form.businessType}
                required
                onChange={(e) => {
                  setForm((current) => ({
                    ...current,
                    businessType: e.target.value,
                    vesselType: '',
                    vesselImoId: '',
                  }));
                }}
              >
                <option value="">----Select from list----</option>
                {businessTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Vessel Type" required>
              <select
                value={form.vesselType}
                required
                onChange={(e) => updateField('vesselType', e.target.value)}
              >
                <option value="">---Select From List---</option>
                {vesselTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Vessel" required>
              <select
                value={form.vesselImoId}
                required
                onChange={(e) => updateField('vesselImoId', e.target.value)}
              >
                <option value="">---Select From List---</option>
                {vessels.map((vessel) => (
                  <option key={vessel.id} value={vessel.id}>{vessel.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Working Currency" required>
              <select
                value={form.currency}
                required
                onChange={(e) => updateField('currency', e.target.value)}
              >
                <option value="">---Select from list---</option>
                {(lookups?.currencies ?? []).map((currency) => (
                  <option key={currency.id} value={currency.id}>{currency.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Owner" required>
              <select
                value={form.owner}
                required
                onChange={(e) => updateField('owner', e.target.value)}
              >
                <option value="">---Select from list---</option>
                {(lookups?.ownerVendors ?? []).map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Disponent Owner" required>
              <select
                value={form.disOwner}
                required
                onChange={(e) => updateField('disOwner', e.target.value)}
              >
                <option value="">---Select from list---</option>
                {(lookups?.ownerVendors ?? []).map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Manager" required>
              <input
                type="text"
                value={form.manager}
                required
                onChange={(e) => updateField('manager', e.target.value)}
              />
            </Field>
            <Field label="Broker" required>
              <select
                value={form.broker}
                required
                onChange={(e) => updateField('broker', e.target.value)}
              >
                <option value="">---Select from list---</option>
                {(lookups?.brokerVendors ?? []).map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Brokerage (%)">
              <input
                type="text"
                inputMode="decimal"
                value={form.brokerage}
                onChange={(e) => updateField('brokerage', e.target.value)}
              />
            </Field>
            <Field label="Initial Hire" required>
              <input
                type="text"
                inputMode="decimal"
                value={form.hire}
                required
                onChange={(e) => updateField('hire', e.target.value)}
              />
            </Field>
            <Field label="Add Comm (%)">
              <input
                type="text"
                inputMode="decimal"
                value={form.addComm}
                onChange={(e) => updateField('addComm', e.target.value)}
              />
            </Field>
            <Field label="Remarks (Hire)">
              <textarea
                rows={2}
                value={form.hireRemarks}
                onChange={(e) => updateField('hireRemarks', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Laycan & Period">
          <div className={styles.grid}>
            <Field label="Laycan Start" required>
              <input
                type="text"
                placeholder="dd-mm-yyyy"
                value={form.laycanStart}
                required
                onChange={(e) => updateField('laycanStart', e.target.value)}
              />
            </Field>
            <Field label="Laycan End" required>
              <input
                type="text"
                placeholder="dd-mm-yyyy"
                value={form.laycanEnd}
                required
                onChange={(e) => updateField('laycanEnd', e.target.value)}
              />
            </Field>
            <Field label="Del Port" required>
              <PortSearchSelect
                value={form.delPort}
                label={form.delPortLabel}
                required
                onChange={(id, name) => {
                  updateField('delPort', id);
                  updateField('delPortLabel', name);
                }}
              />
            </Field>
            <Field label="Delivery Date" required>
              <input
                type="text"
                placeholder="dd-mm-yyyy"
                value={form.deliveryDate}
                required
                onChange={(e) => updateField('deliveryDate', e.target.value)}
              />
            </Field>
            <Field label="Time Period" required>
              <select
                value={form.periodType}
                required
                onChange={(e) => updateField('periodType', e.target.value)}
              >
                <option value="">---Select from list---</option>
                {(lookups?.periodTypes ?? []).map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </Field>
            <Field label={`Time Period Min.${periodUnit ? ` (${periodUnit})` : ''}`} required>
              <input
                type="text"
                inputMode="decimal"
                value={form.periodMin}
                required
                onChange={(e) => updateField('periodMin', e.target.value)}
              />
            </Field>
            <Field label={`Time Period Max.${periodUnit ? ` (${periodUnit})` : ''}`} required>
              <input
                type="text"
                inputMode="decimal"
                value={form.periodMax}
                required
                onChange={(e) => updateField('periodMax', e.target.value)}
              />
            </Field>
            <Field label="About days for Min Duration" required>
              <input
                type="text"
                inputMode="decimal"
                value={form.aboutDaysMin}
                required
                onChange={(e) => updateField('aboutDaysMin', e.target.value)}
              />
            </Field>
            <Field label="About days for Max Duration" required>
              <input
                type="text"
                inputMode="decimal"
                value={form.aboutDaysMax}
                required
                onChange={(e) => updateField('aboutDaysMax', e.target.value)}
              />
            </Field>
            <Field label="Re-Del Date (Min)" required>
              <input
                type="text"
                placeholder="dd-mm-yyyy"
                value={form.reDelMinDate}
                required
                onChange={(e) => updateField('reDelMinDate', e.target.value)}
              />
            </Field>
            <Field label="Re-Del Date (Max)" required>
              <input
                type="text"
                placeholder="dd-mm-yyyy"
                value={form.reDelMaxDate}
                required
                onChange={(e) => updateField('reDelMaxDate', e.target.value)}
              />
            </Field>
            <Field label="Re-Del Port">
              <PortSearchSelect
                value={form.reDelPort}
                label={form.reDelPortLabel}
                onChange={(id, name) => {
                  updateField('reDelPort', id);
                  updateField('reDelPortLabel', name);
                }}
              />
            </Field>
            <Field label="Redelivery Range" required>
              <textarea
                rows={3}
                value={form.redelRange}
                required
                onChange={(e) => updateField('redelRange', e.target.value)}
              />
            </Field>
            <Field label="Voyage days performed/fixed till">
              <input
                type="text"
                placeholder="dd-mm-yyyy"
                value={form.voyageDaysPerformed}
                onChange={(e) => updateField('voyageDaysPerformed', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Redelivery Notices">
          <div className={styles.tableWrap}>
            <table className={`zafira-data-table ${styles.table}`}>
            <thead>
              <tr>
                <th />
                <th>Redelivery Notices</th>
                <th>Date Time</th>
              </tr>
            </thead>
            <tbody>
              {form.deliveryNotices.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    {form.deliveryNotices.length > 1 ? (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => updateForm({
                          ...form,
                          deliveryNotices: form.deliveryNotices.filter((item) => item.id !== row.id),
                        })}
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.notice}
                      onChange={(e) => {
                        const deliveryNotices = [...form.deliveryNotices];
                        deliveryNotices[index] = { ...row, notice: e.target.value };
                        updateForm({ ...form, deliveryNotices });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="dd-mm-yyyy hh:mm"
                      value={row.dateTime}
                      onChange={(e) => {
                        const deliveryNotices = [...form.deliveryNotices];
                        deliveryNotices[index] = { ...row, dateTime: e.target.value };
                        updateForm({ ...form, deliveryNotices });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          <div className={styles.sectionActions}>
            <Button
              variant="secondary"
              label="Add Notice"
              onClick={() => {
              const last = form.deliveryNotices[form.deliveryNotices.length - 1];
              if (!last?.notice || !last?.dateTime) {
                setError('Please fill the previous notice row before adding another.');
                return;
              }
              setError('');
              updateForm({
                ...form,
                deliveryNotices: [...form.deliveryNotices, EMPTY_DELIVERY_NOTICE()],
              });
            }}
            />
          </div>
        </Section>

        <Section title="Hire Rate">
          <div className={styles.tableWrap}>
            <table className={`zafira-data-table ${styles.table}`}>
            <thead>
              <tr>
                <th />
                <th>Hire From</th>
                <th>Hire To</th>
                <th>Hire Days</th>
                <th>Hire Rate/Day ({form.currency || 'USD'})</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {form.hireRates.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    {form.hireRates.length > 1 ? (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => updateForm({
                          ...form,
                          hireRates: form.hireRates.filter((item) => item.id !== row.id),
                        })}
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="dd-mm-yyyy HH:MM"
                      value={row.hireFrom}
                      onChange={(e) => {
                        const hireRates = [...form.hireRates];
                        hireRates[index] = { ...row, hireFrom: e.target.value };
                        updateForm({ ...form, hireRates });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="dd-mm-yyyy HH:MM"
                      value={row.hireTo}
                      onChange={(e) => {
                        const hireRates = [...form.hireRates];
                        hireRates[index] = { ...row, hireTo: e.target.value };
                        updateForm({ ...form, hireRates });
                      }}
                    />
                  </td>
                  <td><input type="text" value={row.hireDays} readOnly /></td>
                  <td>
                    <input
                      type="text"
                      value={row.hireRate}
                      onChange={(e) => {
                        const hireRates = [...form.hireRates];
                        hireRates[index] = { ...row, hireRate: e.target.value };
                        updateForm({ ...form, hireRates });
                      }}
                    />
                  </td>
                  <td>
                    <textarea
                      rows={2}
                      value={row.remarks}
                      onChange={(e) => {
                        const hireRates = [...form.hireRates];
                        hireRates[index] = { ...row, remarks: e.target.value };
                        updateForm({ ...form, hireRates });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          <div className={styles.sectionActions}>
            <Button
              variant="secondary"
              label="Add Hire"
              onClick={() => {
              const last = form.hireRates[form.hireRates.length - 1];
              if (!last?.hireFrom || !last?.hireTo) {
                setError('Please fill the previous hire row before adding another.');
                return;
              }
              setError('');
              updateForm({
                ...form,
                hireRates: [...form.hireRates, EMPTY_HIRE_RATE()],
              });
            }}
            />
          </div>
        </Section>

        <Section title="Delivery Bunkers">
          <BunkerTable
            rows={form.deliveryBunkers}
            bunkers={lookups?.bunkers ?? []}
            total={deliveryBunkerTotal}
            onChange={(deliveryBunkers) => updateForm({
              ...form,
              deliveryBunkers: recalcBunkerRows(deliveryBunkers),
            })}
            onAdd={() => {
              const last = form.deliveryBunkers[form.deliveryBunkers.length - 1];
              if (!last?.gradeId || !last?.qty || !last?.date || !last?.price) {
                setError('Please fill the previous delivery bunker row before adding another.');
                return;
              }
              setError('');
              updateForm({
                ...form,
                deliveryBunkers: [...form.deliveryBunkers, EMPTY_BUNKER_ROW()],
              });
            }}
          />
        </Section>

        <Section title="Re-Delivery Bunkers">
          <BunkerTable
            rows={form.redeliveryBunkers}
            bunkers={lookups?.bunkers ?? []}
            total={redeliveryBunkerTotal}
            onChange={(redeliveryBunkers) => updateForm({
              ...form,
              redeliveryBunkers: recalcBunkerRows(redeliveryBunkers),
            })}
            onAdd={() => {
              const last = form.redeliveryBunkers[form.redeliveryBunkers.length - 1];
              if (!last?.gradeId || !last?.qty || !last?.date || !last?.price) {
                setError('Please fill the previous re-delivery bunker row before adding another.');
                return;
              }
              setError('');
              updateForm({
                ...form,
                redeliveryBunkers: [...form.redeliveryBunkers, EMPTY_BUNKER_ROW()],
              });
            }}
          />
        </Section>

        <Section title="Off-Hire">
          {form.offHires.map((offHire, offIndex) => (
            <div key={offHire.id} className={styles.offHireBlock}>
              <div className={styles.offHireHeader}>
                <strong>Off-Hire {offIndex + 1}</strong>
                {form.offHires.length > 1 ? (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => updateForm({
                      ...form,
                      offHires: form.offHires.filter((item) => item.id !== offHire.id),
                    })}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className={styles.grid}>
                <Field label="Off Hire Reason">
                  <textarea
                    rows={2}
                    value={offHire.reason}
                    onChange={(e) => {
                      const offHires = [...form.offHires];
                      offHires[offIndex] = { ...offHire, reason: e.target.value };
                      updateForm({ ...form, offHires });
                    }}
                  />
                </Field>
                <Field label="Off Hire From">
                  <input
                    type="text"
                    placeholder="dd-mm-yyyy HH:MM"
                    value={offHire.from}
                    onChange={(e) => {
                      const offHires = [...form.offHires];
                      offHires[offIndex] = { ...offHire, from: e.target.value };
                      updateForm({ ...form, offHires });
                    }}
                  />
                </Field>
                <Field label="Off Hire To">
                  <input
                    type="text"
                    placeholder="dd-mm-yyyy HH:MM"
                    value={offHire.to}
                    onChange={(e) => {
                      const offHires = [...form.offHires];
                      offHires[offIndex] = { ...offHire, to: e.target.value };
                      updateForm({ ...form, offHires });
                    }}
                  />
                </Field>
                <Field label="Off Hire Days">
                  <input type="text" value={offHire.days} readOnly />
                </Field>
                <Field label="Off Hire Rate/Day">
                  <input
                    type="text"
                    value={offHire.rate}
                    onChange={(e) => {
                      const offHires = [...form.offHires];
                      offHires[offIndex] = { ...offHire, rate: e.target.value };
                      updateForm({ ...form, offHires });
                    }}
                  />
                </Field>
                <Field label="Off Hire Amount">
                  <input type="text" value={offHire.amount} readOnly />
                </Field>
              </div>

              <div className={styles.tableWrap}>
                <table className={`zafira-data-table ${styles.table}`}>
                <thead>
                  <tr>
                    <th />
                    <th>Bunker Grade</th>
                    <th>Qty (MT)</th>
                    <th>Price (USD)</th>
                    <th>Amount (USD)</th>
                    <th>On Owner&apos;s Account</th>
                  </tr>
                </thead>
                <tbody>
                  {offHire.bunkers.map((bunker, bunkerIndex) => (
                    <tr key={bunker.id}>
                      <td>
                        {offHire.bunkers.length > 1 ? (
                          <button
                            type="button"
                            className={styles.removeBtn}
                            onClick={() => {
                              const offHires = [...form.offHires];
                              offHires[offIndex] = {
                                ...offHire,
                                bunkers: offHire.bunkers.filter((item) => item.id !== bunker.id),
                              };
                              updateForm({ ...form, offHires });
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                      <td>
                        <select
                          value={bunker.gradeId}
                          onChange={(e) => {
                            const offHires = [...form.offHires];
                            const bunkers = [...offHire.bunkers];
                            bunkers[bunkerIndex] = { ...bunker, gradeId: e.target.value };
                            offHires[offIndex] = { ...offHire, bunkers };
                            updateForm({ ...form, offHires });
                          }}
                        >
                          <option value="">---Select from list---</option>
                          {(lookups?.bunkers ?? []).map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={bunker.qty}
                          onChange={(e) => {
                            const offHires = [...form.offHires];
                            const bunkers = [...offHire.bunkers];
                            bunkers[bunkerIndex] = { ...bunker, qty: e.target.value };
                            offHires[offIndex] = { ...offHire, bunkers };
                            updateForm({ ...form, offHires });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={bunker.price}
                          onChange={(e) => {
                            const offHires = [...form.offHires];
                            const bunkers = [...offHire.bunkers];
                            bunkers[bunkerIndex] = { ...bunker, price: e.target.value };
                            offHires[offIndex] = { ...offHire, bunkers };
                            updateForm({ ...form, offHires });
                          }}
                        />
                      </td>
                      <td><input type="text" value={bunker.amount} readOnly /></td>
                      <td>
                        <input
                          type="checkbox"
                          checked={bunker.ownerAccount}
                          onChange={(e) => {
                            const offHires = [...form.offHires];
                            const bunkers = [...offHire.bunkers];
                            bunkers[bunkerIndex] = { ...bunker, ownerAccount: e.target.checked };
                            offHires[offIndex] = { ...offHire, bunkers };
                            updateForm({ ...form, offHires });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
              <div className={styles.sectionActions}>
                <Button
                  variant="secondary"
                  label="Add Bunkers"
                  onClick={() => {
                  const last = offHire.bunkers[offHire.bunkers.length - 1];
                  if (!last?.gradeId || !last?.qty || !last?.price) {
                    setError('Please fill the previous off-hire bunker row before adding another.');
                    return;
                  }
                  setError('');
                  const offHires = [...form.offHires];
                  offHires[offIndex] = {
                    ...offHire,
                    bunkers: [...offHire.bunkers, EMPTY_OFF_HIRE_BUNKER()],
                  };
                  updateForm({ ...form, offHires });
                }}
                />
              </div>
            </div>
          ))}
          <div className={styles.sectionActions}>
            <Button
              variant="secondary"
              label="Add Off-Hire"
              onClick={() => {
              const last = form.offHires[form.offHires.length - 1];
              if (!last?.reason || ((!last?.from || !last?.to) && !last?.days)) {
                setError('Please fill the previous off-hire row before adding another.');
                return;
              }
              setError('');
              updateForm({
                ...form,
                offHires: [...form.offHires, EMPTY_OFF_HIRE()],
              });
            }}
            />
          </div>
        </Section>

        <Section title="Additional Details">
          <div className={styles.grid}>
            <Field label="Trade Exclusions">
              <textarea rows={2} value={form.tradeExclusions} onChange={(e) => updateField('tradeExclusions', e.target.value)} />
            </Field>
            <Field label="Cargo Exclusions">
              <textarea rows={2} value={form.cargoExclusions} onChange={(e) => updateField('cargoExclusions', e.target.value)} />
            </Field>
            <Field label="Intermediate Hold Clearing">
              <textarea rows={2} value={form.intermediateHoldCleaning} onChange={(e) => updateField('intermediateHoldCleaning', e.target.value)} />
            </Field>
            <Field label="Remarks">
              <textarea rows={2} value={form.remarks} onChange={(e) => updateField('remarks', e.target.value)} />
            </Field>
            <Field label="Dirties Allowed">
              <input type="text" value={form.dirtiesAllowed} onChange={(e) => handleDirtiesChange('dirtiesAllowed', e.target.value)} />
            </Field>
            <Field label="Dirties Done">
              <input type="text" value={form.dirtiesDone} onChange={(e) => handleDirtiesChange('dirtiesDone', e.target.value)} />
            </Field>
            <Field label="Dirties Remaining">
              <input type="text" value={form.dirtiesRemaining} readOnly />
            </Field>
            <Field label="Hold Cleaning Material Availability">
              <textarea rows={2} value={form.holdCleaningMaterial} onChange={(e) => updateField('holdCleaningMaterial', e.target.value)} />
            </Field>
            <Field label="Additional Premium for HRA/Piracy">
              <textarea rows={2} value={form.addnlPremiumHra} onChange={(e) => updateField('addnlPremiumHra', e.target.value)} />
            </Field>
            <Field label="ILOHC">
              <input type="text" value={form.ilohc} onChange={(e) => updateField('ilohc', e.target.value)} />
            </Field>
            <Field label="1st Leg Details">
              <textarea rows={2} value={form.legDetails} onChange={(e) => updateField('legDetails', e.target.value)} />
            </Field>
            <Field label={periodUnit ? `Month/Days (${periodUnit})` : 'Month/Days'}>
              <input type="text" value={form.monthDays} readOnly />
            </Field>
          </div>
        </Section>

        <Section title="Attachments">
          <div className={styles.attachmentsField}>
            <input
              type="file"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
            />
          </div>
        </Section>
      </form>

      {saving ? <LoadingOverlay active label="Saving period contract…" /> : null}
    </div>
  );
}

function BunkerTable({ rows, bunkers, total, onChange, onAdd }) {
  const updateRow = (index, patch) => {
    const nextRows = [...rows];
    nextRows[index] = { ...nextRows[index], ...patch };
    onChange(nextRows);
  };

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={`zafira-data-table ${styles.table}`}>
          <thead>
            <tr>
              <th />
              <th>Bunker Grade</th>
              <th>Qty (MT)</th>
              <th>Bunker Date</th>
              <th>Price USD/MT</th>
              <th>Amount (USD)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
                    >
                      Remove
                    </button>
                  ) : null}
                </td>
                <td>
                  <select value={row.gradeId} onChange={(e) => updateRow(index, { gradeId: e.target.value })}>
                    <option value="">---Select from list---</option>
                    {bunkers.map((bunker) => (
                      <option key={bunker.id} value={bunker.id}>{bunker.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="text" value={row.qty} onChange={(e) => updateRow(index, { qty: e.target.value })} />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="dd-mm-yyyy"
                    value={row.date}
                    onChange={(e) => updateRow(index, { date: e.target.value })}
                  />
                </td>
                <td>
                  <input type="text" value={row.price} onChange={(e) => updateRow(index, { price: e.target.value })} />
                </td>
                <td><input type="text" value={row.amount} readOnly /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableFooter}>
        <Button variant="secondary" label="Add Bunkers" onClick={onAdd} />
        <div className={styles.tableTotal}>
          <span className={styles.tableTotalLabel}>Total (USD)</span>
          <input type="text" className={styles.tableTotalInput} value={total} readOnly />
        </div>
      </div>
    </>
  );
}
