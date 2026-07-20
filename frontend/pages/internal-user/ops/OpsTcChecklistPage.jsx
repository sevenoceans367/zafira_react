import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, DmyDateInput, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchTcChecklist, saveTcChecklist } from '../../../services/opsTc.js';
import styles from './OpsPages.module.css';

const BACK_BY_PAGE = {
  1: '/internal-user/vc/ops-tc/in-ops-glance',
  2: '/internal-user/vc/ops-tc/post-ops',
  3: '/internal-user/vc/ops-tc/history',
};

const CHECK_FIELDS = [
  { key: 'reg', label: 'REG' },
  { key: 'class', label: 'CLASS' },
  { key: 'pni', label: 'PNI' },
  { key: 'ism', label: 'ISM' },
  { key: 'doc', label: 'DOC' },
  { key: 'itc', label: 'ITC' },
  { key: 'isps', label: 'ISPS' },
  { key: 'll', label: 'LL' },
  { key: 'bq', label: 'BQ' },
  { key: 'hm', label: 'H&M' },
  { key: 'seaWeb', label: 'SEA-WEB' },
  { key: 'cargoDeclMaster', label: 'CARGO DECL. SIGN MASTER' },
  { key: 'reqDocsSentToIns', label: 'Required Docs sent to Insurance Desk' },
];

function ReadField({ label, value }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <div className={styles.fieldRead}>{value || '—'}</div>
    </div>
  );
}

function EtaRows({ rows, onChange, onAdd, onRemove, title }) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {(rows || []).map((row, index) => (
        <div key={`${title}-${index}`} className={styles.etaRow}>
          <button
            type="button"
            className={styles.dangerIcon}
            title="Remove"
            onClick={() => onRemove(index)}
          >
            ×
          </button>
          <input
            className={styles.input}
            value={row.text || ''}
            onChange={(e) => onChange(index, { text: e.target.value })}
            placeholder="ENTER ETA NOTICES"
          />
          <DmyDateInput
            enableTime
            value={row.date || ''}
            onChange={(value) => onChange(index, { date: value })}
          />
        </div>
      ))}
      <Button variant="outline" label="Add" onClick={onAdd} />
    </div>
  );
}

