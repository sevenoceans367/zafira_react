import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  DmyDateInput,
  Field,
  FilterBar,
  LoadingOverlay,
  Select,
  Textarea,
  TextInput,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchTcChecklist, saveTcChecklist } from '../../../services/opsTc.js';
import OpsChecklistTimeline from './OpsChecklistTimeline.jsx';
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
          <TextInput
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
  const [timeline, setTimeline] = useState(null);
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
      setTimeline(data.timeline || null);
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

      <FilterBar
        actions={(
          <>
            <span className={styles.linkMuted} title="PDF not migrated yet">Generate PDF</span>
            <Button variant="outline" label="Back" href={backHref} />
          </>
        )}
      />

      <h3 className={styles.title}>Ops Checklist</h3>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>FIXTURE DETAILS</h4>
        <div className={styles.formGrid}>
          <ReadField label="TC No." value={fixture?.tcNo} />
          <ReadField label="Vessel Name" value={fixture?.vesselName} />
          <ReadField label="CP Date" value={fixture?.cpDate} />
          <ReadField label="Charterer" value={fixture?.charterer} />
        </div>
      </div>

      {timeline ? (
        <OpsChecklistTimeline
          steps={timeline.steps || []}
          wipId={timeline.wipId}
          statusLabel={timeline.statusLabel}
        />
      ) : null}

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
          <Field id="tc-checklist-pni" label="Charterers PNI">
            <Select
              id="tc-checklist-pni"
              value={form.chartererPni || ''}
              onChange={(e) => setField('chartererPni', e.target.value)}
            >
              <option value="">---Select from list---</option>
              {pniVendors.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </Select>
          </Field>
          <Field id="tc-checklist-last-agent" label="Last Port Agent">
            <TextInput
              id="tc-checklist-last-agent"
              value={form.lastPortAgent || ''}
              onChange={(e) => setField('lastPortAgent', e.target.value)}
              placeholder="LAST PORT AGENT"
            />
          </Field>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>DELIVERY</h4>
        <div className={styles.formGrid}>
          <Field id="tc-checklist-laycan-from" label="Laycan From">
            <DmyDateInput
              id="tc-checklist-laycan-from"
              enableTime
              value={form.laycanFrom || ''}
              onChange={(v) => setField('laycanFrom', v)}
            />
          </Field>
          <Field id="tc-checklist-laycan-to" label="Laycan To">
            <DmyDateInput
              id="tc-checklist-laycan-to"
              enableTime
              value={form.laycanTo || ''}
              onChange={(v) => setField('laycanTo', v)}
            />
          </Field>
          <Field id="tc-checklist-draft-res" label="Draft Restrictions As Per CP">
            <TextInput
              id="tc-checklist-draft-res"
              value={form.draftResAsPerCp || ''}
              onChange={(e) => setField('draftResAsPerCp', e.target.value)}
            />
          </Field>
          <Field id="tc-checklist-load-rate" label="Load Rate - CP">
            <TextInput
              id="tc-checklist-load-rate"
              value={form.loadRateCp || ''}
              onChange={(e) => setField('loadRateCp', e.target.value)}
            />
          </Field>
          <Field id="tc-checklist-discharge-rate" label="Discharge Rate - CP">
            <TextInput
              id="tc-checklist-discharge-rate"
              value={form.dischargeRateCp || ''}
              onChange={(e) => setField('dischargeRateCp', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <EtaRows
        title="ETA NOTICES (Delivery)"
        rows={form.deliveryEtas}
        onChange={(index, patch) => patchEta('del', index, patch)}
        onAdd={() => addEta('del')}
        onRemove={(index) => removeEta('del', index)}
      />

      <EtaRows
        title="ETA NOTICES (Re-delivery)"
        rows={form.redeliveryEtas}
        onChange={(index, patch) => patchEta('redel', index, patch)}
        onAdd={() => addEta('redel')}
        onRemove={(index) => removeEta('redel', index)}
      />

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>REMARKS</h4>
        <Textarea
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
