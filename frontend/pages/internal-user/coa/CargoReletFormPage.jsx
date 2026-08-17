import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import { useCoaModule } from '../../../hooks/useCoaModule.js';
import {
  createCargoRelet,
  fetchCargoRelet,
  fetchCoaLookups,
  fetchRunningCoas,
  updateCargoRelet,
} from '../../../services/coas.js';
import { calcCargoReletTotals } from './cargoReletTotals.js';
import CoaCardSelect from './CoaCardSelect.jsx';
import CoaFormHeaderActions from './CoaFormHeaderActions.jsx';
import styles from './CoaPages.module.css';

function partyRow() {
  return { charterer: '', owner: '', broker: '' };
}

function portRow() {
  return { portId: '', comments: '' };
}

function emptyForm(businessTypeId = '2', coaId = '') {
  return {
    coaId,
    openCargoId: '',
    updateStatus: '1',
    vesselImoId: '',
    transDate: '',
    reletNo: '',
    reletName: '',
    vesselType: '',
    cargoQty: '',
    freightUsd: '',
    bafUsd: '',
    freightFrom: '',
    freightTo: '',
    addCom: '',
    brokerage: '',
    demRate: '',
    desRate: '',
    contractFoPrice: '',
    currentFoPrice: '',
    freightUsdOut: '',
    bafUsdOut: '',
    freightFromOut: '',
    freightToOut: '',
    addComOut: '',
    brokerageOut: '',
    demRateOut: '',
    desRateOut: '',
    paymentClause: '',
    bunkerClause: '',
    paymentClauseOut: '',
    bunkerClauseOut: '',
    freightAmt: '',
    bunkerSurchargeAmt: '',
    demmurageAmt: '',
    despatchAmt: '',
    addCommAmt: '',
    brokerageAmt: '',
    totalAmt: '',
    profit: '',
    freightAmtOut: '',
    bunkerSurchargeAmtOut: '',
    demmurageAmtOut: '',
    despatchAmtOut: '',
    addCommAmtOut: '',
    brokerageAmtOut: '',
    totalAmtOut: '',
    coaRef: '',
    loadportAgent: '',
    loadportRemarks: '',
    disportAgent: '',
    disportRemarks: '',
    notices: '',
    dA: '',
    extraInsurance: '',
    minTerm: '',
    spclComments: '',
    nomProc: '',
    coaRefOut: '',
    loadportAgentOut: '',
    loadportRemarksOut: '',
    disportAgentOut: '',
    disportRemarksOut: '',
    noticesOut: '',
    dAOut: '',
    extraInsuranceOut: '',
    minTermOut: '',
    spclCommentsOut: '',
    nomProcOut: '',
    businessTypeId,
    partiesIn: [partyRow()],
    partiesOut: [partyRow()],
    loadPortsIn: [portRow()],
    dischargePortsIn: [portRow()],
    loadPortsOut: [portRow()],
    dischargePortsOut: [portRow()],
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

export default function CargoReletFormPage({ mode = 'edit' }) {
  const { fcaId } = useParams();
  const navigate = useNavigate();
  const { coaPath } = useCoaModule();
  const [searchParams] = useSearchParams();
  const isAdd = mode === 'add' || !fcaId;
  const [lookups, setLookups] = useState(null);
  const [coaOptions, setCoaOptions] = useState([]);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [form, setForm] = useState(() => emptyForm(
    searchParams.get('selBType') || '2',
    searchParams.get('coaId') || '',
  ));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const bType = searchParams.get('selBType') || '2';
        const [lookupData, types, coas] = await Promise.all([
          fetchCoaLookups(),
          fetchVcBusinessTypes(bType),
          fetchRunningCoas({ selBType: bType, status: '1', page: 1, pageSize: 200 }),
        ]);
        if (cancelled) return;
        setLookups(lookupData);
        setBusinessTypes(types);
        setCoaOptions((coas.records || []).map((row) => ({
          id: String(row.coaId),
          name: `${row.coaIdentity} / ${row.coaNo}`,
        })));
        if (!isAdd) {
          const detail = await fetchCargoRelet(fcaId);
          if (cancelled) return;
          if (!detail) throw new Error('Cargo relet not found.');
          setForm({
            ...emptyForm(detail.businessTypeId),
            ...detail,
            partiesIn: detail.partiesIn?.length ? detail.partiesIn : [partyRow()],
            partiesOut: detail.partiesOut?.length ? detail.partiesOut : [partyRow()],
            loadPortsIn: detail.loadPortsIn?.length ? detail.loadPortsIn : [portRow()],
            dischargePortsIn: detail.dischargePortsIn?.length ? detail.dischargePortsIn : [portRow()],
            loadPortsOut: detail.loadPortsOut?.length ? detail.loadPortsOut : [portRow()],
            dischargePortsOut: detail.dischargePortsOut?.length ? detail.dischargePortsOut : [portRow()],
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load cargo relet form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fcaId, isAdd, searchParams]);

  const vessels = useMemo(
    () => (lookups?.vessels || []).filter(
      (item) => !item.businessTypeId || item.businessTypeId === form.businessTypeId,
    ),
    [form.businessTypeId, lookups],
  );

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const recalculate = () => {
    setForm((prev) => ({ ...prev, ...calcCargoReletTotals(prev) }));
  };

  const persist = async (updateStatus) => {
    if (!form.coaId) {
      setError('Please select a COA.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const totals = calcCargoReletTotals(form);
      const payload = { ...form, ...totals, updateStatus };
      if (isAdd) await createCargoRelet(payload);
      else await updateCargoRelet(fcaId, payload);
      navigate(`${coaPath('cargo-relet')}?selBType=${form.businessTypeId}`);
    } catch (err) {
      setError(err.message || 'Failed to save cargo relet.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    await persist('1');
  };

  const renderPartyTable = (key, label) => (
    <>
      <div className={styles.sectionTitle}>{label}</div>
      <table className={styles.nestedTable}>
        <thead>
          <tr>
            <th>Charterer</th>
            <th>Owner</th>
            <th>Broker</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(form[key] || []).map((row, index) => (
            <tr key={`${key}-${index}`}>
              {['charterer', 'owner', 'broker'].map((field) => (
                <td key={field}>
                  <CoaCardSelect
                    label={field}
                    value={row[field]}
                    options={
                      lookups?.[field === 'broker' ? 'brokers' : field === 'owner' ? 'owners' : 'charterers'] || []
                    }
                    onChange={(value) => {
                      const next = [...form[key]];
                      next[index] = { ...next[index], [field]: value };
                      patch(key, next);
                    }}
                  />
                </td>
              ))}
              <td>
                <button
                  type="button"
                  className={styles.actionIcon}
                  onClick={() => patch(key, form[key].filter((_, i) => i !== index))}
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
        label="Add Party"
        onClick={() => patch(key, [...(form[key] || []), partyRow()])}
      />
    </>
  );

  const renderPortTable = (key, label) => (
    <>
      <div className={styles.sectionTitle}>{label}</div>
      <table className={styles.nestedTable}>
        <thead>
          <tr>
            <th>Port ID</th>
            <th>Comments</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(form[key] || []).map((row, index) => (
            <tr key={`${key}-${index}`}>
              <td>
                <input
                  value={row.portId}
                  placeholder="Port ID"
                  onChange={(e) => {
                    const next = [...form[key]];
                    next[index] = { ...next[index], portId: e.target.value };
                    patch(key, next);
                  }}
                />
              </td>
              <td>
                <input
                  value={row.comments}
                  onChange={(e) => {
                    const next = [...form[key]];
                    next[index] = { ...next[index], comments: e.target.value };
                    patch(key, next);
                  }}
                />
              </td>
              <td>
                <button
                  type="button"
                  className={styles.actionIcon}
                  onClick={() => patch(key, form[key].filter((_, i) => i !== index))}
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
        label="Add Port"
        onClick={() => patch(key, [...(form[key] || []), portRow()])}
      />
    </>
  );

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay active label="Loading cargo relet…" />
      </div>
    );
  }

  const listHref = `${coaPath('cargo-relet')}?selBType=${form.businessTypeId || '2'}`;

  return (
    <div className={`zafira-page ${styles.page}`}>
      <CoaFormHeaderActions listHref={listHref} disabled={saving} />
      {saving ? <LoadingOverlay active label="Saving cargo relet…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <form onSubmit={handleSave}>
        <div className={styles.formGrid}>
          <Field id="coaId" label="COA">
            <CoaCardSelect
              label="COA"
              value={form.coaId}
              options={coaOptions}
              placeholder="---Select COA---"
              onChange={(value) => patch('coaId', value)}
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
          <Field id="reletNo" label="Cargo Relet No.">
            <input id="reletNo" value={form.reletNo} onChange={(e) => patch('reletNo', e.target.value)} />
          </Field>
          <Field id="reletName" label="Cargo Relet Name">
            <input id="reletName" value={form.reletName} onChange={(e) => patch('reletName', e.target.value)} />
          </Field>
          <Field id="transDate" label="Date">
            <input id="transDate" value={form.transDate} onChange={(e) => patch('transDate', e.target.value)} placeholder="dd-mm-yyyy" />
          </Field>
          <Field id="vesselImoId" label="Vessel">
            <CoaCardSelect
              label="Vessel"
              value={form.vesselImoId}
              options={vessels}
              onChange={(value) => patch('vesselImoId', value)}
            />
          </Field>
          <Field id="vesselType" label="Vessel Type">
            <input id="vesselType" value={form.vesselType} onChange={(e) => patch('vesselType', e.target.value)} />
          </Field>
          <Field id="cargoQty" label="Cargo Qty (MT)">
            <input id="cargoQty" value={form.cargoQty} onChange={(e) => patch('cargoQty', e.target.value)} onBlur={recalculate} />
          </Field>
        </div>

        <div className={styles.sectionTitle}>Freight IN</div>
        <div className={styles.formGrid}>
          <Field id="freightUsd" label="Freight USD/MT">
            <input id="freightUsd" value={form.freightUsd} onChange={(e) => patch('freightUsd', e.target.value)} onBlur={recalculate} />
          </Field>
          <Field id="bafUsd" label="BAF USD/MT">
            <input id="bafUsd" value={form.bafUsd} onChange={(e) => patch('bafUsd', e.target.value)} />
          </Field>
          <Field id="freightFrom" label="Applicable From">
            <input id="freightFrom" value={form.freightFrom} onChange={(e) => patch('freightFrom', e.target.value)} />
          </Field>
          <Field id="freightTo" label="Applicable To">
            <input id="freightTo" value={form.freightTo} onChange={(e) => patch('freightTo', e.target.value)} />
          </Field>
          <Field id="addCom" label="Add Comm %">
            <input id="addCom" value={form.addCom} onChange={(e) => patch('addCom', e.target.value)} />
          </Field>
          <Field id="brokerage" label="Brokerage %">
            <input id="brokerage" value={form.brokerage} onChange={(e) => patch('brokerage', e.target.value)} />
          </Field>
          <Field id="freightAmt" label="Freight Amt">
            <input id="freightAmt" value={form.freightAmt} onChange={(e) => patch('freightAmt', e.target.value)} />
          </Field>
          <Field id="bunkerSurchargeAmt" label="Bunker Surcharge">
            <input id="bunkerSurchargeAmt" value={form.bunkerSurchargeAmt} onChange={(e) => patch('bunkerSurchargeAmt', e.target.value)} onBlur={recalculate} />
          </Field>
          <Field id="totalAmt" label="Total IN">
            <input id="totalAmt" value={form.totalAmt} readOnly />
          </Field>
        </div>

        <div className={styles.sectionTitle}>Freight OUT</div>
        <div className={styles.formGrid}>
          <Field id="freightUsdOut" label="Freight USD/MT Out">
            <input id="freightUsdOut" value={form.freightUsdOut} onChange={(e) => patch('freightUsdOut', e.target.value)} onBlur={recalculate} />
          </Field>
          <Field id="bafUsdOut" label="BAF USD/MT Out">
            <input id="bafUsdOut" value={form.bafUsdOut} onChange={(e) => patch('bafUsdOut', e.target.value)} />
          </Field>
          <Field id="freightAmtOut" label="Freight Amt Out">
            <input id="freightAmtOut" value={form.freightAmtOut} onChange={(e) => patch('freightAmtOut', e.target.value)} />
          </Field>
          <Field id="bunkerSurchargeAmtOut" label="Bunker Surcharge Out">
            <input id="bunkerSurchargeAmtOut" value={form.bunkerSurchargeAmtOut} onChange={(e) => patch('bunkerSurchargeAmtOut', e.target.value)} onBlur={recalculate} />
          </Field>
          <Field id="totalAmtOut" label="Total OUT">
            <input id="totalAmtOut" value={form.totalAmtOut} readOnly />
          </Field>
          <Field id="profit" label="Profit">
            <input id="profit" value={form.profit} readOnly />
          </Field>
        </div>

        {renderPartyTable('partiesIn', 'Parties IN')}
        {renderPartyTable('partiesOut', 'Parties OUT')}
        {renderPortTable('loadPortsIn', 'Load Ports IN')}
        {renderPortTable('dischargePortsIn', 'Discharge Ports IN')}
        {renderPortTable('loadPortsOut', 'Load Ports OUT')}
        {renderPortTable('dischargePortsOut', 'Discharge Ports OUT')}

        <div className={styles.sectionTitle}>Clauses / Agents</div>
        <div className={styles.formGrid}>
          <Field id="paymentClause" label="Payment Clause IN" wide>
            <textarea id="paymentClause" value={form.paymentClause} onChange={(e) => patch('paymentClause', e.target.value)} />
          </Field>
          <Field id="bunkerClause" label="Bunker Clause IN" wide>
            <textarea id="bunkerClause" value={form.bunkerClause} onChange={(e) => patch('bunkerClause', e.target.value)} />
          </Field>
          <Field id="paymentClauseOut" label="Payment Clause OUT" wide>
            <textarea id="paymentClauseOut" value={form.paymentClauseOut} onChange={(e) => patch('paymentClauseOut', e.target.value)} />
          </Field>
          <Field id="bunkerClauseOut" label="Bunker Clause OUT" wide>
            <textarea id="bunkerClauseOut" value={form.bunkerClauseOut} onChange={(e) => patch('bunkerClauseOut', e.target.value)} />
          </Field>
          <Field id="spclComments" label="Special Comments IN" wide>
            <textarea id="spclComments" value={form.spclComments} onChange={(e) => patch('spclComments', e.target.value)} />
          </Field>
          <Field id="spclCommentsOut" label="Special Comments OUT" wide>
            <textarea id="spclCommentsOut" value={form.spclCommentsOut} onChange={(e) => patch('spclCommentsOut', e.target.value)} />
          </Field>
        </div>

        <div className={styles.formActions}>
          <Button type="button" variant="outline" label="Recalculate" onClick={recalculate} />
          <Button type="submit" variant="primary" label={isAdd ? 'Save Draft' : 'Update Draft'} disabled={saving} />
          <Button
            type="button"
            variant="warning"
            label="Submit Relet"
            disabled={saving || form.fixed}
            onClick={() => persist('2')}
          />
        </div>
      </form>
    </div>
  );
}
