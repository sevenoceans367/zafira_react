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
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  deleteAgencyLetter,
  fetchAgencyLetterForm,
  saveAgencyLetter,
} from '../../../services/opsVc.js';
import OpsVcBackHeaderActions from './OpsVcBackHeaderActions.jsx';
import { PortTabLabel } from './portTabLabel.jsx';
import OpsVcAgencyLetterPreviewModal from './OpsVcAgencyLetterPreviewModal.jsx';
import pageStyles from './OpsPages.module.css';
import styles from './OpsVcAgencyLetterPage.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

const FLASH = {
  0: { type: 'success', text: 'Agency Letter Generation added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! this agent is already exists for this port.' },
};

const DEFAULT_AGENT_LETTER_TEXT = 'Please quote ALL IN agency fee. In addition, please advise the usual port restrictions for this vessel type.';

const AGENT_LETTER_TYPES = [
  { id: 'pda', label: 'PDA Request', color: 'orange', pdfType: 'pda', nonTpOnly: true, hasPreview: true },
  { id: 'nomination', label: 'Agency Nomination', color: 'blue', pdfType: 'nomination', nonTpOnly: true, hasPreview: true },
  { id: 'agent-bunker', label: 'Bunkers Stemmed', color: 'teal', pdfType: 'agent-bunker', hasPreview: true },
];

const MASTER_LETTER_TYPES = [
  { id: 'voyage', label: 'Voyage Instructions', color: 'amber', pdfType: 'voyage', hasPreview: true },
  { id: 'master-bunker', label: 'Bunkers Stemmed', color: 'teal', pdfType: 'master-bunker', hasPreview: true },
];

