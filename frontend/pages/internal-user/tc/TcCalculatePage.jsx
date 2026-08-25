import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, DmyDateInput, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { useTcModule } from '../../../hooks/useTcModule.js';
import {
  calcTcTotals,
  daysBetween,
  fetchPeriodTcInDetails,
  fetchTcEstimate,
  fetchTcLookups,
  saveTcCalculation,
} from '../../../services/tcEstimates.js';
import TcFormHeaderActions from './TcFormHeaderActions.jsx';
import TcInExpensesModal, {
  EMPTY_TC_IN_BUNKER,
  EMPTY_TC_IN_HIRE,
  EMPTY_TC_IN_OFF,
  calcTcInFinalHireage,
} from './TcInExpensesModal.jsx';
import styles from './TcPages.module.css';

const EMPTY_BUNKER = { bunkerId: '', qty: '', price: '', amount: '', bunkerDate: '' };
const EMPTY_HIRE = { delDate: '', reDelDate: '', days: '', hireRate: '', amount: '' };
const EMPTY_OFF = { reason: '', from: '', to: '', days: '', hireRate: '', amount: '' };
const EMPTY_INCOME = { description: '', amount: '' };
const EMPTY_EXPENSE = { expenseTypeId: '', description: '', addToTotal: true, amount: '' };
const EMPTY_ITIN_EXP = { expenseType: '', description: '', amount: '', notes: '' };

function emptyTcIn(detail = {}, calc = {}) {
  return {
    cpDate: calc.tcCpDate || detail.cpDate || '',
    contractRef: calc.tcCpNumber || detail.tcNo || '',
    deliveryPort: calc.tcDeliveryPort || detail.delRangePort || '',
    redeliveryPort: calc.tcRedeliveryPort || detail.reDelRange || '',
    hires: [{
      ...EMPTY_TC_IN_HIRE,
      deliveryDate: detail.delDate || '',
      redeliveryDate: detail.reDelDate || '',
      dailyHire: detail.hireFixPer || '',
      addCommPct: detail.addComm || '',
    }],
    deliveryBunkers: [{ ...EMPTY_TC_IN_BUNKER }],
    redeliveryBunkers: [{ ...EMPTY_TC_IN_BUNKER }],
    offHires: [{ ...EMPTY_TC_IN_OFF }],
    offHireCveMonth: calc.tcOffHireCveMonth || '',
    bunkerOnOwner: calc.tcBunkerOnOwner || '',
    ilohc: calc.tcIlohc || detail.ilohcUsd || '',
    awrpCost: calc.awrpCost || '',
    finalVendor: calc.tcFinalVendor || '',
    finalHireage: calc.tcFinalHireage || '0.00',
  };
}

function hasSavedTcInHires(tcIn) {
  return Boolean(tcIn?.hires?.some((row) => (
    (row.dailyHire != null && String(row.dailyHire).trim() !== '')
    || (row.deliveryDate != null && String(row.deliveryDate).trim() !== '')
    || (row.hireage != null && String(row.hireage).trim() !== '' && Number(row.hireage) !== 0)
  )));
}

function applyPeriodTcIn(baseTcIn, periodData) {
  if (!periodData) return baseTcIn;
  const hires = (periodData.hires || []).map((row) => ({ ...EMPTY_TC_IN_HIRE, ...row }));
  const deliveryBunkers = (periodData.deliveryBunkers || []).map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }));
  const redeliveryBunkers = (periodData.redeliveryBunkers || []).map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }));
  const offHires = (periodData.offHires || []).map((row) => ({ ...EMPTY_TC_IN_OFF, ...row }));
  return {
    ...baseTcIn,
    hires: hires.length ? hires : baseTcIn.hires,
    deliveryBunkers: deliveryBunkers.length ? deliveryBunkers : baseTcIn.deliveryBunkers,
    redeliveryBunkers: redeliveryBunkers.length ? redeliveryBunkers : baseTcIn.redeliveryBunkers,
    offHires: offHires.length ? offHires : baseTcIn.offHires,
    bunkerOnOwner: periodData.bunkerOnOwner || baseTcIn.bunkerOnOwner || '',
  };
}

function lookupName(list, id) {
  if (id == null || id === '') return '';
  const found = (list || []).find((opt) => String(opt.id) === String(id));
  return found?.name || String(id);
}

