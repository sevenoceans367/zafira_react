import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Field,
  FilterBar,
  LoadingOverlay,
  TextInput,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  createOpsDocument,
  deleteOpsDocument,
  fetchOpsDocuments,
} from '../../../services/opsVc.js';
import styles from './OpsPages.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

function AttachmentLinks({ attachments }) {
  if (!attachments?.length) return <span className={styles.muted}>—</span>;
  return (
    <>
      {attachments.map((item) => (
        <div key={`${item.file}-${item.name}`}>
          <a href={item.url} target="_blank" rel="noreferrer" title="Click to view file">
            <i className="bi bi-box-arrow-up-right" aria-hidden />
            {' '}
            {item.name}
          </a>
        </div>
      ))}
    </>
  );
}

export default function OpsVcDocumentsPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';

  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchOpsDocuments(comId);
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!fileName.trim()) {
      setError('File Name is required.');
      return;
    }
    if (!files.length) {
      setError('Please attach at least one file.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createOpsDocument(comId, { fileName: fileName.trim() }, files);
      setFileName('');
      setFiles([]);
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
      await deleteOpsDocument(comId, doc.storedFiles);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete document.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? <LoadingOverlay /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <FilterBar
        actions={<Button variant="secondary" label="Back" onClick={() => navigate(backHref)} />}
      >
        <div className={styles.muted}>
          {data?.nomId ? `Nom ID ${data.nomId}` : null}
          {data?.vesselName ? ` · ${data.vesselName}` : null}
        </div>
      </FilterBar>

      <h3 className={styles.title}>DOCUMENTS</h3>

      <form className={styles.letterPanel} onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <Field id="ops-doc-file-name" label="File Name">
            <TextInput
              id="ops-doc-file-name"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="File Name"
              autoComplete="off"
            />
          </Field>
          <Field id="ops-doc-files" label="Attachment">
            <input
              id="ops-doc-files"
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </Field>
          <div className={styles.toolbarActions}>
            <Button type="submit" label="Submit" disabled={saving} />
          </div>
        </div>
      </form>

      <div className={styles.tableWrap} style={{ marginTop: 16 }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>File Name</th>
              <th>Upload</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {(data?.documents || []).map((doc) => (
              <tr key={doc.id}>
                <td>{doc.fileName || '—'}</td>
                <td><AttachmentLinks attachments={doc.attachments} /></td>
                <td>
                  <button
                    type="button"
                    className={styles.dangerIcon}
                    title="Delete"
                    onClick={() => handleDelete(doc)}
                  >
                    <i className="bi bi-x-lg" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !(data?.documents || []).length ? (
              <tr>
                <td colSpan={3} className={styles.emptyCell}>No documents uploaded yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h3 className={styles.title} style={{ marginTop: 24 }}>
        Open Vessel Details
        {data?.vesselName ? ` (${data.vesselName})` : ''}
        {' '}
        : Attachments
      </h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>File Name</th>
              <th>Upload</th>
            </tr>
          </thead>
          <tbody>
            {(data?.vesselAttachments || []).map((item) => (
              <tr key={`${item.file}-${item.name}`}>
                <td>{item.name}</td>
                <td><AttachmentLinks attachments={[item]} /></td>
              </tr>
            ))}
            {!loading && !(data?.vesselAttachments || []).length ? (
              <tr>
                <td colSpan={2} className={styles.emptyCell}>No vessel attachments.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h3 className={styles.title} style={{ marginTop: 24 }}>
        Invoice/Statement/Payment: Attachments
      </h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Particular</th>
              <th>Type</th>
              <th>Invoice/Statement/Payment No.</th>
              <th>Upload</th>
            </tr>
          </thead>
          <tbody>
            {(data?.invoiceAttachments || []).map((row, index) => (
              <tr key={`${row.particular}-${row.number}-${index}`}>
                <td>{row.particular || '—'}</td>
                <td>{row.type || '—'}</td>
                <td>{row.number || '—'}</td>
                <td>
                  {(row.groups || []).map((group) => (
                    <div key={group.label} style={{ marginBottom: 6 }}>
                      <strong>{group.label} : </strong>
                      <AttachmentLinks attachments={group.attachments} />
                    </div>
                  ))}
                  {!(row.groups || []).length ? <span className={styles.muted}>—</span> : null}
                </td>
              </tr>
            ))}
            {!loading && !(data?.invoiceAttachments || []).length ? (
              <tr>
                <td colSpan={4} className={styles.emptyCell}>No invoice / payment attachments.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
