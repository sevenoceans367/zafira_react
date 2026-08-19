import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './OpsVcInOpsGlancePage.module.css';

function PinIcon({ filled }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 17v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 3h8l-1 7 3 3H6l3-3z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M8 3h8l-1 7 3 3H6l3-3z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function sortCostSheets(sheets) {
  return [...(sheets || [])].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const ao = a.sortOrder;
    const bo = b.sortOrder;
    if (ao != null && bo != null && Number(ao) !== Number(bo)) return Number(ao) - Number(bo);
    return Number(b.id) - Number(a.id);
  });
}

function withSavedOrder(sheets) {
  return sortCostSheets(sheets).map((sheet, index) => ({
    ...sheet,
    sortOrder: index,
  }));
}

export default function OpsVcWorksheetStack({
  sheets = [],
  sheetHref,
  onAdd,
  onLayoutChange,
}) {
  const [dragId, setDragId] = useState('');
  const allowDragRef = useRef(false);
  const ordered = sortCostSheets(sheets);

  const persist = (nextSheets) => {
    const saved = withSavedOrder(nextSheets);
    onLayoutChange?.(saved);
  };

  const handlePin = (sheet) => {
    const pinning = !sheet.pinned;
    persist(ordered.map((item) => ({
      ...item,
      pinned: pinning && String(item.id) === String(sheet.id),
    })));
  };

  const handleDragStart = (event, sheet) => {
    if (!allowDragRef.current) {
      event.preventDefault();
      return;
    }
    setDragId(String(sheet.id));
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(sheet.id));
  };

  const handleDrop = (event, targetSheet) => {
    const sourceId = String(event.dataTransfer.getData('text/plain') || dragId);
    const targetId = String(targetSheet.id);
    setDragId('');
    allowDragRef.current = false;
    if (!sourceId || sourceId === targetId) return;
    const current = [...ordered];
    const from = current.findIndex((item) => String(item.id) === sourceId);
    const to = current.findIndex((item) => String(item.id) === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);
    persist(current);
  };

  return (
    <>
      {ordered.length ? (
        <div className={`${styles.wsheetStack} ${ordered.length > 2 ? styles.wsheetMany : ''}`}>
          {ordered.map((sheet) => (
            <div
              key={sheet.id}
              className={`${styles.wchip} ${sheet.pinned ? styles.wchipPinned : ''} ${String(dragId) === String(sheet.id) ? styles.wchipDragging : ''}`}
              draggable
              onDragStart={(event) => handleDragStart(event, sheet)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(event, sheet);
              }}
              onDragEnd={() => {
                setDragId('');
                allowDragRef.current = false;
              }}
            >
              <button
                type="button"
                className={styles.pinIco}
                title={sheet.pinned ? 'Unpin worksheet' : 'Pin worksheet to top'}
                onClick={() => handlePin(sheet)}
              >
                <PinIcon filled={Boolean(sheet.pinned)} />
              </button>
              <Link className={styles.wchipName} to={sheetHref(sheet)} title={sheet.name}>
                {sheet.name}
              </Link>
              <Link className={styles.editIco} to={sheetHref(sheet)} title="Edit this worksheet">
                <EditIcon />
              </Link>
              <span
                className={styles.dragIco}
                title="Drag to reorder"
                onMouseDown={() => { allowDragRef.current = true; }}
                onMouseUp={() => { allowDragRef.current = false; }}
              >
                <DragIcon />
              </span>
            </div>
          ))}
          {onAdd ? (
            <button type="button" className={styles.wchipAdd} title="Add New CS" onClick={onAdd}>
              <PlusIcon /> Add
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <span className={styles.muted}>No sheets yet</span>
          {onAdd ? (
            <div style={{ marginTop: 5 }}>
              <button type="button" className={styles.wchipAdd} title="Add New CS" onClick={onAdd}>
                <PlusIcon /> Add
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