function initFromDetail(detail) {
  const hire = Number(detail?.hireFixPer || 0);
  const rate = Number(detail?.exchangeRate);
  const exchange = Number.isFinite(rate) && rate !== 0 ? rate : 1;
  const base = detail?.calc || {};
  const dailyGross = base.dailyGrossHire || String((hire * exchange).toFixed(2));
  const hireRate = detail?.hireFixPer || dailyGross;

  let hirePeriods = detail?.hirePeriods?.length
    ? detail.hirePeriods.map((row) => ({ ...EMPTY_HIRE, ...row }))
    : [];
  if (!hirePeriods.length) {
    const delDate = base.delDate || detail?.delDate || '';
    const reDelDate = base.reDelDate || detail?.reDelDate || '';
    // Prefer date-derived days (PHP always recomputes from del/redel). Never treat fixture Period as TC days.
    const daysFromDates = delDate && reDelDate ? daysBetween(reDelDate, delDate) : 0;
    hirePeriods = [{
      ...EMPTY_HIRE,
      delDate,
      reDelDate,
      days: daysFromDates
        ? daysFromDates.toFixed(4)
        : (base.tcDays || ''),
      hireRate: String(hireRate || ''),
    }];
  } else {
    hirePeriods = hirePeriods.map((row) => {
      if (row.delDate && row.reDelDate) {
        const days = daysBetween(row.reDelDate, row.delDate);
        const amount = days * (Number(row.hireRate) || 0);
        return {
          ...row,
          days: days ? days.toFixed(4) : '0.0000',
          amount: amount.toFixed(2),
        };
      }
      return row;
    });
  }

  const deliveryBunkers = (base.deliveryBunkers?.length
    ? base.deliveryBunkers
    : detail?.deliveryBunkers?.length
      ? detail.deliveryBunkers
      : [EMPTY_BUNKER]).map((row) => ({ ...EMPTY_BUNKER, ...row }));

  const redeliveryBunkers = (base.redeliveryBunkers?.length
    ? base.redeliveryBunkers
    : detail?.redeliveryBunkers?.length
      ? detail.redeliveryBunkers
      : [EMPTY_BUNKER]).map((row) => ({ ...EMPTY_BUNKER, ...row }));

  return {
    calc: {
      tripTc: base.tripTc || detail?.tripTc || '',
      period: base.period || detail?.period || '',
      noOfTrip: base.noOfTrip || detail?.noOfTrip || '',
      cpDate: base.cpDate || detail?.cpDate || '',
      cpType: base.cpType || detail?.cpType || '',
      charterers: base.charterers || detail?.charterer || '',
      dailyGrossHire: dailyGross,
      hireFixPer: detail?.hireFixPer || '',
      exchangeCurrency: base.exchangeCurrency || detail?.exchangeCurrency || 'USD',
      exchangeRate: base.exchangeRate || detail?.exchangeRate || '1',
      addCommPct: base.addCommPct || detail?.addComm || '0',
      brokerCommPct: base.brokerCommPct || detail?.brokerComm || '0',
      ballastBonus: base.ballastBonus || '0',
      cveMonth: base.cveMonth || detail?.cveMonth || '0',
      ilohcAmt: base.ilohcAmt || detail?.ilohcUsd || '0',
      delHfoMt: base.delHfoMt || '',
      delHfoUsd: base.delHfoUsd || '',
      delMgoMt: base.delMgoMt || '',
      delMgoUsd: base.delMgoUsd || '',
      reDelHfoMt: base.reDelHfoMt || '',
      reDelHfoUsd: base.reDelHfoUsd || '',
      reDelMgoMt: base.reDelMgoMt || '',
      reDelMgoUsd: base.reDelMgoUsd || '',
      tcFinalHireage: base.tcFinalHireage || '',
      totalExp: base.totalExp || '',
      tcDeliveryPort: base.tcDeliveryPort || detail?.delRangePort || '',
      tcRedeliveryPort: base.tcRedeliveryPort || detail?.reDelRange || '',
      tcCpNumber: base.tcCpNumber || detail?.tcNo || '',
    },
    hirePeriods,
    deliveryBunkers,
    redeliveryBunkers,
    otherIncome: detail?.otherIncome?.length
      ? detail.otherIncome.map((row) => ({ ...EMPTY_INCOME, ...row }))
      : [{ ...EMPTY_INCOME }],
    otherExpenses: detail?.otherExpenses?.length
      ? detail.otherExpenses.map((row) => ({ ...EMPTY_EXPENSE, ...row }))
      : [{ ...EMPTY_EXPENSE }],
    offHires: detail?.offHires?.length
      ? detail.offHires.map((row) => ({ ...EMPTY_OFF, ...row }))
      : [{ ...EMPTY_OFF }],
    itinerary: {
      from: { place: '', date: '', notes: '', ...(detail?.itinerary?.from || {}) },
      to: { place: '', date: '', notes: '', ...(detail?.itinerary?.to || {}) },
    },
    itineraryExpenses: detail?.itineraryExpenses?.length
      ? detail.itineraryExpenses.map((row) => ({ ...EMPTY_ITIN_EXP, ...row }))
      : [{ ...EMPTY_ITIN_EXP }],
    tcInExpenses: detail?.tcInExpenses
      ? {
          ...emptyTcIn(detail, base),
          ...detail.tcInExpenses,
          hires: detail.tcInExpenses.hires?.length
            ? detail.tcInExpenses.hires.map((row) => ({ ...EMPTY_TC_IN_HIRE, ...row }))
            : emptyTcIn(detail, base).hires,
          deliveryBunkers: detail.tcInExpenses.deliveryBunkers?.length
            ? detail.tcInExpenses.deliveryBunkers.map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }))
            : [{ ...EMPTY_TC_IN_BUNKER }],
          redeliveryBunkers: detail.tcInExpenses.redeliveryBunkers?.length
            ? detail.tcInExpenses.redeliveryBunkers.map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }))
            : [{ ...EMPTY_TC_IN_BUNKER }],
          offHires: detail.tcInExpenses.offHires?.length
            ? detail.tcInExpenses.offHires.map((row) => ({ ...EMPTY_TC_IN_OFF, ...row }))
            : [{ ...EMPTY_TC_IN_OFF }],
        }
      : emptyTcIn(detail, base),
  };
}

