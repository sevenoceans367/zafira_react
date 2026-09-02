import React, { useEffect, useMemo, useRef, useState } from 'react';
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

function AttachmentChips({ attachments }) {
  if (!attachments?.length) return <span className={styles.muted}>—</span>;
  return (
    <div className={styles.docUploadStack}>
      {attachments.map((item) => (
        <a
          key={`${item.file}-${item.name}`}
          className={styles.docUploadChip}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          title="Click to view file"
        >
          <CheckIcon />
          {item.name}
        </a>
      ))}
    </div>
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
  children,
}) {
  return (
    <div className={styles.cfSection} id={id}>
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
];

export default function OpsDocumentsPageContent({
  comId,
  fetchDocuments,
  createDocument,
  deleteDocument,
}) {
  const confirm = useConfirm();
  const genericInputRef = useRef(null);
  const vesselInputRef = useRef(null);
  const invoiceInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const [copied, setCopied] = useState(false);

  const notifyUploadUnavailable = (section) => {
    setError(`Upload for ${section} is not available on this page yet. Use Generic Files for voyage documents.`);
  };

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

  const voyLabelParts = [data?.nomId, data?.vesselName].filter(Boolean);
  const vesselSubtitle = data?.vesselName
    ? `Documents from ${data.vesselName}'s vessel master record`
    : 'Documents from the vessel master record';

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? <LoadingOverlay show={loading || saving} fullScreen={false} /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.pageSubhead}>
        Vessel and cargo documentation for this voyage
        <span className={styles.tagSoft}>DOC</span>
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
              active={dropActive}
              disabled={loading || saving}
              onActivate={() => setDropActive(true)}
              onDeactivate={() => setDropActive(false)}
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
                {(data?.documents || []).map((doc) => (
                  <tr key={doc.id}>
                    <td className={`${styles.accentCell} ${styles.accentNavy}`}>
                      {doc.fileName || '—'}
                    </td>
                    <td>
                      <AttachmentChips attachments={doc.attachments} />
                    </td>
                    <td className={styles.muted}>
                      {(doc.attachments || []).length
                        ? `${doc.attachments.length} file${doc.attachments.length === 1 ? '' : 's'} on record`
                        : '—'}
                    </td>
                    <td style={{ width: 40 }}>
                      <CircleDeleteButton
                        disabled={loading || saving}
                        onClick={() => handleDelete(doc)}
                      />
                    </td>
                  </tr>
                ))}
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
        id="sec-vessel"
        headClass={styles.cfSectionHeadOrange}
        iconClass={styles.sectionIcoOrange}
        title="Open Vessel Details : Attachments"
        subtitle={vesselSubtitle}
        note="Pulled from the vessel's master record — view certificates and particulars linked to this voyage's vessel."
        icon={(
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 21c1.6 1.2 3.4 1.2 5 0 1.6 1.2 3.4 1.2 5 0 1.6 1.2 3.4 1.2 5 0 1.6 1.2 3.4 1.2 5 0" />
            <path d="M4 18l1-8h14l1 8" />
            <path d="M12 10V4h4l2 4" />
            <path d="M9 4h3" />
          </svg>
        )}
      >
        <div className={styles.docBody}>
          <div className={styles.docDzRow}>
            <Dropzone
              inputRef={vesselInputRef}
              active={false}
              onActivate={() => {}}
              onDeactivate={() => {}}
              onFiles={() => notifyUploadUnavailable('Open Vessel Details')}
              subHint="Certificates, particulars, survey reports"
            />
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.cfTable}>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {(data?.vesselAttachments || []).map((item) => (
                  <tr key={`${item.file}-${item.name}`}>
                    <td className={`${styles.accentCell} ${styles.accentOrange}`}>
                      <a
                        className={styles.fileNameLink}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        title="Click to view file"
                      >
                        {item.name}
                      </a>
                    </td>
                    <td>
                      <a
                        className={styles.docUploadChip}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <CheckIcon />
                        View file
                      </a>
                    </td>
                  </tr>
                ))}
                {!loading && !(data?.vesselAttachments || []).length ? (
                  <tr className={styles.cfEmptyRow}>
                    <td colSpan={2}>No vessel attachments.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </DocSection>

      <DocSection
        id="sec-invoice"
        headClass={styles.cfSectionHeadTeal}
        iconClass={styles.sectionIcoTeal}
        title="Invoice / Statement / Payment : Attachments"
        subtitle="Financial paperwork supporting the SOA for this voyage"
        note="Source documents behind invoices, statements and payments — matched against the Cashflow page."
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
              active={false}
              onActivate={() => {}}
              onDeactivate={() => {}}
              onFiles={() => notifyUploadUnavailable('Invoice / Statement / Payment')}
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
                </tr>
              </thead>
              <tbody>
                {(data?.invoiceAttachments || []).map((row, index) => (
                  <tr key={`${row.particular}-${row.number}-${index}`}>
                    <td className={`${styles.accentCell} ${styles.accentTeal}`}>
                      {row.particular || '—'}
                    </td>
                    <td>{row.type || '—'}</td>
                    <td>{row.number || '—'}</td>
                    <td>
                      {(row.groups || []).length ? (
                        (row.groups || []).map((group) => (
                          <div key={group.label} className={styles.invoiceGroup}>
                            <div className={styles.invoiceGroupLabel}>{group.label}</div>
                            <AttachmentChips attachments={group.attachments} />
                          </div>
                        ))
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && !(data?.invoiceAttachments || []).length ? (
                  <tr className={styles.cfEmptyRow}>
                    <td colSpan={4}>No invoice / payment attachments.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </DocSection>

      <DocSection
        id="sec-email"
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
        <div className={styles.docBody} style={{ paddingTop: 14 }}>
          <div className={styles.docDzRow}>
            <Dropzone
              inputRef={emailInputRef}
              active={false}
              onActivate={() => {}}
              onDeactivate={() => {}}
              onFiles={() => notifyUploadUnavailable('Emails')}
              subHint=".eml or .msg files, or drag in a saved email export"
            />
          </div>
        </div>
        <div>
          {PLACEHOLDER_EMAILS.map((email) => (
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
              </div>
            </div>
          ))}
        </div>
      </DocSection>
    </div>
  );
}