const PDF_TYPES = [
  { type: 'pda', label: 'PDA Request Letter', nonTpOnly: true },
  { type: 'nomination', label: 'Agency Nomination Letter', nonTpOnly: true },
  { type: 'agent-bunker', label: 'Bunkers Stemmed (Agent)' },
  { type: 'voyage', label: 'Voyage Instructions Letter' },
  { type: 'master-bunker', label: 'Bunkers Stemmed (Master)' },
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

function todayDmy() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${now.getFullYear()}`;
}

function draftFromPort(port, form) {
  const letter = port.letter;
  const cargoDetails = letter?.cargoDetails || form.cargoDefault || '';
  const tolerance = letter?.tolerance || form.toleranceDefault || '';
  return {
    genAgencyId: letter?.genAgencyId || '',
    date: letter?.date || todayDmy(),
    qty: letter?.qty != null && letter.qty !== '' ? String(letter.qty) : String(port.qty || ''),
    countryId: letter?.countryId || '',
    username: letter?.username || port.defaultUsername || '',
    password: letter?.password || '',
    etaDate1: letter?.etaDate1 || port.etaNoon || port.etaFixture || '',
    masterName: letter?.masterName || '',
    cargoDetails,
    tolerance,
    shipOwner: letter?.shipOwner || '',
    etaDate: letter?.etaDate || '',
    bunkerSurveyor: letter?.bunkerSurveyor || '',
    bunkerSurveyorCom: letter?.bunkerSurveyorCom || '',
    entities: (port.entities?.length ? port.entities : [emptyEntity()]).map((row) => ({ ...row })),
    bunkers: (port.bunkers?.length ? port.bunkers : [emptyBunker()]).map((row) => ({ ...row })),
    agentLetterType: 'pda',
    masterLetterType: 'voyage',
    agentLetterText: DEFAULT_AGENT_LETTER_TEXT,
    masterLetterText: [cargoDetails, tolerance ? `Tolerance / Terms: ${tolerance}` : '']
      .filter(Boolean)
      .join('\n\n') || cargoDetails,
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

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
      <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
      <path d="M8 12h8" />
      <path d="M8 15.5h8" />
      <path d="M8 19h3" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function MasterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 18h18" />
      <path d="M5 18V9l7-4 7 4v9" />
      <path d="M9 18v-5h6v5" />
    </svg>
  );
}

function DetailsInfoPopup() {
  return (
    <div className={styles.infoPop}>
      <div className={styles.infoPopTitle}>How this page works</div>
      <ol className={styles.infoPopSteps}>
        <li>
          Vessel, voyage and cargo <b>Details</b> are filled in for you — grey fields are pulled from earlier system entries, white fields stay editable.
        </li>
        <li>
          Click a coloured letter button under Letters to Agent / Letters to Master to select that type and open a live <b>preview</b>. Only one letter type can be active at a time; types without a preview stay disabled.
        </li>
        <li>
          Adjust the <b>Letter Text</b> to suit the selected letter.
        </li>
        <li>
          <span className={styles.infoPopIco}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </span>
          From the preview, <b>download the PDF</b> or open it in a new tab.
        </li>
        <li>
          Once sent, the letter appears under that section&apos;s own <b>Saved Letters</b>.
        </li>
      </ol>
    </div>
  );
}

function pdfHrefFor(record, type, comId, activePort) {
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
}

function SavedLetterFilesMenu({ record, portType, comId, activePort }) {
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

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
            href={pdfHrefFor(record, item.type, comId, activePort)}
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
        <DocIcon />
        Files
        <span className={styles.slFilesCount}>{files.length}</span>
      </button>
      {menu}
    </div>
  );
}

function SavedLettersDropdown({
  records,
  comId,
  activePort,
  locked,
  onDelete,
}) {
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const grouped = useMemo(() => {
    const byType = { LP: [], DP: [], TP: [], OTHER: [] };
    records.forEach((record) => {
      const type = String(record.portType || activePort?.portType || '').toUpperCase();
      if (byType[type]) byType[type].push(record);
      else byType.OTHER.push(record);
    });
    return byType;
  }, [records, activePort]);

  const updateMenuPosition = () => {
    const trigger = wrapRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 300;
    setMenuStyle({
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${Math.min(rect.left, window.innerWidth - width - 8)}px`,
      minWidth: `${width}px`,
      maxHeight: '420px',
      overflowY: 'auto',
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

  const renderGroup = (label, rows) => {
    if (!rows.length) return null;
    return (
      <React.Fragment key={label}>
        <div className={styles.savedGroupLabel}>{label}</div>
        {rows.map((record) => {
          const portType = record.portType || activePort?.portType || '';
          return (
            <div key={record.genAgencyId} className={styles.savedRow}>
              <div className={styles.slTop}>
                <div className={styles.slPortWrap}>
                  <span className={styles.slPort}>
                    {[record.portName, record.countryName].filter(Boolean).join(', ') || '—'}
                  </span>
                  {portType ? (
                    <span className={`${styles.chipPort} ${styles[`chipPort${portType}`] || ''}`}>
                      {portType}
                    </span>
                  ) : null}
                </div>
                {!locked ? (
                  <button
                    type="button"
                    className={`${styles.circleBtn} ${styles.circleBtnDel}`}
                    title="Remove"
                    onClick={() => onDelete(record)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                ) : null}
              </div>
              <div className={styles.slMeta}>
                {[record.agentName || 'No agent on cost sheet', record.username].filter(Boolean).join(' · ')}
              </div>
              {record.date ? <div className={styles.slMeta}>Saved {record.date}</div> : null}
              <SavedLetterFilesMenu
                record={record}
                portType={portType}
                comId={comId}
                activePort={activePort}
              />
            </div>
          );
        })}
      </React.Fragment>
    );
  };

  const menu = open && menuStyle && typeof document !== 'undefined'
    ? createPortal(
      <div ref={menuRef} className={`${styles.menuDropdown} ${styles.savedMenu}`} style={menuStyle} role="menu">
        {!records.length ? (
          <div className={styles.savedEmpty}>No saved letters yet.</div>
        ) : (
          <>
            {renderGroup('LP', grouped.LP)}
            {renderGroup('DP', grouped.DP)}
            {renderGroup('TP', grouped.TP)}
            {renderGroup('Other', grouped.OTHER)}
          </>
        )}
      </div>,
      document.body,
    )
    : null;

  return (
    <div className={styles.savedLtrWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.gprlQuickbtn} ${styles.savedTrigger}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <FolderIcon />
        Saved Letters
        <span className={styles.slFilesCount}>{records.length}</span>
      </button>
      {menu}
    </div>
  );
}

function focusMandatoryField(fieldId) {
  if (!fieldId || typeof document === 'undefined') return false;

  const byId = document.getElementById(fieldId);
  const byData = document.querySelector(`[data-field="${CSS.escape(fieldId)}"]`);
  const byLabel = document.querySelector(`label[for="${CSS.escape(fieldId)}"]`);
  const container = byData
    || byId?.closest('[class*="fItem"]')
    || byId?.closest('td')
    || byLabel?.parentElement
    || byId;

  let focusable = null;
  if (byId && typeof byId.focus === 'function' && !byId.disabled) {
    focusable = byId;
  } else if (byData) {
    focusable = byData.querySelector(
      'button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
    );
  }
  if (!focusable && container) {
    focusable = container.querySelector(
      'button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
    );
  }

  const scrollTarget = focusable || container || byData || byId;
  if (!scrollTarget) return false;

  scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

  if (container?.classList && pageStyles.fieldHighlight) {
    container.classList.add(pageStyles.fieldHighlight);
    window.setTimeout(() => container.classList.remove(pageStyles.fieldHighlight), 2500);
  }

  const applyFocus = () => {
    const el = focusable || document.getElementById(fieldId);
    if (!el || typeof el.focus !== 'function') return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    if (typeof el.select === 'function' && el.tagName === 'INPUT') {
      try { el.select(); } catch { /* ignore */ }
    }
  };

  applyFocus();
  window.requestAnimationFrame(() => {
    applyFocus();
    window.setTimeout(applyFocus, 50);
    window.setTimeout(applyFocus, 150);
    window.setTimeout(applyFocus, 300);
  });
  return true;
}

async function alertThenFocus(alertFn, alertOpts, fieldId) {
  focusMandatoryField(fieldId);
  await alertFn(alertOpts);
  await new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        focusMandatoryField(fieldId);
        resolve();
      }, 80);
    });
  });
}

