import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import styles from './OpsDocumentsPage.module.css';

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20V4" />
      <path d="M5 11l7-7 7 7" />
    </svg>
  );
}

function CircleDeleteButton({ onClick, disabled, title = 'Remove' }) {
  return (
    <button
      type="button"
      className={`${styles.circleBtn} ${styles.circleBtnDel}`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M18 6 6 18" />
        <path d="M6 6l12 12" />
      </svg>
    </button>
  );
}

function Dropzone({
  inputRef,
  active,
  disabled,
  onActivate,
  onDeactivate,
  onFiles,
  hint,
  subHint,
}) {
  return (
    <>
      <input
        ref={inputRef}
        className={styles.hiddenFileInput}
        type="file"
        multiple
        disabled={disabled}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <div
        className={[
          styles.dropzone,
          active ? styles.dropzoneActive : '',
          disabled ? styles.dropzoneDisabled : '',
        ].filter(Boolean).join(' ')}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          onActivate();
        }}
        onDragLeave={onDeactivate}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          onDeactivate();
          onFiles(event.dataTransfer?.files);
        }}
      >
        <div className={styles.dropzoneIcon}>
          <UploadIcon />
        </div>
        <div className={styles.dropzoneText}>
          <b>{hint || 'Click to upload'}</b>
          {' '}
          or drag and drop
          {subHint ? (
            <>
              <br />
              {subHint}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function DocSection({
  id,
  headClass,
  iconClass,
  icon,
  title,
  subtitle,
  note,
  className,
  children,
}) {
  return (
    <div className={[styles.cfSection, className].filter(Boolean).join(' ')} id={id}>
      <div className={`${styles.cfSectionHead} ${headClass}`}>
        <div className={styles.cfSectionTitleWrap}>
          <div className={`${styles.sectionIco} ${iconClass}`}>
            {icon}
          </div>
          <div>
            <div className={styles.cfSectionTitle}>{title}</div>
            <div className={styles.cfSectionSub}>{subtitle}</div>
          </div>
        </div>
      </div>
      {note ? (
        <div className={styles.docSectionNote}>
          <InfoIcon />
          <span>{note}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

function voyForwardAddress(nomId) {
  const slug = String(nomId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `voy-${slug}-docs@mail.sevenoceans.io` : 'voy-docs@mail.sevenoceans.io';
}

const PLACEHOLDER_EMAILS = [
  {
    id: 'sample-1',
    subject: 'RE: NOR Tendering - Tobruk',
    date: '31-Aug-2026, 09:14',
    from: 'ops@charterercorp.com',
    snippet: 'Please find attached the acknowledged NOR along with the port agent\'s remarks for your records.',
    attachments: 1,
  },
  {
    id: 'sample-2',
    subject: 'Bunker nomination confirmation - Vassiliko',
    date: '27-Aug-2026, 16:42',
    from: 'bunkers@supplierco.com',
    snippet: 'Confirming the bunker stem as discussed on call. Supply schedule and grade breakdown attached.',
    attachments: 2,
  },
  {
    id: 'sample-3',
    subject: 'Statement of Facts - Care-Houston',
    date: '01-Sep-2026, 11:05',
    from: 'agent@barwilagencies.com',
    snippet: 'Please find attached the signed SOF for the load port along with the time sheet.',
    attachments: 2,
  },
  {
    id: 'sample-4',
    subject: 'RE: Discharge berth allocation',
    date: '29-Aug-2026, 08:52',
    from: 'ops@charterercorp.com',
    snippet: 'Berth 4 confirmed for discharge. Please advise vessel ETA update once available.',
    attachments: 0,
  },
  {
    id: 'sample-5',
    subject: 'Notice of Readiness - New Orleans',
    date: '28-Aug-2026, 14:10',
    from: 'agent@gulfportservices.com',
    snippet: 'NOR tendered 20 Oct 2026, 0900 hrs. Awaiting berth confirmation from terminal.',
    attachments: 1,
  },
  {
    id: 'sample-6',
    subject: 'Owner\'s P&I Club confirmation',
    date: '25-Aug-2026, 09:47',
    from: 'claims@piclubgroup.com',
    snippet: 'Confirming cover is in place for this voyage. Certificate of entry attached for your records.',
    attachments: 1,
  },
  {
    id: 'sample-7',
    subject: 'Freight invoice queries - INV-26012-01',
    date: '24-Aug-2026, 16:33',
    from: 'accounts@charterercorp.com',
    snippet: 'A couple of line items on the freight invoice need clarification before we can process payment.',
    attachments: 0,
  },
  {
    id: 'sample-8',
    subject: 'Draft survey report - loading complete',
    date: '30-Aug-2026, 17:20',
    from: 'surveyor@independentmarine.com',
    snippet: 'Draft survey attached showing final loaded quantity. Please countersign and return.',
    attachments: 1,
  },
];

const SIMULATED_EMAIL = {
  subject: 'Incoming: Agency appointment confirmation',
  from: 'ops@portagent.com',
  snippet: 'Agency appointment confirmed for this voyage. Please file the attached nomination against the port call.',
  attachments: 1,
};

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function nowEmailStamp() {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', '');
}

export default function OpsDocumentsPageContent({
  comId,
  fetchDocuments,
  createDocument,
  deleteDocument,
}) {
  const confirm = useConfirm();
  const genericInputRef = useRef(null);
  const invoiceInputRef = useRef(null);
  const docMainRef = useRef(null);
  const emailStickyRef = useRef(null);
  const filterPopRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dropActive, setDropActive] = useState('');
  const [copied, setCopied] = useState(false);
  const [genericEdits, setGenericEdits] = useState({});
  const [pendingFinancial, setPendingFinancial] = useState([]);
  const [emails, setEmails] = useState(PLACEHOLDER_EMAILS);
  const [emailQuery, setEmailQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const forwardAddress = useMemo(
    () => voyForwardAddress(data?.nomId),
    [data?.nomId],
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchDocuments(comId);
      setData(result);
    } catch (err) {
      setData(null);
      setError(err.message || 'Failed to load documents.');
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

  const uploadGenericFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setSaving(true);
    setError('');
    try {
      for (const file of files) {
        await createDocument(comId, { fileName: file.name }, [file]);
      }
      await load();
    } catch (err) {
      setError(err.message || 'Failed to upload document.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure to remove this document permanently ?',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      await deleteDocument(comId, doc.storedFiles);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete document.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyForward = async () => {
    try {
      await navigator.clipboard.writeText(forwardAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy address to clipboard.');
    }
  };

  const addPendingFinancial = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setPendingFinancial((current) => [
      ...files.map((file, index) => ({
        id: `pending-${Date.now()}-${index}`,
        particular: file.name,
        type: 'Invoice',
        number: '',
        uploaded: todayLabel(),
      })),
      ...current,
    ]);
  };

  const filteredEmails = useMemo(() => {
    const q = emailQuery.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter((email) => (
      email.subject.toLowerCase().includes(q) || email.from.toLowerCase().includes(q)
    ));
  }, [emails, emailQuery]);

  const simulateIncoming = () => {
    setEmails((current) => [{
      id: `sim-${Date.now()}`,
      ...SIMULATED_EMAIL,
      date: nowEmailStamp(),
    }, ...current]);
  };

  const refreshEmails = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 700);
  };

  useEffect(() => {
    if (!filterOpen) return undefined;
    const onPointerDown = (event) => {
      if (!filterPopRef.current?.contains(event.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [filterOpen]);

  useLayoutEffect(() => {
    const main = docMainRef.current;
    const side = emailStickyRef.current;
    if (!main || !side) return undefined;

    const sync = () => {
      if (window.innerWidth <= 1100) {
        side.style.height = '';
        return;
      }
      side.style.height = `${main.getBoundingClientRect().height}px`;
    };

    sync();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(main);
    window.addEventListener('resize', sync);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [data, pendingFinancial, loading]);

  const voyLabelParts = [data?.nomId, data?.vesselName].filter(Boolean);
  const financialRows = [
    ...pendingFinancial,
    ...(data?.invoiceAttachments || []).map((row, index) => ({
      id: `saved-${index}`,
      particular: row.particular || '',
      type: row.type || 'Invoice',
      number: row.number || '',
      uploaded: 'On file',
      saved: true,
    })),
  ];

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? <LoadingOverlay show={loading || saving} fullScreen={false} /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.pageSubhead}>
        Vessel and cargo documentation for this voyage
      </div>

      {voyLabelParts.length ? (
        <div className={styles.voyChip}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="5" r="2.2" />
            <path d="M12 7.2V21" />
            <path d="M8 10h8" />
            <path d="M4 13a8 8 0 0 0 16 0" />
          </svg>
          {data?.nomId || '—'}
          {data?.vesselName ? (
            <>
              <span className={styles.vcSep}>·</span>
              {data.vesselName}
            </>
          ) : null}
        </div>
      ) : null}

      <div className={styles.docLayout}>
        <div className={styles.docMain} ref={docMainRef}>
          <DocSection
            id="sec-generic"
            headClass={styles.cfSectionHeadNavy}
            iconClass={styles.sectionIcoNavy}
            title="Generic Files"
            subtitle="General documents attached to this voyage"
            note="Any general document relevant to this voyage — reports, checklists, correspondence not tied to a specific invoice."
            icon={(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M9 13h6" />
                <path d="M9 17h6" />
              </svg>
            )}
          >
            <div className={styles.docBody}>
              <div className={styles.docDzRow}>
                <Dropzone
                  inputRef={genericInputRef}
                  active={dropActive === 'generic'}
                  disabled={loading || saving}
                  onActivate={() => setDropActive('generic')}
                  onDeactivate={() => setDropActive('')}
                  onFiles={uploadGenericFiles}
                  subHint="PDF, Word, Excel up to 20MB"
                />
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.cfTable}>
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Uploaded</th>
                      <th>Details</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.documents || []).map((doc) => {
                      const edit = genericEdits[doc.id] || {};
                      const fileName = edit.fileName ?? doc.fileName ?? '';
                      const details = edit.details ?? '';
                      const href = doc.attachments?.[0]?.url;
                      return (
                        <tr key={doc.id}>
                          <td className={`${styles.accentCell} ${styles.accentNavy}`}>
                            <input
                              className={`${styles.cfInp} ${styles.rowNameInp}`}
                              value={fileName}
                              onChange={(event) => setGenericEdits((current) => ({
                                ...current,
                                [doc.id]: { ...current[doc.id], fileName: event.target.value },
                              }))}
                            />
                          </td>
                          <td>
                            {href ? (
                              <a className={styles.docUploadChip} href={href} target="_blank" rel="noreferrer">
                                <CheckIcon />
                                {todayLabel()}
                              </a>
                            ) : (
                              <span className={styles.docUploadChip}>
                                <CheckIcon />
                                On file
                              </span>
                            )}
                          </td>
                          <td>
                            <input
                              className={styles.cfInp}
                              value={details}
                              placeholder="Details"
                              onChange={(event) => setGenericEdits((current) => ({
                                ...current,
                                [doc.id]: { ...current[doc.id], details: event.target.value },
                              }))}
                            />
                          </td>
                          <td style={{ width: 40 }}>
                            <CircleDeleteButton
                              disabled={loading || saving}
                              onClick={() => handleDelete(doc)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && !(data?.documents || []).length ? (
                      <tr className={styles.cfEmptyRow}>
                        <td colSpan={4}>No documents uploaded yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </DocSection>

          <DocSection
            id="sec-financial"
            headClass={styles.cfSectionHeadTeal}
            iconClass={styles.sectionIcoTeal}
            title="Financial Elements"
            subtitle="Financial paperwork supporting the SOA for this voyage"
            note="Attach the source document behind an invoice, statement or payment — tag its type and reference so it's easy to match against the Cashflow page."
            icon={(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" />
                <path d="M9 7h6" />
                <path d="M9 11h6" />
                <path d="M9 15h4" />
              </svg>
            )}
          >
            <div className={styles.docBody}>
              <div className={styles.docDzRow}>
                <Dropzone
                  inputRef={invoiceInputRef}
                  active={dropActive === 'invoice'}
                  disabled={loading || saving}
                  onActivate={() => setDropActive('invoice')}
                  onDeactivate={() => setDropActive('')}
                  onFiles={addPendingFinancial}
                  subHint="Invoices, SOAs, payment confirmations"
                />
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.cfTable}>
                  <thead>
                    <tr>
                      <th>Particular</th>
                      <th>Type</th>
                      <th>Invoice/Statement/Payment No.</th>
                      <th>Uploaded</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {financialRows.map((row) => (
                      <tr key={row.id}>
                        <td className={`${styles.accentCell} ${styles.accentTeal}`}>
                          <input
                            className={`${styles.cfInp} ${styles.rowNameInp}`}
                            value={row.particular}
                            onChange={(event) => {
                              if (row.saved) return;
                              const value = event.target.value;
                              setPendingFinancial((current) => current.map((item) => (
                                item.id === row.id ? { ...item, particular: value } : item
                              )));
                            }}
                            readOnly={row.saved}
                          />
                        </td>
                        <td>
                          <select
                            className={styles.docTypeSelect}
                            value={row.type || 'Invoice'}
                            disabled={row.saved}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPendingFinancial((current) => current.map((item) => (
                                item.id === row.id ? { ...item, type: value } : item
                              )));
                            }}
                          >
                            <option>Invoice</option>
                            <option>Statement</option>
                            <option>Payment</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className={`${styles.cfInp} ${styles.rowInpSm}`}
                            value={row.number}
                            placeholder="Reference No."
                            readOnly={row.saved}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPendingFinancial((current) => current.map((item) => (
                                item.id === row.id ? { ...item, number: value } : item
                              )));
                            }}
                          />
                        </td>
                        <td>
                          <span className={styles.docUploadChip}>
                            <CheckIcon />
                            {row.uploaded || todayLabel()}
                          </span>
                        </td>
                        <td style={{ width: 40 }}>
                          <CircleDeleteButton
                            onClick={() => {
                              if (row.saved) return;
                              setPendingFinancial((current) => current.filter((item) => item.id !== row.id));
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                    {!financialRows.length ? (
                      <tr className={styles.cfEmptyRow}>
                        <td colSpan={5}>No invoice / payment attachments.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </DocSection>
        </div>

        <div className={styles.docSide}>
          <div className={styles.docSideSticky} ref={emailStickyRef}>
            <DocSection
              id="sec-email"
              className={styles.emailPanel}
              headClass={styles.cfSectionHeadPurple}
              iconClass={styles.sectionIcoPurple}
              title="Emails"
              subtitle="Correspondence received or logged for this voyage"
              icon={(
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <path d="m3.5 6.5 8.5 6 8.5-6" />
                </svg>
              )}
            >
              <div className={styles.emailForwardBar}>
                <span className={styles.emailForwardLabel}>Auto-file to</span>
                <span className={styles.emailForwardAddr}>{forwardAddress}</span>
                <button type="button" className={styles.emailCopyBtn} onClick={handleCopyForward}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="9" y="9" width="12" height="12" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <span className={styles.emailCopyHint}>
                  Forward or CC this address and the email files here automatically.
                </span>
              </div>
              <div className={styles.emailActionRow}>
                <button type="button" className={styles.btnOutlineSm} onClick={simulateIncoming}>
                  + incoming
                </button>
                <button
                  type="button"
                  className={`${styles.emailIconBtn} ${refreshing ? styles.emailIconBtnSpin : ''}`}
                  title="Integrate / Refresh emails"
                  onClick={refreshEmails}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 12a9 9 0 1 1-2.6-6.3" />
                    <path d="M21 4v6h-6" />
                  </svg>
                </button>
                <div className={styles.emailFilterWrap} ref={filterPopRef}>
                  <button
                    type="button"
                    className={styles.emailIconBtn}
                    title="Filter emails"
                    onClick={() => setFilterOpen((open) => !open)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                  </button>
                  {filterOpen ? (
                    <div className={styles.emailFilterPop}>
                      <div className={styles.emailSearchBox}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <circle cx="11" cy="11" r="7" />
                          <path d="m20 20-3.5-3.5" />
                        </svg>
                        <input
                          type="text"
                          value={emailQuery}
                          placeholder="Filter by subject or sender..."
                          autoFocus
                          onChange={(event) => setEmailQuery(event.target.value)}
                        />
                      </div>
                      {emailQuery ? (
                        <div className={styles.emailFilterCount}>
                          {filteredEmails.length}
                          {' '}
                          match
                          {filteredEmails.length === 1 ? '' : 'es'}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              {emailQuery && !filteredEmails.length ? (
                <div className={styles.emailFilterEmpty}>No emails match your filter.</div>
              ) : null}
              <div className={styles.emailList}>
                {filteredEmails.map((email) => (
                  <div key={email.id} className={styles.emailRow}>
                    <div className={styles.emailIco}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="3" y="5" width="18" height="14" rx="2.5" />
                        <path d="m3.5 6.5 8.5 6 8.5-6" />
                      </svg>
                    </div>
                    <div className={styles.emailMain}>
                      <div className={styles.emailTop}>
                        <span className={styles.emailSubject}>{email.subject}</span>
                        <span className={styles.emailDate}>{email.date}</span>
                      </div>
                      <div className={styles.emailFrom}>{email.from}</div>
                      <div className={styles.emailSnippet}>{email.snippet}</div>
                      {email.attachments ? (
                        <div className={styles.emailMetaRow}>
                          <span className={styles.emailAttachChip}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M21.4 11.5 12.3 20.6a5 5 0 0 1-7.1-7.1L14.3 4.4a3.5 3.5 0 0 1 5 5L10.2 18.5a2 2 0 0 1-2.9-2.9l8-8" />
                            </svg>
                            {email.attachments}
                            {' '}
                            attachment
                            {email.attachments === 1 ? '' : 's'}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </DocSection>
          </div>
        </div>
      </div>
    </div>
  );
}
