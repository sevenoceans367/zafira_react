import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import {
  deleteAgencyLetter,
  fetchAgencyLetterForm,
  saveAgencyLetter,
} from '../../../services/opsVc.js';
import styles from './OpsPages.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

const FLASH = {
  0: { type: 'success', text: 'Agency Letter Generation added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! this agent is already exists for this port.' },
};

function emptyBunker() {
  return { bunkerPort: '', grade: '', supplier: '', physical: '', quantity: '' };
}

function emptyEntity() {
  return { entity: '2', name: '', email: '' };
}

function draftFromPort(port, form) {
  const letter = port.letter;
  return {
    genAgencyId: letter?.genAgencyId || '',
    date: letter?.date || '',
    qty: letter?.qty != null && letter.qty !== '' ? String(letter.qty) : String(port.qty || ''),
    countryId: letter?.countryId || '',
    username: letter?.username || port.defaultUsername || '',
    password: letter?.password || '',
    etaDate1: letter?.etaDate1 || port.etaFixture || '',
    masterName: letter?.masterName || '',
    cargoDetails: letter?.cargoDetails || form.cargoDefault || '',
    tolerance: letter?.tolerance || form.toleranceDefault || '',
    shipOwner: letter?.shipOwner || '',
    etaDate: letter?.etaDate || '',
    bunkerSurveyor: letter?.bunkerSurveyor || '',
    bunkerSurveyorCom: letter?.bunkerSurveyorCom || '',
    entities: (port.entities?.length ? port.entities : [emptyEntity()]).map((row) => ({ ...row })),
    bunkers: (port.bunkers?.length ? port.bunkers : [emptyBunker()]).map((row) => ({ ...row })),
  };
}

export default function OpsVcAgencyLetterPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';
  const tabParam = Number(searchParams.get('tab') || 1);
  const flash = FLASH[Number(searchParams.get('msg'))];

  const [form, setForm] = useState(null);
  const [activeKey, setActiveKey] = useState('');
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  const load = async (preferredKey = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAgencyLetterForm(comId);
      setForm(data);
      const nextDrafts = {};
      (data.ports || []).forEach((port) => {
        nextDrafts[port.key] = draftFromPort(port, data);
      });
      setDrafts(nextDrafts);
      const preferred = preferredKey
        || data.ports?.[Math.max(0, tabParam - 1)]?.key
        || data.ports?.[0]?.key
        || '';
      setActiveKey(preferred);
    } catch (err) {
      setForm(null);
      setError(err.message || 'Failed to load port related letters.');
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

  const activePort = form?.ports?.find((port) => port.key === activeKey) || null;
  const draft = activeKey ? drafts[activeKey] : null;
  const lookups = form?.lookups || { entityTypes: [], countries: [], shipOwners: [], ports: [] };

  const patchDraft = (patch) => {
    setDrafts((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], ...patch },
    }));
  };

  const patchEntity = (index, patch) => {
    const entities = draft.entities.map((row, i) => (i === index ? { ...row, ...patch } : row));
    patchDraft({ entities });
  };

  const patchBunker = (index, patch) => {
    const bunkers = draft.bunkers.map((row, i) => (i === index ? { ...row, ...patch } : row));
    patchDraft({ bunkers });
  };

  const addEntity = async () => {
    const last = draft.entities[draft.entities.length - 1];
    if (!last?.entity || !last?.name || !last?.email) {
      setError('Please fill all Business Entity values before adding another row.');
      return;
    }
    patchDraft({ entities: [...draft.entities, emptyEntity()] });
  };

  const addBunker = async () => {
    const last = draft.bunkers[draft.bunkers.length - 1];
    if (!last?.grade || !last?.supplier || !last?.physical) {
      setError('Please fill Grade, Supplier and Physical before adding another bunker row.');
      return;
    }
    patchDraft({ bunkers: [...draft.bunkers, emptyBunker()] });
  };

  const handleSubmit = async (submitId) => {
    if (!activePort || !draft) return;
    if (!activePort.agentCode) {
      setError('Please add Vendor in cost sheet for this port.');
      return;
    }
    if (!draft.etaDate1) {
      setError('Please add ETA Date.');
      return;
    }
    if (!draft.countryId) {
      setError('Please add country for this port.');
      return;
    }

    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to submit this data?',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const result = await saveAgencyLetter({
        comId,
        portType: activePort.portType,
        portId: activePort.portId,
        randomId: activePort.randomId,
        vendorId: activePort.agentCode,
        genAgencyId: draft.genAgencyId || null,
        submitId,
        date: draft.date,
        qty: draft.qty,
        countryId: draft.countryId,
        username: draft.username,
        password: draft.password,
        etaDate1: draft.etaDate1,
        masterName: draft.masterName,
        cargoDetails: draft.cargoDetails,
        tolerance: draft.tolerance,
        shipOwner: draft.shipOwner,
        etaDate: draft.etaDate,
        bunkerSurveyor: draft.bunkerSurveyor,
        bunkerSurveyorCom: draft.bunkerSurveyorCom,
        entities: draft.entities,
        bunkers: draft.bunkers,
      });

      if (submitId === 2) {
        navigate(`${backHref}${backHref.includes('?') ? '&' : '?'}msg=2`);
        return;
      }

      const next = new URLSearchParams(searchParams);
      next.set('msg', String(result.msg ?? 0));
      next.set('tab', String((form.ports.findIndex((p) => p.key === activeKey) || 0) + 1));
      setSearchParams(next, { replace: true });
      await load(activeKey);
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
      await deleteAgencyLetter(record.genAgencyId);
      await load(activeKey);
    } catch (err) {
      setError(err.message || 'Failed to delete agency letter.');
    } finally {
      setSaving(false);
    }
  };

  const pdfHref = (record, type) => {
    const params = new URLSearchParams({
      type,
      genAgencyId: record.genAgencyId,
      portType: record.portType || activePort?.portType || '',
      comId,
      portId: record.portId || activePort?.portId || '',
      agentCode: record.vendorId || activePort?.agentCode || '',
      randomId: record.randomId || activePort?.randomId || '',
    });
    return `/api/internal-user/vc/ops/agency-letter/${encodeURIComponent(record.genAgencyId)}/pdf?${params}`;
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? <LoadingOverlay /> : null}
      {flash ? (
        <div className={flash.type === 'error' ? styles.error : styles.flashSuccess}>{flash.text}</div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <FilterBar
        actions={<Button variant="secondary" label="Back" onClick={() => navigate(backHref)} />}
      >
        <div className={styles.muted}>
          {form?.nomId ? `Nom ID ${form.nomId}` : null}
          {form?.vesselName ? ` · ${form.vesselName}` : null}
        </div>
      </FilterBar>

      <h3 className={styles.title}>GENERATE PORT RELATED LETTERS</h3>

      {!loading && !form?.ports?.length ? (
        <div className={styles.empty}>
          No load/discharge ports found on the cost sheet
          {form?.costSheetId ? ` (sheet ${form.costSheetId}` : ''}
          {form?.legsCount != null ? `, ${form.legsCount} leg(s)` : ''}
          {form?.costSheetId ? ')' : ''}.
          {' '}Add port agents on the FVF cost sheet, then reopen this page.
        </div>
      ) : null}

      {form?.ports?.length ? (
        <>
          <div className={styles.tabs}>
            {form.ports.map((port) => (
              <button
                key={port.key}
                type="button"
                className={port.key === activeKey ? styles.tabActive : styles.tab}
                onClick={() => setActiveKey(port.key)}
              >
                {port.tabLabel}
              </button>
            ))}
          </div>

          {activePort && draft ? (
            <div className={styles.letterPanel}>
              <div className={styles.formGrid}>
                <Field id="vc-agency-date" label="Date">
                  <DmyDateInput
                    id="vc-agency-date"
                    value={draft.date}
                    onChange={(v) => patchDraft({ date: v })}
                    disabled={activePort.locked}
                  />
                </Field>
                <Field id="vc-agency-vessel" label="Vessel">
                  <TextInput id="vc-agency-vessel" value={form.vesselName || ''} readOnly />
                </Field>
                <Field id="vc-agency-agent" label="Agent Name">
                  <TextInput id="vc-agency-agent" value={activePort.agentName || ''} readOnly />
                </Field>
                <Field id="vc-agency-qty" label="Cargo Qty (MT)">
                  <TextInput
                    id="vc-agency-qty"
                    value={draft.qty}
                    onChange={(e) => patchDraft({ qty: e.target.value })}
                    disabled={activePort.locked}
                  />
                </Field>
                <Field id="vc-agency-country" label="Port Country">
                  {activePort.letter?.countryId ? (
                    <TextInput
                      id="vc-agency-country"
                      value={lookups.countries.find((c) => c.id === draft.countryId)?.name || draft.countryId}
                      readOnly
                    />
                  ) : (
                    <Select
                      id="vc-agency-country"
                      value={draft.countryId}
                      onChange={(e) => patchDraft({ countryId: e.target.value })}
                      disabled={activePort.locked}
                    >
                      <option value="">---Select from list---</option>
                      {lookups.countries.map((row) => (
                        <option key={row.id} value={row.id}>{row.name}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field id="vc-agency-username" label="Username">
                  <TextInput id="vc-agency-username" value={draft.username} readOnly />
                </Field>
                <Field id="vc-agency-password" label="Password">
                  <TextInput
                    id="vc-agency-password"
                    value={draft.password}
                    onChange={(e) => patchDraft({ password: e.target.value })}
                    disabled={activePort.locked}
                    autoComplete="off"
                  />
                </Field>
                <Field id="vc-agency-eta-date" label="ETA Date">
                  <DmyDateInput
                    id="vc-agency-eta-date"
                    enableTime
                    value={draft.etaDate1}
                    onChange={(v) => patchDraft({ etaDate1: v })}
                    disabled={activePort.locked}
                  />
                </Field>
                <Field id="vc-agency-master-name" label="Master's Name">
                  <TextInput
                    id="vc-agency-master-name"
                    value={draft.masterName}
                    onChange={(e) => patchDraft({ masterName: e.target.value })}
                    disabled={activePort.locked}
                  />
                </Field>
                <Field id="vc-agency-cargo-details" label="Cargo Details">
                  <TextInput
                    id="vc-agency-cargo-details"
                    value={draft.cargoDetails}
                    onChange={(e) => patchDraft({ cargoDetails: e.target.value })}
                    disabled={activePort.locked}
                  />
                </Field>
                <Field id="vc-agency-tolerance" label="Tolerance/Terms">
                  <TextInput
                    id="vc-agency-tolerance"
                    value={draft.tolerance}
                    onChange={(e) => patchDraft({ tolerance: e.target.value })}
                    disabled={activePort.locked}
                  />
                </Field>
                <Field id="vc-agency-ship-owner" label="Ship Owner">
                  <Select
                    id="vc-agency-ship-owner"
                    value={draft.shipOwner}
                    onChange={(e) => patchDraft({ shipOwner: e.target.value })}
                    disabled={activePort.locked}
                  >
                    <option value="">---Select from list---</option>
                    {lookups.shipOwners.map((row) => (
                      <option key={row.id} value={row.id}>{row.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <h4 className={styles.sectionTitle}>Business Entity</h4>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Business Entity</th>
                      <th>PIC Name</th>
                      <th>Email Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.entities.map((row, index) => (
                      <tr key={`entity-${index}`}>
                        <td>
                          {!activePort.locked ? (
                            <button
                              type="button"
                              className={styles.dangerIcon}
                              onClick={() => patchDraft({
                                entities: draft.entities.filter((_, i) => i !== index).length
                                  ? draft.entities.filter((_, i) => i !== index)
                                  : [emptyEntity()],
                              })}
                            >
                              <i className="bi bi-x-lg" aria-hidden />
                            </button>
                          ) : '—'}
                        </td>
                        <td>
                          <Select
                            value={row.entity}
                            onChange={(e) => patchEntity(index, { entity: e.target.value })}
                            disabled={activePort.locked}
                          >
                            <option value="">---Select from list---</option>
                            {lookups.entityTypes.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <TextInput
                            value={row.name}
                            onChange={(e) => patchEntity(index, { name: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </td>
                        <td>
                          <TextInput
                            value={row.email}
                            onChange={(e) => patchEntity(index, { email: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!activePort.locked ? (
                <div className={styles.toolbarActions}>
                  <Button variant="primary" label="Add" onClick={addEntity} />
                </div>
              ) : null}

              <h4 className={styles.sectionTitle}>BUNKERS STEMMED - LETTERS TO MASTER AND AGENTS</h4>
              <div className={styles.formGrid}>
                <Field id="vc-agency-bunker-eta" label="ETA (LT)">
                  <DmyDateInput
                    id="vc-agency-bunker-eta"
                    enableTime
                    value={draft.etaDate}
                    onChange={(v) => patchDraft({ etaDate: v })}
                    disabled={activePort.locked}
                  />
                </Field>
                <Field id="vc-agency-bunker-surveyor" label="Bunker Surveyor (Name)">
                  <TextInput
                    id="vc-agency-bunker-surveyor"
                    value={draft.bunkerSurveyor}
                    onChange={(e) => patchDraft({ bunkerSurveyor: e.target.value })}
                    disabled={activePort.locked}
                  />
                </Field>
                <Field id="vc-agency-bunker-surveyor-com" label="Bunker Surveyor (Company and Contact)">
                  <Textarea
                    id="vc-agency-bunker-surveyor-com"
                    value={draft.bunkerSurveyorCom}
                    onChange={(e) => patchDraft({ bunkerSurveyorCom: e.target.value })}
                    disabled={activePort.locked}
                    rows={2}
                  />
                </Field>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Bunkering Port</th>
                      <th>GRADE</th>
                      <th>Supplier</th>
                      <th>Physical</th>
                      <th>Quantity (MT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.bunkers.map((row, index) => (
                      <tr key={`bunker-${index}`}>
                        <td>
                          {!activePort.locked ? (
                            <button
                              type="button"
                              className={styles.dangerIcon}
                              onClick={() => patchDraft({
                                bunkers: draft.bunkers.filter((_, i) => i !== index).length
                                  ? draft.bunkers.filter((_, i) => i !== index)
                                  : [emptyBunker()],
                              })}
                            >
                              <i className="bi bi-x-lg" aria-hidden />
                            </button>
                          ) : '—'}
                        </td>
                        <td>
                          <Select
                            value={row.bunkerPort}
                            onChange={(e) => patchBunker(index, { bunkerPort: e.target.value })}
                            disabled={activePort.locked}
                          >
                            <option value="">---Select from list---</option>
                            {lookups.ports.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <TextInput
                            value={row.grade}
                            onChange={(e) => patchBunker(index, { grade: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </td>
                        <td>
                          <TextInput
                            value={row.supplier}
                            onChange={(e) => patchBunker(index, { supplier: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </td>
                        <td>
                          <TextInput
                            value={row.physical}
                            onChange={(e) => patchBunker(index, { physical: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </td>
                        <td>
                          <TextInput
                            value={row.quantity}
                            onChange={(e) => patchBunker(index, { quantity: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!activePort.locked ? (
                <div className={styles.toolbarActions}>
                  <Button variant="primary" label="Add" onClick={addBunker} />
                </div>
              ) : null}

              {!activePort.locked ? (
                <>
                  <div className={styles.footerActions}>
                    <Button variant="primary" label="Submit" onClick={() => handleSubmit(1)} disabled={saving} />
                    <Button variant="primary" label="Submit & Close" onClick={() => handleSubmit(2)} disabled={saving} />
                  </div>
                  <p className={styles.note}>
                    * It is important to Submit and Close this letter here, to ensure that the agent completes his sections later correctly.
                  </p>
                </>
              ) : null}

              <h4 className={styles.sectionTitle}>Saved Letters</h4>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Country</th>
                      <th>Port</th>
                      <th>Cargo Details</th>
                      <th>Agent Name</th>
                      <th>Date of Letter</th>
                      <th>User Name</th>
                      <th>Password</th>
                      <th>PDA Request</th>
                      <th>Edit/Cancel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!activePort.records?.length ? (
                      <tr>
                        <td colSpan={10} className={styles.emptyCell}>
                          Sorry , currently zero(0) records added.
                        </td>
                      </tr>
                    ) : activePort.records.map((record) => (
                      <tr key={record.genAgencyId}>
                        <td>{record.index}.</td>
                        <td>{record.countryName || '—'}</td>
                        <td>{record.portName || '—'}</td>
                        <td className={styles.wrapCell}>{record.cargoDetails || '—'}</td>
                        <td>{record.agentName || '—'}</td>
                        <td>{record.date || '—'}</td>
                        <td>{record.username || '—'}</td>
                        <td>{record.password || '—'}</td>
                        <td className={styles.actionsCell}>
                          {activePort.portType !== 'TP' ? (
                            <>
                              <div><a href={pdfHref(record, 'pda')}>PDA Request Letter</a></div>
                              <div><a href={pdfHref(record, 'nomination')}>Agency Nomination Letter</a></div>
                            </>
                          ) : null}
                          <div><a href={pdfHref(record, 'agent-bunker')}>Letter to Agents - Bunker Stemmed</a></div>
                          <div><a href={pdfHref(record, 'master-bunker')}>Letter to Master - Bunker Stemmed</a></div>
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
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