function LetterQuickButtons({
  types,
  activeId,
  portType,
  locked = false,
  onSelect,
  onPreview,
}) {
  return (
    <div className={styles.gprlQuickbtnRow} role="radiogroup" aria-label="Letter type">
      {types.map((item) => {
        const blockedForTp = item.nonTpOnly && portType === 'TP';
        const noPreview = !item.hasPreview;
        const unavailable = blockedForTp || noPreview || locked;
        const isActive = activeId === item.id && !unavailable;
        const className = [
          styles.gprlQuickbtn,
          styles[`c${item.color[0].toUpperCase()}${item.color.slice(1)}`] || '',
          isActive ? styles.isActive : '',
          !isActive ? styles.muted : '',
        ].filter(Boolean).join(' ');

        let title = `Select and preview ${item.label}`;
        if (locked) title = 'Letter is locked';
        else if (blockedForTp) title = 'Not available for this port type';
        else if (noPreview) title = 'Preview not available yet';

        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={className}
            disabled={unavailable}
            title={title}
            onClick={() => {
              if (unavailable) return;
              onSelect(item.id);
              onPreview(item.id);
            }}
          >
            <DocIcon />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default function OpsVcAgencyLetterPage() {
  const confirm = useConfirm();
  const alert = useAlert();
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
  const [previewLetterId, setPreviewLetterId] = useState(null);

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
  const savedRecords = useMemo(() => {
    if (!form?.ports?.length) return [];
    return form.ports.flatMap((port) => port.records || []);
  }, [form]);
  const pdfRecord = useMemo(() => {
    if (draft?.genAgencyId) {
      return {
        genAgencyId: draft.genAgencyId,
        portType: activePort?.portType,
        portId: activePort?.portId,
        vendorId: activePort?.agentCode,
        randomId: activePort?.randomId,
      };
    }
    return (activePort?.records || [])[0] || null;
  }, [draft, activePort]);

  const patchDraft = (patch) => {
    setDrafts((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], ...patch },
    }));
  };

  const patchBunker = (index, patch) => {
    const bunkers = draft.bunkers.map((row, i) => (i === index ? { ...row, ...patch } : row));
    patchDraft({ bunkers });
  };

  const addBunker = async () => {
    const lastIndex = draft.bunkers.length - 1;
    const last = draft.bunkers[lastIndex];
    if (!last?.grade || !last?.supplier || !last?.physical) {
      const fieldId = !last?.grade
        ? `vc-agency-bunker-grade-${lastIndex}`
        : !last?.supplier
          ? `vc-agency-bunker-supplier-${lastIndex}`
          : `vc-agency-bunker-physical-${lastIndex}`;
      await alertThenFocus(alert, {
        title: 'Missing Information',
        message: 'Please fill Grade, Supplier and Physical before adding another bunker row.',
        confirmLabel: 'OK',
      }, fieldId);
      return;
    }
    setError('');
    patchDraft({ bunkers: [...draft.bunkers, emptyBunker()] });
  };

  const handleSubmit = async (submitId) => {
    if (!activePort || !draft) return;
    if (!activePort.agentCode) {
      await alertThenFocus(alert, {
        title: 'Missing Information',
        message: 'Please add Vendor in cost sheet for this port.',
        confirmLabel: 'OK',
      }, 'vc-agency-agent');
      return;
    }
    if (!draft.etaDate1) {
      await alertThenFocus(alert, {
        title: 'Missing Information',
        message: 'Please add ETA Date.',
        confirmLabel: 'OK',
      }, 'vc-agency-eta-date');
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
        cargoDetails: draft.masterLetterText || draft.cargoDetails,
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
      await alert({
        title: 'Error',
        message: err.message || 'Failed to save agency letter.',
        confirmLabel: 'OK',
      });
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
      await alert({
        title: 'Error',
        message: err.message || 'Failed to delete agency letter.',
        confirmLabel: 'OK',
      });
    } finally {
      setSaving(false);
    }
  };

  const showBunkerEditors = draft?.agentLetterType === 'agent-bunker'
    || draft?.masterLetterType === 'master-bunker';

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
                  <PortTabLabel label={port.tabLabel} />
                </button>
              ))}
            </div>

            {activePort && draft ? (
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
                    <div className={`${styles.fGrid} ${styles.detailsGrid}`}>
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
                        <label htmlFor="vc-agency-voyage">Voyage No</label>
                        <TextInput id="vc-agency-voyage" value={form.nomId || ''} readOnly />
                      </div>
                        <div className={styles.fItem} data-field="vc-agency-agent">
                        <label htmlFor="vc-agency-agent">Agent Name</label>
                        <TextInput
                          id="vc-agency-agent"
                          value={activePort.agentName || ''}
                          readOnly
                          placeholder="No agent on cost sheet"
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
                        <label htmlFor="vc-agency-qty">Cargo Qty (MT)</label>
                        <TextInput
                          id="vc-agency-qty"
                          value={draft.qty}
                          onChange={(e) => patchDraft({ qty: e.target.value })}
                          disabled={activePort.locked}
                        />
                      </div>
                      <div className={styles.fItem} data-field="vc-agency-eta-date">
                        <label htmlFor="vc-agency-eta-date">ETA Date</label>
                        <DmyDateInput
                          id="vc-agency-eta-date"
                          enableTime
                          value={draft.etaDate1}
                          onChange={(v) => patchDraft({ etaDate1: v })}
                          disabled={activePort.locked}
                        />
                      </div>
                      <div className={`${styles.fItem} ${styles.fItemCred}`}>
                        <label htmlFor="vc-agency-username">Username</label>
                        <TextInput id="vc-agency-username" value={draft.username} readOnly placeholder="Auto-generated once agent is selected" />
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
                          placeholder="Auto-generated once agent is selected"
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.sectionBlock}>
                    <div className={styles.sectionHead}>
                      <div className={`${styles.sectionIco} ${styles.sectionIcoBlue}`}>
                        <MailIcon />
                      </div>
                      <div className={styles.sectionTitles}>
                        <div className={styles.sectionTitle}>Letters to Agent</div>
                        <div className={styles.sectionSub}>Generate the letter sent to the appointed port agent</div>
                      </div>
                    </div>

                    <LetterQuickButtons
                      types={AGENT_LETTER_TYPES}
                      activeId={draft.agentLetterType}
                      portType={activePort.portType}
                      locked={activePort.locked}
                      onSelect={(id) => patchDraft({ agentLetterType: id })}
                      onPreview={(id) => setPreviewLetterId(id)}
                    />

                    <div className={`${styles.fItem} ${styles.ltrTextbox}`}>
                      <label htmlFor="vc-agency-agent-letter-text">Letter Text</label>
                      <textarea
                        id="vc-agency-agent-letter-text"
                        rows={2}
                        value={draft.agentLetterText}
                        disabled={activePort.locked}
                        onChange={(e) => patchDraft({ agentLetterText: e.target.value })}
                      />
                    </div>

                    <SavedLettersDropdown
                      records={savedRecords}
                      comId={comId}
                      activePort={activePort}
                      locked={activePort.locked}
                      onDelete={handleDelete}
                    />
                  </div>

                  <div className={styles.sectionBlock}>
                    <div className={styles.sectionHead}>
                      <div className={`${styles.sectionIco} ${styles.sectionIcoAmber}`}>
                        <MasterIcon />
                      </div>
                      <div className={styles.sectionTitles}>
                        <div className={styles.sectionTitle}>Letters to Master</div>
                        <div className={styles.sectionSub}>
                          Generate the voyage instructions or bunkers-stemmed letter sent to the Master
                        </div>
                      </div>
                    </div>

                    <LetterQuickButtons
                      types={MASTER_LETTER_TYPES}
                      activeId={draft.masterLetterType}
                      portType={activePort.portType}
                      locked={activePort.locked}
                      onSelect={(id) => patchDraft({ masterLetterType: id })}
                      onPreview={(id) => setPreviewLetterId(id)}
                    />

                    <div className={`${styles.fItem} ${styles.ltrTextbox}`}>
                      <label htmlFor="vc-agency-master-letter-text">Letter Text</label>
                      <textarea
                        id="vc-agency-master-letter-text"
                        rows={3}
                        value={draft.masterLetterText}
                        disabled={activePort.locked}
                        onChange={(e) => patchDraft({
                          masterLetterText: e.target.value,
                          cargoDetails: e.target.value,
                        })}
                      />
                    </div>

                    {showBunkerEditors ? (
                      <>
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
                                    id={`vc-agency-bunker-grade-${index}`}
                                    data-field={`vc-agency-bunker-grade-${index}`}
                                    value={row.grade}
                                    onChange={(e) => patchBunker(index, { grade: e.target.value })}
                                    disabled={activePort.locked}
                                  />
                                </td>
                                <td>
                                  <TextInput
                                    id={`vc-agency-bunker-supplier-${index}`}
                                    data-field={`vc-agency-bunker-supplier-${index}`}
                                    value={row.supplier}
                                    onChange={(e) => patchBunker(index, { supplier: e.target.value })}
                                    disabled={activePort.locked}
                                  />
                                </td>
                                <td>
                                  <TextInput
                                    id={`vc-agency-bunker-physical-${index}`}
                                    data-field={`vc-agency-bunker-physical-${index}`}
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
                      </>
                    ) : null}

                    <SavedLettersDropdown
                      records={savedRecords}
                      comId={comId}
                      activePort={activePort}
                      locked={activePort.locked}
                      onDelete={handleDelete}
                    />
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
                      Click on &quot;Save&quot; to ensure that the agent fills the assigned data correctly.
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
            ) : null}
          </>
        ) : null}
      </div>

      <OpsVcAgencyLetterPreviewModal
        open={Boolean(previewLetterId)}
        letterId={previewLetterId || 'pda'}
        onClose={() => setPreviewLetterId(null)}
        form={form}
        activePort={activePort}
        draft={draft}
        comId={comId}
        pdfRecord={pdfRecord}
      />
    </>
  );
}
