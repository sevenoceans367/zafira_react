import React, { useCallback, useEffect, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, useConfirm, EditRecapIcon } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { useElibraryModule } from '../../../hooks/useElibraryModule.js';
import { elibraryBasePath } from '../../../constants/elibraryModule.js';
import {
  deleteElibraryReference,
  fetchElibraryLookups,
  fetchElibraryReferences,
} from '../../../services/elibrary.js';
import ElibraryHeaderActions from './ElibraryHeaderActions.jsx';
import styles from './ElibraryPages.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! E-Library added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating E-Library.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
  3: { type: 'success', text: 'Congratulations! Reference removed successfully.' },
};

export default function ElibraryPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { module } = useElibraryModule();
  const listPath = elibraryBasePath(module);
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [referenceTypes, setReferenceTypes] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [referenceTypeId, setReferenceTypeId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flashMsg = searchParams.get('msg');
  const flash = useTimedFlash(flashMsg != null ? FLASH_MESSAGES[Number(flashMsg)] : null);

  const loadLookups = useCallback(async () => {
    try {
      const data = await fetchElibraryLookups();
      setCategories(data.categories || []);
      setReferenceTypes(data.referenceTypes || []);
    } catch (err) {
      setError(err.message || 'Failed to load E-Library filters.');
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchElibraryReferences({
        selCategory: categoryId,
        selRefType: referenceTypeId,
        txtName: debouncedSearch.trim(),
      });
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load E-Library list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId, debouncedSearch, referenceTypeId]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const clearFlash = () => {
    if (!searchParams.has('msg')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  const handleSearchChange = (value) => {
    clearFlash();
    setSearchInput(value);
  };

  const handleCategoryChange = (value) => {
    clearFlash();
    setCategoryId(value);
  };

  const handleReferenceTypeChange = (value) => {
    clearFlash();
    setReferenceTypeId(value);
  };

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure to remove this reference entry permanently?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setLoading(true);
    try {
      await deleteElibraryReference(row.id);
      navigate(`${listPath}?msg=3`, { replace: true });
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to delete reference.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      <ElibraryHeaderActions
        search={searchInput}
        onSearchChange={handleSearchChange}
        categories={categories}
        categoryId={categoryId}
        onCategoryChange={handleCategoryChange}
        referenceTypes={referenceTypes}
        referenceTypeId={referenceTypeId}
        onReferenceTypeChange={handleReferenceTypeChange}
      />

      {loading ? <LoadingOverlay active label="Loading E-Library…" /> : null}

      {flash ? (
        <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
          {flash.text}
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>ADD REFERENCES</h3>

      <div className={styles.toolbar}>
        <Button
          variant="add"
          label="Add New"
          onClick={() => navigate(`${listPath}/add`)}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Reference Type</th>
              <th>Date</th>
              <th>Name</th>
              <th>Description</th>
              <th>Source</th>
              <th>Upload</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id}>
                <td>{row.categoryName || '—'}</td>
                <td>{row.referenceTypeName || '—'}</td>
                <td>{row.date || '—'}</td>
                <td>{row.name || '—'}</td>
                <td>{row.description || '—'}</td>
                <td>{row.source || '—'}</td>
                <td>
                  {(row.attachments || []).length === 0 ? (
                    '—'
                  ) : (
                    <div className={styles.uploadLinks}>
                      {row.attachments.map((file) => (
                        <a
                          key={file.file}
                          className={styles.uploadLink}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          title={file.name}
                        >
                          <i className="bi bi-box-arrow-up-right" aria-hidden />
                        </a>
                      ))}
                    </div>
                  )}
                </td>
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className={styles.actionIcon}
                    title="Edit Details"
                    aria-label="Edit Details"
                    onClick={() => navigate(`${listPath}/edit/${row.id}`)}
                  >
                    <EditRecapIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionIcon} ${styles.actionDanger}`}
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => handleDelete(row)}
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
  );
}