function updateRow(list, index, patch) {
  const next = [...list];
  next[index] = { ...next[index], ...patch };
  return next;
}

export default function TcCalculatePage({
  initialDetail = null,
  overrideTcOutId = null,
  readOnly: readOnlyProp = null,
  listHref: listHrefProp = null,
  pageTitle = null,
  onSave = null,
  hideEditFixture = false,
  saveLabel = 'Save Calculation',
} = {}) {
  const navigate = useNavigate();
  const { tcPath } = useTcModule();
  const { tcOutId: paramTcOutId } = useParams();
  const [searchParams] = useSearchParams();
  const tcOutId = overrideTcOutId || paramTcOutId;
  const readOnly = readOnlyProp != null
    ? Boolean(readOnlyProp)
    : searchParams.get('mode') === 'view';
  const [detail, setDetail] = useState(initialDetail);
  const [lookups, setLookups] = useState(null);
  const [form, setForm] = useState(null);
  const [tcInOpen, setTcInOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const listHref = listHrefProp
    || (searchParams.get('from') === 'ops-tc'
      ? appPath('/internal-user/vc/ops-tc/in-ops-glance')
      : tcPath());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const lookupData = await fetchTcLookups();
        if (cancelled) return;
        setLookups(lookupData);

        let estimate = initialDetail;
        if (!estimate) {
          if (!tcOutId) {
            throw new Error('Estimate id is required.');
          }
          estimate = await fetchTcEstimate(tcOutId);
        }
        if (cancelled) return;
        setDetail(estimate);
        let nextForm = initFromDetail(estimate);
        // PHP loadPeriodDetails(): when PERIODID set and no saved TC In rows, seed from period contract.
        if (estimate?.periodId && !hasSavedTcInHires(estimate.tcInExpenses)) {
          try {
            const periodTcIn = await fetchPeriodTcInDetails(estimate.periodId);
            if (!cancelled && periodTcIn) {
              nextForm = {
                ...nextForm,
                tcInExpenses: applyPeriodTcIn(nextForm.tcInExpenses, periodTcIn),
              };
            }
          } catch {
            // Keep fixture-seeded TC In if period lookup fails.
          }
        }
        if (!cancelled) setForm(nextForm);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load calculation.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // initialDetail is provided by Ops cost-sheet wrapper; remount via key when sheet changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid reloading on new object identity
  }, [tcOutId]);

  const incomeTotal = useMemo(
    () => (form?.otherIncome || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [form?.otherIncome],
  );
  const expenseTotal = useMemo(
    () => (form?.otherExpenses || [])
      .filter((row) => row.addToTotal !== false)
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [form?.otherExpenses],
  );
  const tcInFinalHireage = useMemo(() => {
    if (!form?.tcInExpenses) return Number(form?.calc?.tcFinalHireage) || 0;
    const resolved = calcTcInFinalHireage(form.tcInExpenses);
    const live = Number(resolved.finalHireage) || 0;
    // Prefer live calc; fall back to saved TC_FINAL_HIERAGE when seed is empty.
    return live || Number(form.calc?.tcFinalHireage) || 0;
  }, [form?.tcInExpenses, form?.calc?.tcFinalHireage]);
  const totalExpenses = useMemo(() => {
    const live = expenseTotal + tcInFinalHireage;
    // Fall back to saved TOTAL_EXP_EST when live components are still empty (matches PHP DB value).
    return live || Number(form?.calc?.totalExp) || 0;
  }, [expenseTotal, tcInFinalHireage, form?.calc?.totalExp]);
  const itineraryExpenseTotal = useMemo(
    () => (form?.itineraryExpenses || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [form?.itineraryExpenses],
  );

  const totals = useMemo(() => {
    if (!form) return {};
    return calcTcTotals({
      ...form.calc,
      hirePeriods: form.hirePeriods,
      deliveryBunkers: form.deliveryBunkers,
      redeliveryBunkers: form.redeliveryBunkers,
      offHires: form.offHires,
      otherIncome: incomeTotal,
      totalExp: totalExpenses,
    });
  }, [form, incomeTotal, totalExpenses]);

  const setCalcField = (key, value) => {
    setForm((prev) => ({ ...prev, calc: { ...prev.calc, [key]: value } }));
  };

  const patchHirePeriod = (index, patch) => {
    setForm((prev) => {
      const next = updateRow(prev.hirePeriods, index, patch);
      const row = next[index];
      if (row.delDate && row.reDelDate) {
        const days = daysBetween(row.reDelDate, row.delDate);
        const amount = days * (Number(row.hireRate) || 0);
        next[index] = {
          ...row,
          days: days ? days.toFixed(4) : '',
          amount: amount.toFixed(2),
        };
      }
      return { ...prev, hirePeriods: next };
    });
  };

  const patchBunker = (side, index, patch) => {
    const key = side === 'del' ? 'deliveryBunkers' : 'redeliveryBunkers';
    setForm((prev) => {
      const next = updateRow(prev[key], index, patch);
      const row = next[index];
      const amount = (Number(row.qty) || 0) * (Number(row.price) || 0);
      next[index] = { ...row, amount: amount ? amount.toFixed(2) : '' };
      return { ...prev, [key]: next };
    });
  };

  const patchOffHire = (index, patch) => {
    setForm((prev) => {
      const next = updateRow(prev.offHires, index, patch);
      const row = next[index];
      let days = Number(row.days) || 0;
      const hasFrom = row.from != null && String(row.from).trim() !== '';
      if (hasFrom && row.to) {
        days = daysBetween(row.to, row.from);
      }
      const amount = days * (Number(row.hireRate) || 0);
      next[index] = {
        ...row,
        days: days ? days.toFixed(4) : row.days,
        amount: amount.toFixed(2),
      };
      return { ...prev, offHires: next };
    });
  };

  const buildSavePayload = () => {
    const first = form.hirePeriods[0] || {};
    return {
      calc: {
        ...form.calc,
        ...totals,
        delDate: first.delDate || '',
        reDelDate: first.reDelDate || '',
        otherIncome: String(incomeTotal),
        totalExp: String(totalExpenses),
        deliveryBunkers: form.deliveryBunkers,
        redeliveryBunkers: form.redeliveryBunkers,
        hirePeriods: totals.hirePeriods || form.hirePeriods,
        tcCpDate: form.tcInExpenses?.cpDate || '',
        tcCpNumber: form.tcInExpenses?.contractRef || form.calc.tcCpNumber || '',
        tcDeliveryPort: form.tcInExpenses?.deliveryPort || form.calc.tcDeliveryPort || '',
        tcRedeliveryPort: form.tcInExpenses?.redeliveryPort || form.calc.tcRedeliveryPort || '',
        tcFinalHireage: String(tcInFinalHireage.toFixed(2)),
        tcFinalVendor: form.tcInExpenses?.finalVendor || '',
        tcOffHireCveMonth: form.tcInExpenses?.offHireCveMonth || '',
        tcOffHireCveAmt: form.tcInExpenses?.offHireCveAmt || '',
        tcBunkerOnOwner: form.tcInExpenses?.bunkerOnOwner || '',
        tcLessOffHire: form.tcInExpenses?.lessOffHire || '',
        tcIlohc: form.tcInExpenses?.ilohc || '',
        awrpCost: form.tcInExpenses?.awrpCost || '',
      },
      hirePeriods: totals.hirePeriods || form.hirePeriods,
      otherIncome: form.otherIncome,
      otherExpenses: form.otherExpenses,
      offHires: form.offHires,
      itinerary: form.itinerary,
      itineraryExpenses: form.itineraryExpenses,
      tcInExpenses: form.tcInExpenses,
      deliveryBunkers: form.deliveryBunkers,
      redeliveryBunkers: form.redeliveryBunkers,
      totals,
      incomeTotal,
      totalExpenses,
      tcInFinalHireage,
      form,
      detail,
    };
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError('');
    try {
      const payload = buildSavePayload();
      if (onSave) {
        await onSave(payload);
      } else {
        await saveTcCalculation(tcOutId, {
          calc: payload.calc,
          hirePeriods: payload.hirePeriods,
          otherIncome: payload.otherIncome,
          otherExpenses: payload.otherExpenses,
          offHires: payload.offHires,
          itinerary: payload.itinerary,
          itineraryExpenses: payload.itineraryExpenses,
          tcInExpenses: payload.tcInExpenses,
        });
        navigate(`${tcPath()}?msg=0`);
      }
    } catch (err) {
      setError(err.message || 'Failed to save calculation.');
    } finally {
      setSaving(false);
    }
  };

  if (!form && loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay active label="Loading calculation…" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        {error ? <div className={styles.error}>{error}</div> : null}
      </div>
    );
  }

  const titleText = pageTitle
    || `${readOnly ? 'View Estimate' : 'Edit Estimate'}${detail?.tcNo ? ` — ${detail.tcNo}` : ''}`;

  return (
    <div className={`zafira-page ${styles.page}`}>
      <TcFormHeaderActions listHref={listHref} disabled={saving} />
      {loading ? <LoadingOverlay active label="Loading calculation…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      <h3 className={styles.title}>{titleText}</h3>

      <form onSubmit={handleSave}>
        <div className={readOnly ? styles.viewModeLock : undefined}>
        <div className={styles.headerBar}>
          <div className={styles.field}>
            <label>Fixture Type</label>
            <div className={styles.fieldRead}>{lookupName(lookups?.fixtureTypes, detail?.fixtureType) || 'TC Out'}</div>
          </div>
          <div className={styles.field}>
            <label>Vessel</label>
            <div className={styles.fieldRead}>{detail?.vesselName || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>Type</label>
            <div className={styles.fieldRead}>{detail?.vesselType || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>Flag</label>
            <div className={styles.fieldRead}>{detail?.flag || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>Date</label>
            <div className={styles.fieldRead}>{detail?.tcDate || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>TC No.</label>
            <div className={styles.fieldRead}>{detail?.tcNo || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>CP Date</label>
            <div className={styles.fieldRead}>{detail?.cpDate || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>CP Type</label>
            <div className={styles.fieldRead}>{lookupName(lookups?.cpTypes, detail?.cpType) || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>Trip TC</label>
            <div className={styles.fieldRead}>{form.calc.tripTc || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>Period</label>
            <div className={styles.fieldRead}>{form.calc.period || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>No. Of Trips</label>
            <div className={styles.fieldRead}>{form.calc.noOfTrip || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>Charterers</label>
            <div className={styles.fieldRead}>{lookupName(lookups?.charterers, detail?.charterer) || '—'}</div>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Estimates — Hire Periods</h4>
          <table className={styles.rowTable}>
            <thead>
              <tr>
                <th />
                <th>Del Date/Time</th>
                <th>Re Del Date/Time</th>
                <th>TC Days</th>
                <th>Hire Rate (USD)</th>
                <th>Hire Income Amount (USD)</th>
              </tr>
            </thead>
            <tbody>
              {form.hirePeriods.map((row, index) => (
                <tr key={`hire-${index}`}>
                  <td>
                    <button
                      type="button"
                      className={styles.linkBtnDanger}
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        hirePeriods: prev.hirePeriods.length > 1
                          ? prev.hirePeriods.filter((_, i) => i !== index)
                          : [{ ...EMPTY_HIRE }],
                      }))}
                    >
                      ×
                    </button>
                  </td>
                  <td>
                    <DmyDateInput
                      enableTime
                      value={row.delDate}
                      onChange={(value) => patchHirePeriod(index, { delDate: value })}
                    />
                  </td>
                  <td>
                    <DmyDateInput
                      enableTime
                      value={row.reDelDate}
                      onChange={(value) => patchHirePeriod(index, { reDelDate: value })}
                    />
                  </td>
                  <td><input className={styles.inputReadonly} readOnly value={row.days || totals.hirePeriods?.[index]?.days || ''} /></td>
                  <td>
                    <input
                      value={row.hireRate}
                      onChange={(e) => patchHirePeriod(index, { hireRate: e.target.value })}
                    />
                  </td>
                  <td><input className={styles.inputReadonly} readOnly value={row.amount || totals.hirePeriods?.[index]?.amount || ''} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            variant="outline"
            label="Add"
            onClick={() => setForm((prev) => ({ ...prev, hirePeriods: [...prev.hirePeriods, { ...EMPTY_HIRE }] }))}
          />
        </div>

        <div className={styles.fixtureLayout}>
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Delivery Bunkers</h4>
            <BunkerTable
              rows={form.deliveryBunkers}
              bunkers={lookups?.bunkers}
              onChange={(index, patch) => patchBunker('del', index, patch)}
              onRemove={(index) => setForm((prev) => ({
                ...prev,
                deliveryBunkers: prev.deliveryBunkers.length > 1
                  ? prev.deliveryBunkers.filter((_, i) => i !== index)
                  : [{ ...EMPTY_BUNKER }],
              }))}
            />
            <Button
              variant="outline"
              label="Add"
              onClick={() => setForm((prev) => ({
                ...prev,
                deliveryBunkers: [...prev.deliveryBunkers, { ...EMPTY_BUNKER }],
              }))}
            />
            <div className={styles.muted}>Total: {totals.delBunkerTotal || '0.00'}</div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Redelivery Bunkers</h4>
            <BunkerTable
              rows={form.redeliveryBunkers}
              bunkers={lookups?.bunkers}
              onChange={(index, patch) => patchBunker('redel', index, patch)}
              onRemove={(index) => setForm((prev) => ({
                ...prev,
                redeliveryBunkers: prev.redeliveryBunkers.length > 1
                  ? prev.redeliveryBunkers.filter((_, i) => i !== index)
                  : [{ ...EMPTY_BUNKER }],
              }))}
            />
            <Button
              variant="outline"
              label="Add"
              onClick={() => setForm((prev) => ({
                ...prev,
                redeliveryBunkers: [...prev.redeliveryBunkers, { ...EMPTY_BUNKER }],
              }))}
            />
            <div className={styles.muted}>Total: {totals.reDelBunkerTotal || '0.00'}</div>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Off Hire</h4>
          <table className={styles.rowTable}>
            <thead>
              <tr>
                <th />
                <th>Reason</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Rate/Day</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {form.offHires.map((row, index) => (
                <tr key={`off-${index}`}>
                  <td>
                    <button
                      type="button"
                      className={styles.linkBtnDanger}
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        offHires: prev.offHires.length > 1
                          ? prev.offHires.filter((_, i) => i !== index)
                          : [{ ...EMPTY_OFF }],
                      }))}
                    >
                      ×
                    </button>
                  </td>
                  <td><textarea rows={2} value={row.reason} onChange={(e) => patchOffHire(index, { reason: e.target.value })} /></td>
                  <td><DmyDateInput enableTime value={row.from} onChange={(value) => patchOffHire(index, { from: value })} /></td>
                  <td><DmyDateInput enableTime value={row.to} onChange={(value) => patchOffHire(index, { to: value })} /></td>
                  <td><input value={row.days} onChange={(e) => patchOffHire(index, { days: e.target.value })} /></td>
                  <td><input value={row.hireRate} onChange={(e) => patchOffHire(index, { hireRate: e.target.value })} /></td>
                  <td><input className={styles.inputReadonly} readOnly value={row.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            variant="outline"
            label="Add"
            onClick={() => setForm((prev) => ({ ...prev, offHires: [...prev.offHires, { ...EMPTY_OFF }] }))}
          />
        </div>

        <div className={`${styles.fixtureLayout} ${styles.calculationLayout}`}>
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Revenue Calculations — USD</h4>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Hire PDPR Currency</label>
                <input className={styles.inputReadonly} readOnly value={form.calc.exchangeCurrency} />
              </div>
              <div className={styles.field}>
                <label>Exchange Rate To USD</label>
                <input className={styles.inputReadonly} readOnly value={form.calc.exchangeRate} />
              </div>
              <div className={styles.field}>
                <label>Hire Fixed Period PDPR</label>
                <input className={styles.inputReadonly} readOnly value={form.calc.hireFixPer} />
              </div>
              <div className={styles.field}>
                <label>Hire Fixed Period PDPR (USD)</label>
                <input className={styles.inputReadonly} readOnly value={form.calc.dailyGrossHire} />
              </div>
              <div className={styles.field}>
                <label>Ballast Bonus (USD)</label>
                <input value={form.calc.ballastBonus} onChange={(e) => setCalcField('ballastBonus', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label>Add Comm (%)</label>
                <div className={styles.pairFields}>
                  <input value={form.calc.addCommPct} onChange={(e) => setCalcField('addCommPct', e.target.value)} />
                  <input className={styles.inputReadonly} readOnly value={totals.addCommAmt || ''} />
                </div>
              </div>
              <div className={styles.field}>
                <label>Charterers side Broker Comm. (%)</label>
                <div className={styles.pairFields}>
                  <input className={styles.inputReadonly} readOnly value={form.calc.brokerCommPct} />
                  <input className={styles.inputReadonly} readOnly value={totals.brokerCommAmt || ''} />
                </div>
              </div>
              <div className={styles.field}>
                <label>Net Hire (USD)</label>
                <input className={styles.inputReadonly} readOnly value={totals.nettHire || ''} />
              </div>
              <div className={styles.field}>
                <label>Net Rev (USD)</label>
                <input className={styles.inputReadonly} readOnly value={totals.nettRev || ''} />
              </div>
              <div className={styles.field}>
                <label>Less Off hire</label>
                <input className={styles.inputReadonly} readOnly value={totals.lessOffHire || ''} />
              </div>
              <div className={styles.field}>
                <label>CVE (USD/Month)</label>
                <div className={styles.pairFields}>
                  <input className={styles.inputReadonly} readOnly value={form.calc.cveMonth} />
                  <input className={styles.inputReadonly} readOnly value={totals.cve || ''} />
                </div>
              </div>
              <div className={styles.field}>
                <label>ILOHC (USD)</label>
                <input value={form.calc.ilohcAmt} onChange={(e) => setCalcField('ilohcAmt', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label>Bunker Difference</label>
                <input className={styles.inputReadonly} readOnly value={totals.bunkerDiffAmt || ''} />
              </div>
              <div className={styles.field}>
                <label>Net Hire to invoice (USD)</label>
                <input className={styles.inputReadonly} readOnly value={totals.nettHireInvoice || ''} />
              </div>
            </div>

            <h4 className={styles.sectionTitle}>Other Income</h4>
            <table className={styles.rowTable}>
              <thead><tr><th /><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {form.otherIncome.map((row, index) => (
                  <tr key={`inc-${index}`}>
                    <td>
                      <button
                        type="button"
                        className={styles.linkBtnDanger}
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          otherIncome: prev.otherIncome.length > 1
                            ? prev.otherIncome.filter((_, i) => i !== index)
                            : [{ ...EMPTY_INCOME }],
                        }))}
                      >
                        ×
                      </button>
                    </td>
                    <td>
                      <input
                        value={row.description}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          otherIncome: updateRow(prev.otherIncome, index, { description: e.target.value }),
                        }))}
                      />
                    </td>
                    <td>
                      <input
                        value={row.amount}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          otherIncome: updateRow(prev.otherIncome, index, { amount: e.target.value }),
                        }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              variant="outline"
              label="Add"
              onClick={() => setForm((prev) => ({
                ...prev,
                otherIncome: [...prev.otherIncome, { ...EMPTY_INCOME }],
              }))}
            />
            <div className={styles.formGrid} style={{ marginTop: 12 }}>
              <div className={styles.field}>
                <label>Total Rev</label>
                <input className={styles.inputReadonly} readOnly value={totals.totalRev || ''} />
              </div>
              <div className={styles.field}>
                <label>Utilisation Days</label>
                <input className={styles.inputReadonly} readOnly value={totals.utilisationDays || ''} />
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Pre Contractual Details</h4>
            <h5 className={styles.subsectionTitle}>Itinerary</h5>
            <div className={styles.itinRow}>
              <div className={styles.field}>
                <label>From</label>
                <input
                  value={form.itinerary.from.place}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    itinerary: { ...prev.itinerary, from: { ...prev.itinerary.from, place: e.target.value } },
                  }))}
                />
              </div>
              <div className={styles.field}>
                <label>Date</label>
                <DmyDateInput
                  value={form.itinerary.from.date}
                  onChange={(value) => setForm((prev) => ({
                    ...prev,
                    itinerary: { ...prev.itinerary, from: { ...prev.itinerary.from, date: value } },
                  }))}
                />
              </div>
              <div className={styles.field}>
                <label>Notes</label>
                <textarea
                  rows={1}
                  value={form.itinerary.from.notes}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    itinerary: { ...prev.itinerary, from: { ...prev.itinerary.from, notes: e.target.value } },
                  }))}
                />
              </div>
            </div>
            <div className={styles.itinRow}>
              <div className={styles.field}>
                <label>To</label>
                <input
                  value={form.itinerary.to.place}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    itinerary: { ...prev.itinerary, to: { ...prev.itinerary.to, place: e.target.value } },
                  }))}
                />
              </div>
              <div className={styles.field}>
                <label>Date</label>
                <DmyDateInput
                  value={form.itinerary.to.date}
                  onChange={(value) => setForm((prev) => ({
                    ...prev,
                    itinerary: { ...prev.itinerary, to: { ...prev.itinerary.to, date: value } },
                  }))}
                />
              </div>
              <div className={styles.field}>
                <label>Notes</label>
                <textarea
                  rows={1}
                  value={form.itinerary.to.notes}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    itinerary: { ...prev.itinerary, to: { ...prev.itinerary.to, notes: e.target.value } },
                  }))}
                />
              </div>
            </div>

            <h4 className={styles.sectionTitle}>EXPENSES</h4>
            <table className={styles.rowTable}>
              <thead>
                <tr><th /><th>Expense Type</th><th>Description</th><th>Amount</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {form.itineraryExpenses.map((row, index) => (
                  <tr key={`itin-exp-${index}`}>
                    <td>
                      <button
                        type="button"
                        className={styles.linkBtnDanger}
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          itineraryExpenses: prev.itineraryExpenses.length > 1
                            ? prev.itineraryExpenses.filter((_, i) => i !== index)
                            : [{ ...EMPTY_ITIN_EXP }],
                        }))}
                      >
                        ×
                      </button>
                    </td>
                    <td>
                      <input
                        value={row.expenseType}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          itineraryExpenses: updateRow(prev.itineraryExpenses, index, { expenseType: e.target.value }),
                        }))}
                      />
                    </td>
                    <td>
                      <input
                        value={row.description}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          itineraryExpenses: updateRow(prev.itineraryExpenses, index, { description: e.target.value }),
                        }))}
                      />
                    </td>
                    <td>
                      <input
                        value={row.amount}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          itineraryExpenses: updateRow(prev.itineraryExpenses, index, { amount: e.target.value }),
                        }))}
                      />
                    </td>
                    <td>
                      <input
                        value={row.notes}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          itineraryExpenses: updateRow(prev.itineraryExpenses, index, { notes: e.target.value }),
                        }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.muted}>Total (USD): {itineraryExpenseTotal.toFixed(2)}</div>
            <Button
              variant="outline"
              label="Add"
              onClick={() => setForm((prev) => ({
                ...prev,
                itineraryExpenses: [...prev.itineraryExpenses, { ...EMPTY_ITIN_EXP }],
              }))}
            />

            <h4 className={styles.sectionTitle}>TC Expense</h4>
            <table className={styles.rowTable}>
              <thead>
                <tr><th /><th>Type</th><th>Description</th><th>Add to TTL</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {form.otherExpenses.map((row, index) => (
                  <tr key={`exp-${index}`}>
                    <td>
                      <button
                        type="button"
                        className={styles.linkBtnDanger}
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          otherExpenses: prev.otherExpenses.length > 1
                            ? prev.otherExpenses.filter((_, i) => i !== index)
                            : [{ ...EMPTY_EXPENSE }],
                        }))}
                      >
                        ×
                      </button>
                    </td>
                    <td>
                      <select
                        value={row.expenseTypeId || ''}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          otherExpenses: updateRow(prev.otherExpenses, index, { expenseTypeId: e.target.value }),
                        }))}
                      >
                        <option value="">Select</option>
                        {(lookups?.expenseTypes || []).map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={row.description || ''}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          otherExpenses: updateRow(prev.otherExpenses, index, { description: e.target.value }),
                        }))}
                      />
                    </td>
                    <td className={styles.center}>
                      <input
                        type="checkbox"
                        checked={row.addToTotal !== false}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          otherExpenses: updateRow(prev.otherExpenses, index, { addToTotal: e.target.checked }),
                        }))}
                      />
                    </td>
                    <td>
                      <input
                        value={row.amount || ''}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          otherExpenses: updateRow(prev.otherExpenses, index, { amount: e.target.value }),
                        }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              variant="outline"
              label="Add"
              onClick={() => setForm((prev) => ({
                ...prev,
                otherExpenses: [...prev.otherExpenses, { ...EMPTY_EXPENSE }],
              }))}
            />

            <div className={`${styles.tcInButtonRow} ${styles.viewModeAllow}`}>
              <strong>TC In Expenses</strong>
              <Button
                variant="outline"
                label={readOnly ? 'View TC In Expenses' : 'TC In Expenses'}
                onClick={() => setTcInOpen(true)}
              />
              {tcInFinalHireage ? (
                <span className={styles.muted}>Final Hire-age: {tcInFinalHireage.toFixed(2)}</span>
              ) : null}
            </div>

            <div className={styles.formGrid} style={{ marginTop: 16 }}>
              <div className={styles.field}>
                <label>Total Expenses</label>
                <input className={styles.inputReadonly} readOnly value={totalExpenses.toFixed(2)} />
              </div>
              <div className={styles.field}>
                <label>TC Earnings</label>
                <input className={styles.inputReadonly} readOnly value={totals.voyageEarn || ''} />
              </div>
              <div className={styles.field}>
                <label>Profit / Day</label>
                <input className={styles.inputReadonly} readOnly value={totals.profitPerDay || ''} />
              </div>
            </div>
          </div>
        </div>
        </div>

        <div className={styles.formActions}>
          {!readOnly ? (
            <>
              <Button type="submit" label={saving ? 'Saving…' : saveLabel} disabled={saving} />
              {!hideEditFixture && tcOutId ? (
                <Button variant="outline" label="Edit Fixture" href={tcPath(`${tcOutId}/edit`)} disabled={saving} />
              ) : null}
            </>
          ) : null}
          <Button variant="outline" label={readOnly ? 'Back' : 'Cancel'} href={listHref} disabled={saving} />
        </div>
      </form>

      <TcInExpensesModal
        open={tcInOpen}
        value={form.tcInExpenses}
        detail={detail}
        lookups={lookups}
        readOnly={readOnly}
        onClose={() => setTcInOpen(false)}
        onApply={(next) => {
          if (readOnly) return;
          setForm((prev) => ({ ...prev, tcInExpenses: next }));
          setTcInOpen(false);
        }}
      />
    </div>
  );
}

