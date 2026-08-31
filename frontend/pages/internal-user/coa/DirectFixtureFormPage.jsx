import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, DmyDateInput, LoadingOverlay, useAlert } from '@bainbridge/shared-ui';
import { fetchCommercialParameters } from '../../../services/commercialParameters.js';
import { useCoaModule } from '../../../hooks/useCoaModule.js';
import {
  createDirectFixture,
  fetchCoaLookups,
  fetchDirectFixture,
  updateDirectFixture,
} from '../../../services/coas.js';
import PortSearchSelect from '../period-contract/PortSearchSelect.jsx';
import { calcDirectFixtureTotals } from './directFixtureTotals.js';
import CoaCardSelect from './CoaCardSelect.jsx';
import CoaFormHeaderActions from './CoaFormHeaderActions.jsx';
import styles from './DirectFixtureFormPage.module.css';

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FixtureIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}

function todayDmy() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getFullYear()}`;
}

function partyRow() {
  return { charterer: '', owner: '', broker: '' };
}

function portRow() {
  return { portId: '', portName: '', comments: '' };
}

function emptyForm(businessTypeId = '2') {
  return {
    businessTypeId,
    fixtureNo: '',
    vesselImoId: '',
    vesselName: '',
    vesselType: '',
    transDate: todayDmy(),
    cargoName: '',
    cargoQty: '',
    freightUsd: '',
    bafUsd: '',
    foPrice: '',
    addCom: '',
    brokerage: '',
    demRate: '',
    bunkerSurchargePerMt: '0.00',
    effectiveFrt: '0.00',
    grossRevenue: '0.00',
    ttlComm: '0.00',
    nettRevenue: '0.00',
    paymentClause: '',
    bunkerClause: '',
    loadportAgent: '',
    disportAgent: '',
    minTerm: '',
    parties: [partyRow()],
    loadPorts: [portRow()],
    dischargePorts: [portRow()],
  };
}

function withPortRows(rows) {
  return (rows?.length ? rows : [portRow()]).map((row) => ({
    portId: row.portId || '',
    portName: row.portName || '',
    comments: row.comments || '',
  }));
}

function Field({ id, label, children, wide = false }) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function MetaField({ id, label, children, grow = false }) {
  return (
    <div className={`${styles.metaField} ${grow ? styles.metaFieldGrow : ''}`}>
      <label className={styles.metaLabel} htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export default function DirectFixtureFormPage({ mode = 'add' }) {
  const { fcaId } = useParams();
  const navigate = useNavigate();
  const { coaPath } = useCoaModule();
  const alert = useAlert();
  const [searchParams] = useSearchParams();
  const isAdd = mode === 'add' || !fcaId;
  const selBType = searchParams.get('selBType') || '2';
  const listHref = isAdd
    ? `${coaPath('running')}?selBType=${selBType}`
    : `${coaPath('in-ops')}?tradeType=direct&selBType=${selBType}`;
  const [lookups, setLookups] = useState(null);
  const [form, setForm] = useState(() => emptyForm(selBType));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attachNote, setAttachNote] = useState('No documents attached yet');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const bType = searchParams.get('selBType') || '2';
        const lookupData = await fetchCoaLookups();
        if (cancelled) return;
        setLookups(lookupData);
        if (!isAdd) {
          const detail = await fetchDirectFixture(fcaId);
          if (cancelled) return;
          if (!detail) throw new Error('Direct fixture not found.');
          setForm({
            ...emptyForm(detail.businessTypeId || bType),
            ...detail,
            parties: detail.parties?.length ? detail.parties : [partyRow()],
            loadPorts: withPortRows(detail.loadPorts),
            dischargePorts: withPortRows(detail.dischargePorts),
          });
          return;
        }
        if (!cancelled) setForm(emptyForm(bType));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load direct fixture form.');
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

  const vendors = useMemo(() => {
    const map = new Map();
    [...(lookups?.charterers || []), ...(lookups?.owners || []), ...(lookups?.brokers || [])]
      .forEach((item) => {
        if (item?.id != null) map.set(String(item.id), item);
      });
    return [...map.values()];
  }, [lookups]);

  const charterers = lookups?.charterers || [];
  const owners = lookups?.owners || [];
  const brokers = lookups?.brokers || [];

  const patch = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const recalculate = useCallback(() => {
    setForm((prev) => ({ ...prev, ...calcDirectFixtureTotals(prev) }));
  }, []);

  const handleVesselChange = async (value) => {
    const vessel = vessels.find((item) => String(item.id) === String(value));
    patch('vesselImoId', value);
    patch('vesselName', vessel?.name || '');
    try {
      if (!value) {
        patch('vesselType', '');
        return;
      }
      const data = await fetchCommercialParameters(value);
      patch('vesselType', data?.vessel?.type || vessel?.vesselType || '');
    } catch {
      patch('vesselType', vessel?.vesselType || '');
    }
  };

  const updateParty = (index, key, value) => {
    setForm((prev) => {
      const parties = prev.parties.map((row, i) => (i === index ? { ...row, [key]: value } : row));
      return { ...prev, parties };
    });
  };

  const updatePort = (side, index, patchRow) => {
    const key = side === 'load' ? 'loadPorts' : 'dischargePorts';
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].map((row, i) => (i === index ? { ...row, ...patchRow } : row)),
    }));
  };

  const addParty = () => setForm((prev) => ({ ...prev, parties: [...prev.parties, partyRow()] }));
  const addPort = (side) => {
    const key = side === 'load' ? 'loadPorts' : 'dischargePorts';
    setForm((prev) => ({ ...prev, [key]: [...prev[key], portRow()] }));
  };
  const removeParty = (index) => {
    setForm((prev) => ({
      ...prev,
      parties: prev.parties.length <= 1 ? [partyRow()] : prev.parties.filter((_, i) => i !== index),
    }));
  };
  const removePort = (side, index) => {
    const key = side === 'load' ? 'loadPorts' : 'dischargePorts';
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].length <= 1 ? [portRow()] : prev[key].filter((_, i) => i !== index),
    }));
  };

  const buildPayload = (sendToOps) => {
    const totals = calcDirectFixtureTotals(form);
    const charterer = charterers.find((item) => String(item.id) === String(form.parties[0]?.charterer));
    return {
      ...form,
      ...totals,
      sendToOps,
      charterer: charterer?.name || form.parties[0]?.charterer || '',
    };
  };

  const persist = async (sendToOps) => {
    if (!String(form.vesselImoId || '').trim()) {
      setError('Please select a vessel.');
      return;
    }
    if (!String(form.cargoQty || '').trim()) {
      setError('Please enter cargo quantity.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload(sendToOps);
      if (isAdd) await createDirectFixture(payload);
      else await updateDirectFixture(fcaId, payload);
      await alert({
        title: sendToOps ? 'Sent to Ops' : 'Saved',
        message: sendToOps
          ? 'Direct fixture sent to COA Ops.'
          : 'Direct fixture saved.',
      });
      navigate(isAdd ? `${listHref}&msg=0` : listHref);
    } catch (err) {
      setError(err.message || 'Failed to save direct fixture.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay show label="Loading direct fixture…" />
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <CoaFormHeaderActions listHref={listHref} disabled={saving} />
      {saving ? <LoadingOverlay show fullScreen={false} label="Saving direct fixture…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadIcon}>
            <FixtureIcon />
          </div>
          <span className={styles.cardTitle}>Fixture Details</span>
        </div>
        <div className={styles.gridFields}>
          <MetaField id="fixtureType" label="Fixture Type">
            <div className={styles.metaValue}>Direct Fixture</div>
          </MetaField>
          <MetaField id="fixtureNo" label="Fixture No.">
            <input
              id="fixtureNo"
              className={styles.readonly}
              readOnly
              value={form.fixtureNo}
              placeholder="DF-2026-0001"
            />
          </MetaField>
          <MetaField id="vesselImoId" label="Vessel" grow>
            <CoaCardSelect
              id="vesselImoId"
              label="Vessel"
              value={form.vesselImoId}
              options={vessels}
              onChange={handleVesselChange}
            />
          </MetaField>
          <MetaField id="vesselType" label="Vessel Type">
            <input id="vesselType" className={styles.readonly} readOnly value={form.vesselType} placeholder="—" />
          </MetaField>
          <MetaField id="transDate" label="Date">
            <DmyDateInput id="transDate" value={form.transDate} onChange={(value) => patch('transDate', value)} />
          </MetaField>
        </div>
        <p className={styles.fieldHint}>
          This fixture is not linked to a master COA — it&apos;s a single performing lift.
          Cargo, parties and freight terms below are entered manually rather than pulled from a parent contract.
        </p>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={`${styles.cardHeadIcon} ${styles.cardHeadIconEstimate}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12h4l2 7 4-14 2 7h6" />
            </svg>
          </div>
          <span className={styles.cardTitle}>Estimate</span>
        </div>

        <div className={styles.cargoRow}>
          <Field id="cargoName" label="Cargo">
            <input
              id="cargoName"
              value={form.cargoName}
              placeholder="Enter cargo..."
              onChange={(event) => patch('cargoName', event.target.value)}
            />
          </Field>
          <Field id="cargoQty" label="Cargo Qty (MT)">
            <input
              id="cargoQty"
              value={form.cargoQty}
              placeholder="0.00"
              onChange={(event) => patch('cargoQty', event.target.value)}
              onBlur={recalculate}
            />
          </Field>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelHeadTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4Z" />
              </svg>
              Fixture Financials
            </div>
            <div className={styles.panelHeadSub}>Single freight leg — not sub-chartered from a master COA</div>
          </div>
          <div className={styles.panelBody}>
            <div>
              <div className={styles.sectionTitle}>Parties/Entities</div>
              <table className={styles.mini}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Charterer</th>
                    <th>Owner</th>
                    <th>Broker</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {form.parties.map((row, index) => (
                    <tr key={`party-${index}`}>
                      <td>{index + 1}</td>
                      <td>
                        <CoaCardSelect
                          label="Charterer"
                          value={row.charterer}
                          options={charterers}
                          onChange={(value) => updateParty(index, 'charterer', value)}
                        />
                      </td>
                      <td>
                        <CoaCardSelect
                          label="Owner"
                          value={row.owner}
                          options={owners}
                          onChange={(value) => updateParty(index, 'owner', value)}
                        />
                      </td>
                      <td>
                        <CoaCardSelect
                          label="Broker"
                          value={row.broker}
                          options={brokers}
                          onChange={(value) => updateParty(index, 'broker', value)}
                        />
                      </td>
                      <td>
                        <button type="button" className={styles.rowDel} title="Remove row" onClick={() => removeParty(index)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className={styles.dashedAdd} onClick={addParty}>
                <PlusIcon />
                Add
              </button>
            </div>

            <div>
              <div className={styles.sectionTitle}>Load Port</div>
              <table className={styles.mini}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Load Port</th>
                    <th>Comments</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {form.loadPorts.map((row, index) => (
                    <tr key={`lp-${index}`}>
                      <td>{index + 1}</td>
                      <td>
                        <PortSearchSelect
                          value={row.portId}
                          label={row.portName}
                          onChange={(portId, portName) => updatePort('load', index, { portId, portName })}
                        />
                      </td>
                      <td>
                        <input
                          value={row.comments}
                          placeholder="Comments"
                          onChange={(event) => updatePort('load', index, { comments: event.target.value })}
                        />
                      </td>
                      <td>
                        <button type="button" className={styles.rowDel} title="Remove row" onClick={() => removePort('load', index)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className={styles.dashedAdd} onClick={() => addPort('load')}>
                <PlusIcon />
                Add
              </button>
            </div>

            <div>
              <div className={styles.sectionTitle}>Dis Port</div>
              <table className={styles.mini}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Dis Port</th>
                    <th>Comments</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {form.dischargePorts.map((row, index) => (
                    <tr key={`dp-${index}`}>
                      <td>{index + 1}</td>
                      <td>
                        <PortSearchSelect
                          value={row.portId}
                          label={row.portName}
                          onChange={(portId, portName) => updatePort('discharge', index, { portId, portName })}
                        />
                      </td>
                      <td>
                        <input
                          value={row.comments}
                          placeholder="Comments"
                          onChange={(event) => updatePort('discharge', index, { comments: event.target.value })}
                        />
                      </td>
                      <td>
                        <button type="button" className={styles.rowDel} title="Remove row" onClick={() => removePort('discharge', index)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className={styles.dashedAdd} onClick={() => addPort('discharge')}>
                <PlusIcon />
                Add
              </button>
            </div>

            <div>
              <div className={styles.sectionTitle}>Freight Financials</div>
              <div className={styles.fieldGrid2}>
                <Field id="freightUsd" label="Frt Rate (USD/MT)">
                  <input id="freightUsd" value={form.freightUsd} placeholder="0.00" onChange={(e) => patch('freightUsd', e.target.value)} onBlur={recalculate} />
                </Field>
                <Field id="bafUsd" label="BAF">
                  <input id="bafUsd" value={form.bafUsd} placeholder="0.00" onChange={(e) => patch('bafUsd', e.target.value)} onBlur={recalculate} />
                </Field>
                <Field id="foPrice" label="FO Price (USD/MT)">
                  <input id="foPrice" value={form.foPrice} placeholder="0.00" onChange={(e) => patch('foPrice', e.target.value)} onBlur={recalculate} />
                </Field>
                <Field id="addCom" label="Add Comm (%)">
                  <input id="addCom" value={form.addCom} placeholder="0.00" onChange={(e) => patch('addCom', e.target.value)} onBlur={recalculate} />
                </Field>
                <Field id="brokerage" label="Brokerage (%)">
                  <input id="brokerage" value={form.brokerage} placeholder="0.00" onChange={(e) => patch('brokerage', e.target.value)} onBlur={recalculate} />
                </Field>
                <Field id="demRate" label="Demurrage (USD)">
                  <input id="demRate" value={form.demRate} placeholder="0.00" onChange={(e) => patch('demRate', e.target.value)} />
                </Field>
              </div>
            </div>

            <div>
              <div className={styles.sectionTitle}>
                Results
                <span className={styles.calcNote}>= Frt Rate + (FO × BAF)</span>
              </div>
              <div className={styles.resultStrip}>
                <div className={styles.fieldGrid2}>
                  <Field id="bunkerSurchargePerMt" label="Bnkr Surcharge (USD/MT)">
                    <input id="bunkerSurchargePerMt" className={styles.readonly} readOnly value={form.bunkerSurchargePerMt} />
                  </Field>
                  <Field id="effectiveFrt" label="Effective Frt (USD/MT)">
                    <input id="effectiveFrt" className={styles.readonly} readOnly value={form.effectiveFrt} />
                  </Field>
                  <Field id="grossRevenue" label="Gross Revenue (USD)">
                    <input id="grossRevenue" className={styles.readonly} readOnly value={form.grossRevenue} />
                  </Field>
                  <Field id="ttlComm" label="Ttl Comm (USD)">
                    <input id="ttlComm" className={styles.readonly} readOnly value={form.ttlComm} />
                  </Field>
                </div>
                <Field id="nettRevenue" label="Nett Revenue (USD)">
                  <input id="nettRevenue" className={`${styles.readonly} ${styles.nettField}`} readOnly value={form.nettRevenue} />
                </Field>
              </div>
            </div>

            <div>
              <div className={styles.sectionTitle}>Notes &amp; Documents</div>
              <div className={styles.fieldGrid2}>
                <Field id="paymentClause" label="Payment Clause">
                  <textarea id="paymentClause" value={form.paymentClause} placeholder="Payment clause..." onChange={(e) => patch('paymentClause', e.target.value)} />
                </Field>
                <Field id="bunkerClause" label="Bunker Clause">
                  <textarea id="bunkerClause" value={form.bunkerClause} placeholder="Bunker clause..." onChange={(e) => patch('bunkerClause', e.target.value)} />
                </Field>
                <Field id="loadportAgent" label="LP Agents">
                  <CoaCardSelect label="LP Agents" value={form.loadportAgent} options={vendors} onChange={(value) => patch('loadportAgent', value)} />
                </Field>
                <Field id="disportAgent" label="DP Agents">
                  <CoaCardSelect label="DP Agents" value={form.disportAgent} options={vendors} onChange={(value) => patch('disportAgent', value)} />
                </Field>
              </div>
              <Field id="minTerm" label="Main Terms" wide>
                <textarea id="minTerm" value={form.minTerm} onChange={(e) => patch('minTerm', e.target.value)} />
              </Field>
              <div className={styles.field}>
                <label htmlFor="fixture-attach">Attachments</label>
                <div className={styles.dropzone}>
                  <div className={styles.dzText}>Drag &amp; drop files here, or browse</div>
                  <div className={styles.dzSub}>{attachNote}</div>
                  <label className={styles.attachBtn} htmlFor="fixture-attach">
                    Attach
                    <input
                      id="fixture-attach"
                      type="file"
                      multiple
                      hidden
                      onChange={(event) => {
                        const count = event.target.files?.length || 0;
                        setAttachNote(count ? `${count} file${count === 1 ? '' : 's'} selected (not uploaded yet)` : 'No documents attached yet');
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.formFooter}>
        <Button
          type="button"
          variant="saveOutline"
          label="Save"
          disabled={saving}
          onClick={() => persist(false)}
        />
        <button
          type="button"
          className={styles.btnOrange}
          disabled={saving}
          onClick={() => persist(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4Z" />
          </svg>
          Send to Ops
        </button>
      </div>
    </div>
  );
}
