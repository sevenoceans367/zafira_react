import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, DmyDateInput, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  deleteAgencyLetterTc,
  fetchAgencyLetterTcForm,
  saveAgencyLetterTc,
} from '../../../services/opsTc.js';
import styles from './OpsPages.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops-tc/in-ops-glance',
  2: '/internal-user/vc/ops-tc/post-ops',
  3: '/internal-user/vc/ops-tc/history',
};

const FLASH = {
  0: { type: 'success', text: 'Agency Letter Generation added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! this agent is already exists for this port.' },
  2: { type: 'success', text: 'Agency Letter deleted successfully.' },
};

function emptyDraft(form) {
  return {
    genAgencyTcId: '',
    date: '',
    vesselName: form?.vesselName || '',
    vendorId: '',
    portOfCall: '',
    purposeOfCall: '',
    mastersName: form?.mastersNameDefault || '',
    shipOwner: '',
    mainDescription: '',
    status: 1,
  };
}

function Field({ label, children }) {
  return (
    <div className={styles.formField}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export default function OpsTcAgencyLetterPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';
  const flash = FLASH[Number(searchParams.get('msg'))];

  const [form, setForm] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  const lookups = form?.lookups || { agents: [], shipOwners: [], ports: [], purposes: [] };

  const agentDetail = useMemo(() => {
    const agent = lookups.agents.find((row) => row.id === String(draft?.vendorId || ''));
    return agent?.detail || '';
  }, [lookups.agents, draft?.vendorId]);

  const shipOwnerDetail = useMemo(() => {
    const owner = lookups.shipOwners.find((row) => row.id === String(draft?.shipOwner || ''));
    return owner?.detail || '';
  }, [lookups.shipOwners, draft?.shipOwner]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAgencyLetterTcForm(comId);
      setForm(data);
      setDraft(data.draft
        ? { ...emptyDraft(data), ...data.draft }
        : emptyDraft(data));
    } catch (err) {
      setForm(null);
      setDraft(null);
      setError(err.message || 'Failed to load agency letter form.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!comId) {
      setError('COMID is required.');
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comId]);

  const patchDraft = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleSubmit = async (updateStatus) => {
    if (!draft) return;
    if (!draft.date || !draft.vendorId || !draft.portOfCall || !draft.purposeOfCall
      || !draft.mastersName || !draft.shipOwner || !draft.mainDescription) {
      setError('Please fill all required fields.');
      return;
    }

    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you have checked each entry?',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const result = await saveAgencyLetterTc({
        comId,
        genAgencyTcId: draft.genAgencyTcId,
        date: draft.date,
        vesselName: draft.vesselName || form?.vesselName || '',
        vendorId: draft.vendorId,
        portOfCall: draft.portOfCall,
        purposeOfCall: draft.purposeOfCall,
        mastersName: draft.mastersName,
        shipOwner: draft.shipOwner,
        mainDescription: draft.mainDescription,
        updateStatus,
      });

      if (result.msg === 1) {
        const next = new URLSearchParams(searchParams);
        next.set('msg', '1');
        setSearchParams(next, { replace: true });
        return;
      }

      const next = new URLSearchParams(searchParams);
      next.set('msg', String(result.msg ?? 0));
      setSearchParams(next, { replace: true });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to save agency letter.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to delete this entry permanently?',
    });
    if (!ok) return;
    setSaving(true);
    setError('');
    try {
      await deleteAgencyLetterTc(record.genAgencyTcId);
      const next = new URLSearchParams(searchParams);
      next.set('msg', '2');
      setSearchParams(next, { replace: true });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete agency letter.');
    } finally {
      setSaving(false);
    }
  };

  const pdfHref = (record) => {
    const params = new URLSearchParams({
      comId,
      tc_no: form?.tcNo || '',
    });
    return `/api/internal-user/vc/ops-tc/agency-letter/${encodeURIComponent(record.genAgencyTcId)}/pdf?${params}`;
  };

  const canSubmit = draft && Number(draft.status) !== 2;

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? <LoadingOverlay /> : null}
      {flash ? (
        <div className={flash.type === 'error' ? styles.error : styles.flashSuccess}>{flash.text}</div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.toolbar}>
        <div className={styles.muted}>
          {form?.tcNo ? `TC No. ${form.tcNo}` : null}
          {form?.nomId ? ` · Nom ID ${form.nomId}` : null}
        </div>
        <div className={styles.toolbarActions}>
          <Button variant="secondary" label="Back" onClick={() => navigate(backHref)} />
        </div>
      </div>

      <h3 className={styles.title}>TC - GENERATE AGENCY RELATED LETTERS</h3>

      {!loading && form && draft ? (
        <>
          <div className={styles.formGrid}>
            <Field label="Date">
              <DmyDateInput value={draft.date} onChange={(value) => patchDraft({ date: value })} />
            </Field>
            <Field label="Vessel">
              <input
                className={styles.input}
                value={draft.vesselName || form.vesselName || ''}
                readOnly
              />
            </Field>
            <Field label="Agent Name">
              <select
                className={styles.input}
                value={draft.vendorId}
                onChange={(e) => patchDraft({ vendorId: e.target.value })}
              >
                <option value="">---Select---</option>
                {lookups.agents.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Port of Call">
              <select
                className={styles.input}
                value={draft.portOfCall}
                onChange={(e) => patchDraft({ portOfCall: e.target.value })}
              >
                <option value="">---Select---</option>
                {lookups.ports.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Purpose of Call">
              <select
                className={styles.input}
                value={draft.purposeOfCall}
                onChange={(e) => patchDraft({ purposeOfCall: e.target.value })}
              >
                <option value="">---Select---</option>
                {lookups.purposes.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Master's Name">
              <input
                className={styles.input}
                value={draft.mastersName}
                onChange={(e) => patchDraft({ mastersName: e.target.value })}
                placeholder="Master's Name"
                autoComplete="off"
              />
            </Field>
            <Field label="Ship Owner">
              <select
                className={styles.input}
                value={draft.shipOwner}
                onChange={(e) => patchDraft({ shipOwner: e.target.value })}
              >
                <option value="">---Select---</option>
                {lookups.shipOwners.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className={styles.formField} style={{ marginTop: '1rem' }}>
            <label>Main Description</label>
            <div className={styles.muted} style={{ marginBottom: '0.5rem' }}>
              To :&nbsp;&nbsp;{agentDetail || '—'}
              <br />
              Cc:&nbsp;&nbsp;Master mt :&nbsp;{form.vesselName || ''} /att. {draft.mastersName || ''}
              <br />
              Cc:&nbsp;&nbsp;{shipOwnerDetail || '—'}
            </div>
            <textarea
              className={styles.input}
              rows={6}
              value={draft.mainDescription}
              onChange={(e) => patchDraft({ mainDescription: e.target.value })}
              placeholder="Enter Main Description Here"
            />
          </div>

          {canSubmit ? (
            <div className={styles.toolbarActions} style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button label="Submit" onClick={() => handleSubmit(1)} />
              <Button label="Submit & Close" onClick={() => handleSubmit(2)} />
            </div>
          ) : null}

          <div className={styles.tableWrap} style={{ marginTop: '1.5rem' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Port</th>
                  <th>Purpose</th>
                  <th>Agent Name</th>
                  <th>Letter</th>
                  <th>Edit/Cancel</th>
                </tr>
              </thead>
              <tbody>
                {!form.records?.length ? (
                  <tr>
                    <td colSpan={7} className={styles.empty}>
                      Sorry , currently zero(0) records added.
                    </td>
                  </tr>
                ) : form.records.map((record) => (
                  <tr key={record.genAgencyTcId}>
                    <td>{record.index}.</td>
                    <td>{record.date || '—'}</td>
                    <td>{record.portName || '—'}</td>
                    <td>{record.purposeName || '—'}</td>
                    <td>{record.agentName || '—'}</td>
                    <td>
                      <a href={pdfHref(record)} title="Pdf">PDA Request Letter</a>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.dangerIcon}
                        title="Delete Entry"
                        onClick={() => handleDelete(record)}
                      >
                        <i className="bi bi-x-lg" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