function BunkerTable({ rows, bunkers, onChange, onRemove }) {
  const optionsFor = (selectedId) => {
    const list = (bunkers || []).map((opt) => ({ id: String(opt.id), name: opt.name }));
    const selected = selectedId != null && String(selectedId).trim() !== '' ? String(selectedId) : '';
    if (selected && !list.some((opt) => opt.id === selected)) {
      list.unshift({ id: selected, name: `Grade #${selected}` });
    }
    return list;
  };

  return (
    <table className={styles.rowTable}>
      <thead>
        <tr>
          <th />
          <th>Bunker Grade</th>
          <th>Qty (MT)</th>
          <th>Bunker Date</th>
          <th>Price USD/MT</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const selectedId = row.bunkerId != null ? String(row.bunkerId) : '';
          return (
            <tr key={`bunker-${index}`}>
              <td>
                <button type="button" className={styles.linkBtnDanger} onClick={() => onRemove(index)}>×</button>
              </td>
              <td>
                <select value={selectedId} onChange={(e) => onChange(index, { bunkerId: e.target.value })}>
                  <option value="">Select</option>
                  {optionsFor(selectedId).map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </td>
              <td><input value={row.qty || ''} onChange={(e) => onChange(index, { qty: e.target.value })} /></td>
              <td><DmyDateInput value={row.bunkerDate || ''} onChange={(value) => onChange(index, { bunkerDate: value })} /></td>
              <td><input value={row.price || ''} onChange={(e) => onChange(index, { price: e.target.value })} /></td>
              <td><input className={styles.inputReadonly} readOnly value={row.amount || ''} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
