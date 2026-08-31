import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  CardSelect,
  DmyDateInput,
  LoadingOverlay,
  TextInput,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  deleteAgencyLetter,
  fetchAgencyLetterForm,
  saveAgencyLetter,
} from '../../../services/opsVc.js';
import OpsVcBackHeaderActions from './OpsVcBackHeaderActions.jsx';
import pageStyles from './OpsPages.module.css';
import styles from './OpsVcAgencyLetterPage.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

const FLASH = {
  0: { type: 'success', text: 'Agency Letter Generation added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! this agent is already exists for this port.' },
};

const PDF_TYPES = [
  { type: 'pda', label: 'PDA Request Letter', nonTpOnly: true },
  { type: 'nomination', label: 'Agency Nomination Letter', nonTpOnly: true },
  { type: 'agent-bunker', label: 'Letter to Agents – Bunker Stemmed' },
  { type: 'master-bunker', label: 'Letter to Master – Bunker Stemmed' },
];

function emptyBunker() {
  return { bunkerPort: '', grade: '', supplier: '', physical: '', quantity: '' };
}

function emptyEntity() {
  return { entity: '2', name: '', email: '' };
}

function lookupOptions(items, placeholder = '---Select from list---') {
  return [
    { id: '', name: placeholder },
    ...items.map((row) => ({ id: String(row.id), name: row.name })),
  ];
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

function PortTypeIcon({ portType }) {
  if (portType === 'DP') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22V9" />
        <path d="M18 15l-6-6-6 6" />
        <path d="M4 4h16" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v13" />
      <path d="M6 9l6 6 6-6" />
      <path d="M4 20h16" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DetailsInfoPopup() {
  return (
    <div className={styles.infoPop}>
      <div className={styles.infoPopTitle}>How this page works</div>
      <ol className={styles.infoPopSteps}>
        <li>Fill in the vessel, agent and cargo <b>Details</b> for this port.</li>
        <li>Add each <b>Business Entity</b> that needs a letter, then the <b>Bunkers Stemmed</b> quantities.</li>
        <li>
          <span className={styles.infoPopIco}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <path d="M17 21v-8H7v8" />
              <path d="M7 3v5h8" />
            </svg>
          </span>
          <b>Save</b> keeps a draft you can return to.
        </li>
        <li>
          <span className={styles.infoPopIco}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </span>
          <b>Submit</b> finalises the letter for this port.
        </li>
        <li>
          <span className={styles.infoPopIco}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 6-10 7L2 6" />
            </svg>
          </span>
          The agent/proxy is then notified to complete their remaining sections here.
        </li>
      </ol>
    </div>
  );
}

function SavedLetterFilesMenu({ record, portType, comId, activePort }) {
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const pdfHref = (type) => {
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

  const files = PDF_TYPES.filter((item) => !item.nonTpOnly || portType !== 'TP');

  const updateMenuPosition = () => {
    const trigger = wrapRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 230;
    setMenuStyle({
      position: 'fixed',
      top: `${rect.bottom + 6}px`,
      left: `${Math.min(rect.left, window.innerWidth - width - 8)}px`,
      minWidth: `${width}px`,
      zIndex: 10050,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }
    updateMenuPosition();
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      const inTrigger = wrapRef.current?.contains(event.target);
      const inMenu = menuRef.current?.contains(event.target);
      if (!inTrigger && !inMenu) setOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const handleReposition = () => updateMenuPosition();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open]);

  const menu = open && menuStyle && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        className={styles.menuDropdown}
        style={menuStyle}
        role="menu"
      >
        {files.map((item) => (
          <a
            key={item.type}
            className={styles.menuItemLink}
            href={pdfHref(item.type)}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            {item.label}
          </a>
        ))}
      </div>,
      document.body,
    )
    : null;

  return (
    <div className={styles.menuWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.slFilesBtn}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
          <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
        </svg>
        Files
        <span className={styles.slFilesCount}>{files.length}</span>
      </button>
      {menu}
    </div>
  );
}

export default function OpsVcAgencyLetterPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';
  const tabParam = Number(searchParams.get('tab') || 1);
  const flashMsg = searchParams.get('msg');
  const flash = useTimedFlash(flashMsg != null && flashMsg !== '' ? FLASH[Number(flashMsg)] : null);
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
  const savedRecords = activePort?.records || [];

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

  const addEntity = () => {
    const last = draft.entities[draft.entities.length - 1];
    if (!last?.entity || !last?.name || !last?.email) {
      setError('Please fill all Business Entity values before adding another row.');
      return;
    }
    setError('');
    patchDraft({ entities: [...draft.entities, emptyEntity()] });
  };

  const addBunker = () => {
    const last = draft.bunkers[draft.bunkers.length - 1];
    if (!last?.grade || !last?.supplier || !last?.physical) {
      setError('Please fill Grade, Supplier and Physical before adding another bunker row.');
      return;
    }
    setError('');
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

  return (
    <>
      <OpsVcBackHeaderActions backHref={backHref} disabled={loading || saving} />

      <div className={`zafira-page ${pageStyles.page}`}>
        {(loading || saving) ? <LoadingOverlay show={loading || saving} fullScreen={false} /> : null}
        {flash ? (
          <div className={flash.type === 'error' ? pageStyles.error : pageStyles.flashSuccess}>{flash.text}</div>
        ) : null}
        {error ? <div className={pageStyles.error}>{error}</div> : null}

        {!loading && !form?.ports?.length ? (
          <div className={pageStyles.empty}>
            No load/discharge ports found on the cost sheet
            {form?.costSheetId ? ` (sheet ${form.costSheetId}` : ''}
            {form?.legsCount != null ? `, ${form.legsCount} leg(s)` : ''}
            {form?.costSheetId ? ')' : ''}.
            {' '}Add port agents on the FVF cost sheet, then reopen this page.
          </div>
        ) : null}

        {form?.ports?.length ? (
          <>
            {(form?.nomId || form?.vesselName) ? (
              <div className={styles.voyChip}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="5" r="2.2" />
                  <path d="M12 7.2V21" />
                  <path d="M8 10h8" />
                  <path d="M4 13a8 8 0 0 0 16 0" />
                </svg>
                {form.nomId || '—'}
                {form.vesselName ? (
                  <>
                    <span className={styles.vcSep}>·</span>
                    {form.vesselName}
                  </>
                ) : null}
              </div>
            ) : null}

            <div className={styles.portTabs}>
              {form.ports.map((port) => (
                <button
                  key={port.key}
                  type="button"
                  className={port.key === activeKey ? `${styles.portTab} ${styles.portTabActive}` : styles.portTab}
                  onClick={() => setActiveKey(port.key)}
                >
                  <span className={styles.ptIco}>
                    <PortTypeIcon portType={port.portType} />
                  </span>
                  {port.tabLabel}
                </button>
              ))}
            </div>

            {activePort && draft ? (
              <div className={styles.gprlLayout}>
                <div className={styles.gprlMain}>
                  <div className={styles.formCard}>
                    <div className={styles.sectionBlock}>
                      <div className={styles.sectionHead}>
                        <div
                          className={`${styles.sectionIco} ${styles.sectionIcoNavy} ${styles.infoTrigger}`}
                          tabIndex={0}
                        >
                          <InfoIcon />
                          <DetailsInfoPopup />
                        </div>
                        <div className={styles.sectionTitles}>
                          <div className={styles.sectionTitle}>Details</div>
                          <div className={styles.sectionSub}>Core information used to draft the letter</div>
                        </div>
                      </div>
                      <div className={styles.fGrid}>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-date">Date</label>
                          <DmyDateInput
                            id="vc-agency-date"
                            value={draft.date}
                            onChange={(v) => patchDraft({ date: v })}
                            disabled={activePort.locked}
                          />
                        </div>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-vessel">Vessel</label>
                          <TextInput id="vc-agency-vessel" value={form.vesselName || ''} readOnly />
                        </div>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-agent">Agent Name</label>
                          <TextInput
                            id="vc-agency-agent"
                            value={activePort.agentName || ''}
                            readOnly
                            placeholder="No agent on cost sheet"
                          />
                        </div>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-qty">Cargo Qty (MT)</label>
                          <TextInput
                            id="vc-agency-qty"
                            value={draft.qty}
                            onChange={(e) => patchDraft({ qty: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </div>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-country">Port Country</label>
                          {activePort.letter?.countryId ? (
                            <TextInput
                              id="vc-agency-country"
                              value={lookups.countries.find((c) => c.id === draft.countryId)?.name || draft.countryId}
                              readOnly
                            />
                          ) : (
                            <div className={styles.cardSelect}>
                              <CardSelect
                                id="vc-agency-country"
                                value={draft.countryId}
                                options={lookupOptions(lookups.countries)}
                                placeholder="---Select from list---"
                                ariaLabel="Port Country"
                                align="start"
                                disabled={activePort.locked}
                                onChange={(next) => patchDraft({ countryId: next })}
                              />
                            </div>
                          )}
                        </div>
                        <div className={`${styles.fItem} ${styles.fItemCred}`}>
                          <label htmlFor="vc-agency-username">Username</label>
                          <TextInput id="vc-agency-username" value={draft.username} readOnly placeholder="Username" />
                        </div>
                        <div className={`${styles.fItem} ${styles.fItemCred}`}>
                          <label htmlFor="vc-agency-password">Password</label>
                          <TextInput
                            id="vc-agency-password"
                            type="password"
                            value={draft.password}
                            onChange={(e) => patchDraft({ password: e.target.value })}
                            disabled={activePort.locked}
                            autoComplete="off"
                            placeholder="Password"
                          />
                        </div>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-eta-date">ETA Date</label>
                          <DmyDateInput
                            id="vc-agency-eta-date"
                            enableTime
                            value={draft.etaDate1}
                            onChange={(v) => patchDraft({ etaDate1: v })}
                            disabled={activePort.locked}
                          />
                        </div>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-master-name">Master&apos;s Name</label>
                          <TextInput
                            id="vc-agency-master-name"
                            value={draft.masterName}
                            onChange={(e) => patchDraft({ masterName: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </div>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-cargo-details">Cargo Details</label>
                          <TextInput
                            id="vc-agency-cargo-details"
                            value={draft.cargoDetails}
                            onChange={(e) => patchDraft({ cargoDetails: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </div>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-tolerance">Tolerance / Terms</label>
                          <TextInput
                            id="vc-agency-tolerance"
                            value={draft.tolerance}
                            onChange={(e) => patchDraft({ tolerance: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </div>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-ship-owner">Ship Owner</label>
                          <div className={styles.cardSelect}>
                            <CardSelect
                              id="vc-agency-ship-owner"
                              value={draft.shipOwner}
                              options={lookupOptions(lookups.shipOwners)}
                              placeholder="---Select from list---"
                              ariaLabel="Ship Owner"
                              align="start"
                              disabled={activePort.locked}
                              onChange={(next) => patchDraft({ shipOwner: next })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.sectionBlock}>
                      <table className={styles.miniAddTable}>
                        <thead>
                          <tr>
                            <th style={{ width: 36 }}>#</th>
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
                                    className={`${styles.circleBtn} ${styles.circleBtnDel}`}
                                    title="Remove"
                                    onClick={() => patchDraft({
                                      entities: draft.entities.filter((_, i) => i !== index).length
                                        ? draft.entities.filter((_, i) => i !== index)
                                        : [emptyEntity()],
                                    })}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                                      <path d="M6 6l12 12M18 6L6 18" />
                                    </svg>
                                  </button>
                                ) : '—'}
                              </td>
                              <td>
                                <div className={styles.cardSelect}>
                                  <CardSelect
                                    value={row.entity}
                                    options={lookupOptions(lookups.entityTypes)}
                                    placeholder="---Select from list---"
                                    ariaLabel="Business Entity"
                                    align="start"
                                    disabled={activePort.locked}
                                    onChange={(next) => patchEntity(index, { entity: next })}
                                  />
                                </div>
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
                      {!activePort.locked ? (
                        <button type="button" className={styles.addRowBtn} onClick={addEntity}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                          Add
                        </button>
                      ) : null}
                    </div>

                    <div className={styles.sectionBlock}>
                      <div className={styles.sectionHead}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoTeal}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M12 2s6 6.9 6 11.2A6 6 0 0 1 6 13.2C6 8.9 12 2 12 2z" />
                          </svg>
                        </div>
                        <div className={styles.sectionTitles}>
                          <div className={styles.sectionTitle}>Bunkers Stemmed (Letters to Master and Agents)</div>
                        </div>
                      </div>
                      <div className={`${styles.fGrid} ${styles.bunkerFields}`}>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-bunker-eta">ETA (LT)</label>
                          <DmyDateInput
                            id="vc-agency-bunker-eta"
                            enableTime
                            value={draft.etaDate}
                            onChange={(v) => patchDraft({ etaDate: v })}
                            disabled={activePort.locked}
                          />
                        </div>
                        <div className={styles.fItem}>
                          <label htmlFor="vc-agency-bunker-surveyor">Bunker Surveyor (Name)</label>
                          <TextInput
                            id="vc-agency-bunker-surveyor"
                            value={draft.bunkerSurveyor}
                            onChange={(e) => patchDraft({ bunkerSurveyor: e.target.value })}
                            disabled={activePort.locked}
                          />
                        </div>
                        <div className={`${styles.fItem} ${styles.fItemGrow}`}>
                          <label htmlFor="vc-agency-bunker-surveyor-com">Bunker Surveyor (Company and Contact)</label>
                          <TextInput
                            id="vc-agency-bunker-surveyor-com"
                            value={draft.bunkerSurveyorCom}
                            onChange={(e) => patchDraft({ bunkerSurveyorCom: e.target.value })}
                            disabled={activePort.locked}
                            placeholder="Company name and contact details"
                          />
                        </div>
                      </div>

                      <table className={styles.miniAddTable}>
                        <thead>
                          <tr>
                            <th style={{ width: 36 }}>#</th>
                            <th>Bunkering Port</th>
                            <th>Grade</th>
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
                                    className={`${styles.circleBtn} ${styles.circleBtnDel}`}
                                    title="Remove"
                                    onClick={() => patchDraft({
                                      bunkers: draft.bunkers.filter((_, i) => i !== index).length
                                        ? draft.bunkers.filter((_, i) => i !== index)
                                        : [emptyBunker()],
                                    })}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                                      <path d="M6 6l12 12M18 6L6 18" />
                                    </svg>
                                  </button>
                                ) : '—'}
                              </td>
                              <td>
                                <div className={styles.cardSelect}>
                                  <CardSelect
                                    value={row.bunkerPort}
                                    options={lookupOptions(lookups.ports)}
                                    placeholder="---Select from list---"
                                    ariaLabel="Bunkering Port"
                                    align="start"
                                    disabled={activePort.locked}
                                    onChange={(next) => patchBunker(index, { bunkerPort: next })}
                                  />
                                </div>
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
                      {!activePort.locked ? (
                        <button type="button" className={styles.addRowBtn} onClick={addBunker}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                          Add
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={styles.gprlSide}>
                  <div className={styles.lettersCard}>
                    <div className={styles.lettersCardHead}>
                      <div className={styles.lcIco}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
                          <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
                          <path d="M8 12h8" />
                          <path d="M8 15.5h8" />
                          <path d="M8 19h3" />
                        </svg>
                      </div>
                      <div className={styles.lcTitle}>Saved Letters</div>
                      <div className={styles.lcCount}>{savedRecords.length}</div>
                    </div>
                    <div className={styles.lettersCardBody}>
                      {!savedRecords.length ? (
                        <div className={styles.lettersEmpty}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
                            <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
                          </svg>
                          <div>No saved letters yet.</div>
                        </div>
                      ) : savedRecords.map((record) => (
                        <div key={record.genAgencyId} className={styles.savedLetter}>
                          <div className={styles.slTop}>
                            <span className={styles.slPort}>
                              {[record.portName, record.countryName].filter(Boolean).join(', ') || '—'}
                            </span>
                            <div className={styles.slActions}>
                              <button
                                type="button"
                                className={styles.circleBtn}
                                title="Cancel"
                                onClick={() => handleDelete(record)}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                                  <path d="M6 6l12 12M18 6L6 18" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className={styles.slMeta}>
                            {[record.agentName || 'No agent on cost sheet', record.username].filter(Boolean).join(' · ')}
                          </div>
                          {record.date ? (
                            <div className={styles.slMeta}>Saved {record.date}</div>
                          ) : null}
                          <SavedLetterFilesMenu
                            record={record}
                            portType={activePort.portType}
                            comId={comId}
                            activePort={activePort}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {!activePort.locked ? (
                    <div className={styles.gprlBottomActions}>
                      <div className={styles.gprlNote}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M12 9v4" />
                          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <path d="M12 17h.01" />
                        </svg>
                        Click on &quot;Submit&quot; to ensure that the agent fills the assigned data correctly.
                      </div>
                      <div className={styles.gprlFooterActions}>
                        <Button
                          type="button"
                          variant="saveOutline"
                          label="Save"
                          onClick={() => handleSubmit(1)}
                          disabled={saving}
                        />
                        <Button
                          type="button"
                          variant="submit"
                          label="Submit"
                          onClick={() => handleSubmit(2)}
                          disabled={saving}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
