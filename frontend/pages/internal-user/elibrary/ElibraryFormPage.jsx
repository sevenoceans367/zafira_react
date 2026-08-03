import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  CardSelect,
  Field,
  LoadingOverlay,
  TextInput,
  Textarea,
} from '@bainbridge/shared-ui';
import { useElibraryModule } from '../../../hooks/useElibraryModule.js';
import { elibraryBasePath } from '../../../constants/elibraryModule.js';
import {
  createElibraryReference,
  fetchElibraryLookups,
  fetchElibraryReference,
  updateElibraryReference,
} from '../../../services/elibrary.js';
import styles from './ElibraryPages.module.css';

function todayInputValue() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const EMPTY_FORM = {
  categoryId: '',
  referenceTypeId: '',
  date: todayInputValue(),
  name: '',
  source: '',
  description: '',
};

export default function ElibraryFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { module } = useElibraryModule();
  const listPath = elibraryBasePath(module);
  const isEdit = Boolean(id);

  const [categories, setCategories] = useState([]);
  const [referenceTypes, setReferenceTypes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const lookups = await fetchElibraryLookups();
        if (cancelled) return;
        setCategories(lookups.categories || []);
        setReferenceTypes(lookups.referenceTypes || []);

        if (isEdit) {
          const record = await fetchElibraryReference(id);
          if (cancelled) return;
          setForm({
            categoryId: record.categoryId || '',
            referenceTypeId: record.referenceTypeId || '',
            date: record.dateInput || todayInputValue(),
            name: record.name || '',
            source: record.source || '',
            description: record.description || '',
          });
          setExistingAttachments(record.attachments || []);
        } else {
          setForm({ ...EMPTY_FORM, date: todayInputValue() });
          setExistingAttachments([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load E-Library form.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const removeExistingAttachment = (fileName) => {
    setExistingAttachments((prev) => prev.filter((item) => item.file !== fileName));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.categoryId) {
      setError('Category is required.');
      return;
    }
    if (!form.referenceTypeId) {
      setError('Reference type is required.');
      return;
    }
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        categoryId: form.categoryId,
        referenceTypeId: form.referenceTypeId,
        date: form.date,
        name: form.name.trim(),
        source: form.source.trim(),
        description: form.description.trim(),
      };

      if (isEdit) {
        await updateElibraryReference(id, payload, {
          files,
          existingFiles: existingAttachments.map((item) => item.file).join(','),
          existingNames: existingAttachments.map((item) => item.name).join(','),
        });
      } else {
        await createElibraryReference(payload, files);
      }

      navigate(`${listPath}?msg=0`);
    } catch (err) {
      setError(err.message || 'Failed to save E-Library reference.');
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = [
    { id: '', name: '---Select Category---' },
    ...categories,
  ];

  const referenceTypeOptions = [
    { id: '', name: '---Select Reference---' },
    ...referenceTypes,
  ];

  return (
    <div className={`zafira-page ${styles.page}`}>
      {loading || saving ? (
        <LoadingOverlay active label={saving ? 'Saving…' : 'Loading…'} />
      ) : null}

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.formHeader}>
        <Button
          variant="secondary"
          label="Back"
          onClick={() => navigate(listPath)}
        />
      </div>

      <h3 className={styles.title}>{isEdit ? 'EDIT REFERENCES' : 'ADD REFRENCES'}</h3>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <Field label="Category">
            <div className={styles.cardSelect}>
              <CardSelect
                options={categoryOptions}
                value={form.categoryId}
                onChange={(value) => updateField('categoryId', value)}
                placeholder="---Select Category---"
                ariaLabel="Category"
                align="start"
              />
            </div>
          </Field>

          <Field label="Reference Type">
            <div className={styles.cardSelect}>
              <CardSelect
                options={referenceTypeOptions}
                value={form.referenceTypeId}
                onChange={(value) => updateField('referenceTypeId', value)}
                placeholder="---Select Reference---"
                ariaLabel="Reference Type"
                align="start"
              />
            </div>
          </Field>

          <Field label="Date">
            <TextInput
              type="date"
              value={form.date}
              onChange={(event) => updateField('date', event.target.value)}
              required
            />
          </Field>
        </div>

        <div className={styles.formRow}>
          <Field label="Name">
            <TextInput
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              required
            />
          </Field>

          <Field label="Source">
            <TextInput
              type="text"
              placeholder="Source"
              value={form.source}
              onChange={(event) => updateField('source', event.target.value)}
            />
          </Field>
        </div>

        <Field label="Description" className={styles.formRowWide}>
          <Textarea
            placeholder="Description ..."
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            rows={3}
          />
        </Field>

        <Field label="Attachment" className={styles.formRowWide}>
          <TextInput
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
          />
        </Field>

        {existingAttachments.length > 0 ? (
          <div className={styles.attachments}>
            <span className={styles.label}>Existing attachments</span>
            {existingAttachments.map((item) => (
              <div key={item.file} className={styles.attachmentRow}>
                <a
                  className={styles.uploadLink}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.name}
                </a>
                <button
                  type="button"
                  className={styles.removeAttachment}
                  title="Remove attachment"
                  onClick={() => removeExistingAttachment(item.file)}
                >
                  <i className="bi bi-x-lg" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className={styles.formActions}>
          <Button variant="primary" label="Submit" type="submit" disabled={saving} />
        </div>
      </form>
    </div>
  );
}
