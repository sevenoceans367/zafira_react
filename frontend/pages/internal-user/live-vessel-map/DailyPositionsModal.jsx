import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CardSelect } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { reportAppPath } from '../../../constants/reportsMenu.js';
import {
  ACCENT,
  CHIP_LABEL,
  DAILY_POSITION_STATUS,
  fakeContact,
  fullLineText,
  toPopupRows,
  uniqueOperators,
} from '../reports/dailyPositionsMock.js';
import styles from './DailyPositionsModal.module.css';

const PAGE_SIZE = 5;
const FULL_REPORT_HREF = appPath(reportAppPath('operations', 'daily-position-report'));

const EXTERNAL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h13" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

const COPY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const AVATAR_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.4" />
    <path d="M4.5 20.2c0-4.3 3.4-7.7 7.5-7.7s7.5 3.4 7.5 7.7" />
  </svg>
);

export default function DailyPositionsModal({ open, onClose }) {
  const [operator, setOperator] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState('');
  const [contact, setContact] = useState(null);
  const toastTimer = useRef(null);
  const rows = useMemo(() => toPopupRows(), []);
  const operatorOptions = useMemo(() => uniqueOperators(), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setOperator('all');
      setStatus('all');
      setPage(1);
      setContact(null);
    }
  }, [open]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (operator !== 'all' && row.operator !== operator) return false;
    if (status !== 'all' && row.status !== status) return false;
    return true;
  }), [rows, operator, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };

  const copyLine = async (row) => {
    try {
      await navigator.clipboard?.writeText(fullLineText(row));
    } catch {
      // toast still confirms
    }
    showToast(`Full line copied for ${row.vessel} (${row.voyageNo}) — paste into email or Teams.`);
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Daily Positions"
      >
        <div className={styles.head}>
          <div className={styles.title}>Daily Positions</div>
          <div className={styles.headActions}>
            <CardSelect
              options={operatorOptions}
              value={operator}
              onChange={(id) => {
                setOperator(id);
                setPage(1);
              }}
              placeholder="All Operators"
              ariaLabel="Operator"
              align="end"
              tone="muted"
            />
            <CardSelect
              options={DAILY_POSITION_STATUS}
              value={status}
              onChange={(id) => {
                setStatus(id);
                setPage(1);
              }}
              placeholder="All Positions"
              ariaLabel="Position status"
              align="end"
              tone="muted"
            />
            <Link className={styles.viewReport} to={FULL_REPORT_HREF}>
              View Full Report
              {EXTERNAL_ICON}
            </Link>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th aria-label="Copy" />
                  <th>#</th>
                  <th>Vessel / Voyage</th>
                  <th>Operator</th>
                  <th>Agent</th>
                  <th>Activity Status</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length ? pageRows.map((row, index) => (
                  <tr key={`${row.status}-${row.id}`}>
                    <td>
                      <button
                        type="button"
                        className={styles.copyBtn}
                        title="Copy full line"
                        onClick={() => copyLine(row)}
                      >
                        {COPY_ICON}
                      </button>
                    </td>
                    <td
                      className={styles.accentCell}
                      style={{ borderLeftColor: ACCENT[row.type] || ACCENT.relet }}
                    >
                      {(safePage - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td>
                      <div className={styles.identity}>
                        <span className={styles.vessel}>{row.vessel}</span>
                        <span className={styles.muted}>{row.voyageNo}</span>
                        {row.masterContract ? (
                          <span className={styles.master}>Master: {row.masterContract}</span>
                        ) : null}
                        <span className={`${styles.typeChip} ${styles[`type_${row.type}`] || ''}`}>
                          {CHIP_LABEL[row.type] || String(row.type).toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td>{row.operator}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.contactTrigger}
                        onMouseEnter={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const left = Math.min(rect.left, window.innerWidth - 256);
                          setContact({
                            ...fakeContact(row.agent, 'Agent'),
                            left: Math.max(8, left),
                            top: rect.bottom + 8,
                          });
                        }}
                        onMouseLeave={() => setContact(null)}
                      >
                        <span title={row.agent}>{row.agent}</span>
                      </button>
                    </td>
                    <td>
                      <span className={`${styles.activity} ${styles[`activity_${row.activity}`] || ''}`}>
                        <span className={styles.activityDot} aria-hidden="true" />
                        {row.activityLabel}
                      </span>
                    </td>
                    <td>{row.position}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className={styles.empty}>
                      No positions match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ←
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pageBtn}${p === safePage ? ` ${styles.pageBtnActive}` : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className={styles.pageBtn}
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                →
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {contact ? (
        <div
          className={styles.contactPopover}
          style={{ left: contact.left, top: contact.top }}
        >
          <div className={styles.contactHead}>
            <span className={styles.contactAvatar}>{AVATAR_ICON}</span>
            <div>
              <div className={styles.contactRole}>Agent contact</div>
              <div className={styles.contactName}>{contact.org}</div>
            </div>
          </div>
          <div className={styles.contactRow}><span>{contact.person}</span></div>
          <div className={styles.contactRow}><span>{contact.phone}</span></div>
          <div className={styles.contactRow}><span>{contact.email}</span></div>
        </div>
      ) : null}

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </>,
    document.body,
  );
}
