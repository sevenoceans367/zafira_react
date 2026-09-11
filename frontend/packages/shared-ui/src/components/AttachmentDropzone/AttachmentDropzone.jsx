import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './AttachmentDropzone.module.css';

function DeleteButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={`${styles.circleBtn} ${styles.circleBtnDel}`}
      title="Remove"
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M18 6 6 18" />
        <path d="M6 6l12 12" />
      </svg>
    </button>
  );
}

function PendingFileRow({ file, onRemove, canRemove }) {
  const href = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(href), [href]);
  return (
    <div className={styles.fileRow}>
      <a
        className={styles.fileName}
        href={href}
        download={file.name}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        {file.name}
      </a>
      {canRemove ? <DeleteButton onClick={onRemove} /> : null}
    </div>
  );
}

/**
 * Shared drag-and-drop attachment field used across estimate, relet, COA, SOF, etc.
 *
 * @param {File[]} [files] pending local File objects
 * @param {(added: File[]) => void} [onAddFiles]
 * @param {(index: number) => void} [onRemoveFile]
 * @param {{ name?: string, url?: string, file?: string, key?: string }[]} [existing] saved attachments
 * @param {(item: object, index: number) => void} [onRemoveExisting]
 * @param {boolean} [readOnly]
 * @param {boolean} [multiple=true]
 * @param {string} [emptyLabel]
 * @param {string} [className]
 * @param {string} [accept]
 */
export default function AttachmentDropzone({
  files = [],
  onAddFiles,
  onRemoveFile,
  existing = [],
  onRemoveExisting,
  readOnly = false,
  multiple = true,
  emptyLabel = 'No documents attached yet.',
  className = '',
  accept,
}) {
  const inputRef = useRef(null);
  const [dropActive, setDropActive] = useState(false);
  const canEdit = !readOnly;

  const addFiles = (fileList) => {
    const next = Array.from(fileList || []);
    if (!next.length || !onAddFiles) return;
    onAddFiles(multiple ? next : next.slice(0, 1));
  };

  const hasExisting = (existing || []).length > 0;
  const hasPending = (files || []).length > 0;
  const showEmpty = !hasExisting && !hasPending;

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      {canEdit ? (
        <>
          <input
            ref={inputRef}
            className={styles.hiddenFileInput}
            type="file"
            multiple={multiple}
            accept={accept}
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <div
            className={dropActive ? `${styles.dropzone} ${styles.dropzoneActive}` : styles.dropzone}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              addFiles(e.dataTransfer?.files);
            }}
          >
            <div className={styles.dropzoneIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 16V4" />
                <path d="M6 10l6-6 6 6" />
                <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
              </svg>
            </div>
            <div className={styles.dropzoneText}>
              <b>Drag &amp; drop files here</b>, or click to browse
            </div>
          </div>
        </>
      ) : null}

      {!showEmpty ? (
        <div className={styles.fileList}>
          {(existing || []).map((item, index) => {
            const label = item.name || item.file || `Attachment ${index + 1}`;
            const key = item.key || item.file || item.url || label;
            return (
              <div key={key} className={styles.fileRow}>
                {item.url ? (
                  <a
                    className={styles.fileName}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    download={item.name || undefined}
                  >
                    {label}
                  </a>
                ) : (
                  <span className={styles.fileName}>{label}</span>
                )}
                {canEdit && onRemoveExisting ? (
                  <DeleteButton onClick={() => onRemoveExisting(item, index)} />
                ) : null}
              </div>
            );
          })}
          {(files || []).map((file, index) => (
            <PendingFileRow
              key={`pending-${file.name}-${file.size}-${index}`}
              file={file}
              canRemove={canEdit && Boolean(onRemoveFile)}
              onRemove={() => onRemoveFile?.(index)}
            />
          ))}
        </div>
      ) : !canEdit ? (
        <span className={styles.empty}>{emptyLabel}</span>
      ) : null}
    </div>
  );
}
