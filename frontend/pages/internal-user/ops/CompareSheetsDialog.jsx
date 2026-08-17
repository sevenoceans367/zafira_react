import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './CompareSheetsDialog.module.css';

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h10" />
      <path d="M10 5l3 3-3 3" />
      <path d="M21 16H11" />
      <path d="M14 19l-3-3 3-3" />
    </svg>
  );
}

function groupRows(rows = []) {
  const groups = [];
  const seen = new Map();
  (rows || []).forEach((row) => {
    const section = row.section || 'Parameters';
    if (!seen.has(section)) {
      seen.set(section, groups.length);
      groups.push({ section, rows: [] });
    }
    groups[seen.get(section)].rows.push(row);
  });
  return groups;
}

function liveValue(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text === 'N/A') return '';
  return text;
}

function displayValue(value) {
  const text = liveValue(value);
  return text || 'N/A';
}

function parseAmount(value) {
  const text = liveValue(value);
  if (!text) return null;
  const n = Number(String(text).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pairDiff(row, leftIdx, rightIdx) {
  const left = parseAmount(row?.values?.[leftIdx]);
  const right = parseAmount(row?.values?.[rightIdx]);
  if (left == null || right == null) return { text: 'N/A', tone: '' };
  const diff = right - left;
  const text = diff.toFixed(2);
  if (diff > 0) return { text, tone: 'pos' };
  if (diff < 0) return { text, tone: 'neg' };
  return { text, tone: '' };
}

function isTotalRow(label) {
  return /^total\b/i.test(String(label || ''));
}

function defaultSubtitle(header, sheets) {
  const voy = [header?.voyageNo, header?.voyageName].filter(Boolean).join(' / ');
  if (sheets.length <= 1) {
    return voy ? `${voy} — one worksheet on this voyage` : 'One worksheet on this voyage';
  }
  const countLabel = `${sheets.length} worksheet${sheets.length === 1 ? '' : 's'}`;
  return voy ? `${voy} — ${countLabel}` : countLabel;
}

function sheetLabel(sheet, index) {
  if (!sheet) return `Sheet ${index + 1}`;
  if (sheet.isFvf || sheet.isFixture) return sheet.name || 'FVF';
  return sheet.name || `Sheet ${index + 1}`;
}

export default function CompareSheetsDialog({
  open,
  loading = false,
  error = '',
  data = null,
  onClose,
  title = 'Compare Working Sheets',
  subtitle,
  headerFields = [],
  extraActions = null,
  onDownloadPdf,
  pdfLoading = false,
  renderLabel,
}) {
  const sheets = data?.sheets || [];
  const groups = useMemo(() => groupRows(data?.rows), [data?.rows]);
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(0);

  useEffect(() => {
    const last = Math.max(0, sheets.length - 1);
    setLeftIdx(0);
    setRightIdx(last);
  }, [sheets.length, data?.comId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const safeLeft = Math.min(leftIdx, Math.max(0, sheets.length - 1));
  const safeRight = Math.min(rightIdx, Math.max(0, sheets.length - 1));
  const usePickers = sheets.length > 2;
  const header = data?.header || {};
  const resolvedSubtitle = subtitle || defaultSubtitle(header, sheets);
  const plRow = (data?.rows || []).find((row) => row.label === 'P/L' || row.label === 'P&L');
  const showStrip = sheets.length > 2 && plRow;
  const plDiff = sheets.length < 2 || !plRow
    ? { text: 'N/A', tone: '' }
    : pairDiff(plRow, safeLeft, safeRight);

  if (!open) return null;

  const colSpan = 5;

  return createPortal(
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-sheets-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.head}>
          <div className={styles.titleWrap}>
            <div className={styles.titleIco}>
              <CompareIcon />
            </div>
            <div>
              <div id="compare-sheets-title" className={styles.title}>{title}</div>
              {resolvedSubtitle ? <div className={styles.subtitle}>{resolvedSubtitle}</div> : null}
            </div>
          </div>
          <div className={styles.headRight}>
            {typeof onDownloadPdf === 'function' ? (
              <button
                type="button"
                className={styles.btnDownload}
                title={pdfLoading ? 'Generating PDF…' : 'Generate PDF'}
                aria-label={pdfLoading ? 'Generating PDF…' : 'Generate PDF'}
                onClick={onDownloadPdf}
                disabled={pdfLoading || loading || !data}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M4 19h16" />
                </svg>
              </button>
            ) : null}
            {extraActions}
            <button type="button" className={styles.btnClose} aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {error ? <div className={styles.error}>{error}</div> : null}
          {loading ? <p className={styles.loading}>Please wait...</p> : null}
          {!loading && data ? (
            <>
              {headerFields.length ? (
                <div className={styles.mpGrid}>
                  {headerFields.map((field) => (
                    <div key={field.label} className={styles.mpField}>
                      <div className={styles.mpLabel}>{field.label}</div>
                      <div className={styles.mpValue}>{liveValue(field.value) || '—'}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {showStrip ? (
                <div className={styles.tpWrap}>
                  <div className={styles.tpLabel}>Margin Movement — every touchpoint on this voyage</div>
                  <div className={styles.tpStrip}>
                    {sheets.map((sheet, index) => {
                      const pl = displayValue(plRow.values?.[index]);
                      const prev = index > 0 ? parseAmount(plRow.values?.[index - 1]) : null;
                      const curr = parseAmount(plRow.values?.[index]);
                      const delta = prev != null && curr != null ? curr - prev : null;
                      const selected = index === safeLeft || index === safeRight;
                      return (
                        <React.Fragment key={sheet.fcaId || sheet.tcOutId || index}>
                          {index > 0 ? (
                            <span className={styles.tpArrow} aria-hidden>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 6l6 6-6 6" />
                              </svg>
                            </span>
                          ) : null}
                          <div className={`${styles.tpCard} ${selected ? styles.tpCardSelected : ''}`}>
                            <div className={styles.tpName}>{sheetLabel(sheet, index)}</div>
                            <div className={styles.tpPlLabel}>P&amp;L</div>
                            <div className={styles.tpPlValue}>{pl === 'N/A' ? '—' : pl}</div>
                            {delta != null && delta !== 0 ? (
                              <div className={`${styles.tpDelta} ${delta < 0 ? styles.tpDeltaDown : styles.tpDeltaUp}`}>
                                {delta > 0 ? '+' : ''}{delta.toFixed(2)} vs prev.
                              </div>
                            ) : null}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Worksheet No.</th>
                      <th>
                        {usePickers ? (
                          <select
                            className={styles.thSelect}
                            value={safeLeft}
                            aria-label="Left worksheet"
                            onChange={(event) => setLeftIdx(Number(event.target.value))}
                          >
                            {sheets.map((sheet, index) => (
                              <option key={`l-${sheet.fcaId || index}`} value={index}>
                                {sheetLabel(sheet, index)}
                              </option>
                            ))}
                          </select>
                        ) : sheetLabel(sheets[safeLeft], safeLeft)}
                      </th>
                      <th>
                        {sheets.length < 2 ? '—' : usePickers ? (
                          <select
                            className={styles.thSelect}
                            value={safeRight}
                            aria-label="Right worksheet"
                            onChange={(event) => setRightIdx(Number(event.target.value))}
                          >
                            {sheets.map((sheet, index) => (
                              <option key={`r-${sheet.fcaId || index}`} value={index}>
                                {sheetLabel(sheet, index)}
                              </option>
                            ))}
                          </select>
                        ) : sheetLabel(sheets[safeRight], safeRight)}
                      </th>
                      <th>Diff.</th>
                      <th>Progressive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group, groupIndex) => (
                      <React.Fragment key={group.section}>
                        <tr className={`${styles.section} ${groupIndex % 2 === 0 ? styles.sectionDark : styles.sectionLight}`}>
                          <td colSpan={colSpan}>{group.section}</td>
                        </tr>
                        {group.rows.map((row) => {
                          const leftVal = displayValue(row.values?.[safeLeft]);
                          const rightVal = sheets.length < 2 ? 'N/A' : displayValue(row.values?.[safeRight]);
                          const diff = sheets.length < 2
                            ? { text: 'N/A', tone: '' }
                            : pairDiff(row, safeLeft, safeRight);
                          const progressive = displayValue(row.progressive);
                          return (
                            <tr key={`${group.section}-${row.label}`} className={isTotalRow(row.label) ? styles.total : undefined}>
                              <td>
                                {renderLabel ? renderLabel(row) : row.label}
                              </td>
                              <td className={`${styles.num} ${styles.initial} ${leftVal === 'N/A' ? styles.na : ''}`}>
                                {leftVal}
                              </td>
                              <td className={`${styles.num} ${styles.final} ${rightVal === 'N/A' ? styles.na : ''}`}>
                                {rightVal}
                              </td>
                              <td className={`${styles.num} ${diff.tone === 'pos' ? styles.diffPos : ''} ${diff.tone === 'neg' ? styles.diffNeg : ''} ${diff.text === 'N/A' ? styles.na : ''}`}>
                                {diff.text}
                              </td>
                              <td className={`${styles.num} ${progressive === 'N/A' ? styles.na : ''}`}>
                                {progressive}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                    <tr className={`${styles.section} ${styles.sectionDark}`}>
                      <td colSpan={colSpan}>Result</td>
                    </tr>
                    <tr className={styles.total}>
                      <td>P/L Difference</td>
                      <td className={`${styles.num} ${styles.initial}`}>—</td>
                      <td className={`${styles.num} ${styles.final}`}>—</td>
                      <td className={`${styles.num} ${plDiff.tone === 'pos' ? styles.diffPos : ''} ${plDiff.tone === 'neg' ? styles.diffNeg : ''} ${plDiff.text === 'N/A' ? styles.na : ''}`}>
                        {plDiff.text}
                      </td>
                      <td className={`${styles.num} ${styles.na}`}>N/A</td>
                    </tr>
                    <tr className={styles.total}>
                      <td>Actual P/L (Calculated - Difference)</td>
                      <td className={`${styles.num} ${styles.initial}`}>—</td>
                      <td className={`${styles.num} ${styles.final}`}>—</td>
                      <td className={styles.num}>{displayValue(plRow?.values?.[sheets.length < 2 ? safeLeft : safeRight] ?? data.actualPl)}</td>
                      <td className={`${styles.num} ${styles.na}`}>N/A</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          {!loading && !data && !error ? (
            <p className={styles.empty}>No compare sheet data.</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