export default function OpsTcChecklistPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = Number(searchParams.get('page') || 1);
  const backHref = appPath(BACK_BY_PAGE[page] || BACK_BY_PAGE[1]);

  const [fixture, setFixture] = useState(null);
  const [form, setForm] = useState(null);
  const [pniVendors, setPniVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!comId) {
      setError('Missing comid.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchTcChecklist(comId);
      setFixture(data.fixture);
      setForm(data.form);
      setPniVendors(data.pniVendors || []);
    } catch (err) {
      setError(err.message || 'Failed to load TC Checklist.');
    } finally {
      setLoading(false);
    }
  }, [comId]);

  useEffect(() => { load(); }, [load]);

  const setCheck = (key, checked) => {
    setForm((prev) => ({
      ...prev,
      checks: { ...prev.checks, [key]: checked },
    }));
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setDelivery = (key, value) => {
    setForm((prev) => ({
      ...prev,
      delivery: { ...prev.delivery, [key]: value },
    }));
  };

  const setRedelivery = (key, value) => {
    setForm((prev) => ({
      ...prev,
      redelivery: { ...prev.redelivery, [key]: value },
    }));
  };

  const patchEta = (side, index, patch) => {
    const key = side === 'del' ? 'deliveryEtas' : 'redeliveryEtas';
    setForm((prev) => {
      const rows = [...(prev[key] || [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, [key]: rows };
    });
  };

  const addEta = (side) => {
    const key = side === 'del' ? 'deliveryEtas' : 'redeliveryEtas';
    setForm((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), { text: '', date: '' }],
    }));
  };

  const removeEta = (side, index) => {
    const key = side === 'del' ? 'deliveryEtas' : 'redeliveryEtas';
    setForm((prev) => {
      const rows = (prev[key] || []).filter((_, i) => i !== index);
      return { ...prev, [key]: rows.length ? rows : [{ text: '', date: '' }] };
    });
  };

  const handleSave = async () => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to save this checklist?',
      confirmLabel: 'Save',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      await saveTcChecklist(comId, form);
      navigate(`${backHref}?msg=0`);
    } catch (err) {
      setError(err.message || 'Failed to save TC Checklist.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay active label="Loading TC Checklist…" />
        {error ? <div className={styles.error}>{error}</div> : null}
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      {saving ? <LoadingOverlay active label="Saving checklist…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.toolbar}>
        <div />
        <div className={styles.toolbarActions}>
          <span className={styles.linkMuted} title="PDF not migrated yet">Generate PDF</span>
          <Button variant="outline" label="Back" href={backHref} />
        </div>
      </div>

      <h3 className={styles.title}>TC CHECKLIST</h3>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>FIXTURE DETAILS</h4>
        <div className={styles.formGrid}>
          <ReadField label="TC No." value={fixture?.tcNo} />
          <ReadField label="Vessel Name" value={fixture?.vesselName} />
          <ReadField label="CP Date" value={fixture?.cpDate} />
          <ReadField label="Charterer" value={fixture?.charterer} />
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>VSL DETAILS</h4>
        <div className={styles.formGrid}>
          <ReadField label="Built" value={fixture?.built} />
          <ReadField label="Deadweight" value={fixture?.deadweight} />
          <ReadField label="Draft" value={fixture?.draft} />
          <ReadField label="GRT/NRT" value={fixture?.grtNrt} />
          <ReadField label="TPC" value={fixture?.tpc} />
          <ReadField label="Vessel PNI" value={fixture?.vesselPni} />
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>VESSEL CHECKS</h4>
        <div className={styles.checkGrid}>
          {CHECK_FIELDS.map((item) => (
            <label key={item.key} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={Boolean(form.checks?.[item.key])}
                onChange={(e) => setCheck(item.key, e.target.checked)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <div className={styles.formGrid} style={{ marginTop: 12 }}>
          <div className={styles.field}>
            <label htmlFor="tc-checklist-pni">Charterers PNI</label>
            <select
              id="tc-checklist-pni"
              value={form.chartererPni || ''}
              onChange={(e) => setField('chartererPni', e.target.value)}
            >
              <option value="">---Select from list---</option>
              {pniVendors.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="tc-checklist-last-agent">Last Port Agent</label>
            <input
              id="tc-checklist-last-agent"
              className={styles.input}
              value={form.lastPortAgent || ''}
              onChange={(e) => setField('lastPortAgent', e.target.value)}
              placeholder="LAST PORT AGENT"
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>DELIVERY</h4>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>Laycan From</label>
            <DmyDateInput enableTime value={form.laycanFrom || ''} onChange={(v) => setField('laycanFrom', v)} />
          </div>
          <div className={styles.field}>
            <label>Laycan To</label>
            <DmyDateInput enableTime value={form.laycanTo || ''} onChange={(v) => setField('laycanTo', v)} />
          </div>
          <div className={styles.field}>
            <label>Draft Restrictions As Per CP</label>
            <input className={styles.input} value={form.draftResAsPerCp || ''} onChange={(e) => setField('draftResAsPerCp', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Load Rate - CP</label>
            <input className={styles.input} value={form.loadRateCp || ''} onChange={(e) => setField('loadRateCp', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Discharge Rate - CP</label>
            <input className={styles.input} value={form.dischargeRateCp || ''} onChange={(e) => setField('dischargeRateCp', e.target.value)} />
          </div>
        </div>
      </div>

      <EtaRows
        title="ETA NOTICES (Delivery)"
        rows={form.deliveryEtas}
        onChange={(index, patch) => patchEta('del', index, patch)}
        onAdd={() => addEta('del')}
        onRemove={(index) => removeEta('del', index)}
      />

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>ARRIVAL (Delivery)</h4>
        <div className={styles.formGrid}>
          <input className={styles.input} value={form.delivery.actualArrivalText || ''} onChange={(e) => setDelivery('actualArrivalText', e.target.value)} />
          <DmyDateInput enableTime value={form.delivery.actualArrivalDate || ''} onChange={(v) => setDelivery('actualArrivalDate', v)} />
          <input className={styles.input} value={form.delivery.norTenderedText || ''} onChange={(e) => setDelivery('norTenderedText', e.target.value)} />
          <DmyDateInput enableTime value={form.delivery.norTenderedDate || ''} onChange={(v) => setDelivery('norTenderedDate', v)} />
          <input className={styles.input} value={form.delivery.placePortText || ''} onChange={(e) => setDelivery('placePortText', e.target.value)} />
          <input className={styles.input} value={form.delivery.placePortData || ''} readOnly />
          <input className={styles.input} value={form.delivery.foDoText || ''} onChange={(e) => setDelivery('foDoText', e.target.value)} />
          <input className={styles.input} value={form.delivery.foDoData || ''} onChange={(e) => setDelivery('foDoData', e.target.value)} />
          <input className={styles.input} value={form.delivery.dateTimeText || ''} onChange={(e) => setDelivery('dateTimeText', e.target.value)} />
          <input className={styles.input} value={form.delivery.dateTimeData || ''} readOnly />
        </div>
      </div>

      <EtaRows
        title="ETA NOTICES (Re-delivery)"
        rows={form.redeliveryEtas}
        onChange={(index, patch) => patchEta('redel', index, patch)}
        onAdd={() => addEta('redel')}
        onRemove={(index) => removeEta('redel', index)}
      />

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>ARRIVAL (Re-delivery)</h4>
        <div className={styles.formGrid}>
          <input className={styles.input} value={form.redelivery.actualArrivalText || ''} onChange={(e) => setRedelivery('actualArrivalText', e.target.value)} />
          <DmyDateInput enableTime value={form.redelivery.actualArrivalDate || ''} onChange={(v) => setRedelivery('actualArrivalDate', v)} />
          <input className={styles.input} value={form.redelivery.norTenderedText || ''} onChange={(e) => setRedelivery('norTenderedText', e.target.value)} />
          <DmyDateInput enableTime value={form.redelivery.norTenderedDate || ''} onChange={(v) => setRedelivery('norTenderedDate', v)} />
          <input className={styles.input} value={form.redelivery.placePortText || ''} onChange={(e) => setRedelivery('placePortText', e.target.value)} />
          <input className={styles.input} value={form.redelivery.placePortData || ''} readOnly />
          <input className={styles.input} value={form.redelivery.foDoText || ''} onChange={(e) => setRedelivery('foDoText', e.target.value)} />
          <input className={styles.input} value={form.redelivery.foDoData || ''} onChange={(e) => setRedelivery('foDoData', e.target.value)} />
          <input className={styles.input} value={form.redelivery.dateTimeText || ''} onChange={(e) => setRedelivery('dateTimeText', e.target.value)} />
          <input className={styles.input} value={form.redelivery.dateTimeData || ''} readOnly />
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>REMARKS</h4>
        <textarea
          className={styles.textarea}
          value={form.remarks || ''}
          onChange={(e) => setField('remarks', e.target.value)}
          rows={4}
          placeholder="Remarks"
        />
      </div>

      <div className={styles.footerActions}>
        <Button label={saving ? 'Saving…' : 'Submit'} onClick={handleSave} disabled={saving} />
        <Button variant="outline" label="Back" href={backHref} disabled={saving} />
        <Link to={backHref} className={styles.linkMuted}>Cancel</Link>
      </div>
    </div>
  );
}
