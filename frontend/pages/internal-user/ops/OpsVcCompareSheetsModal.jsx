import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { fetchCompareSheetsVc } from '../../../services/opsVc.js';
import styles from './OpsPages.module.css';

function toneClass(tone) {
  if (tone === 'negative') return styles.compareNegative;
  if (tone === 'positive') return styles.comparePositive;
  return '';
}

/** PHP options.php?id=131 getCompareSheetData — VC Voyage Financials compare. */
export default function OpsVcCompareSheetsModal({ open, comId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !comId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setData(null);
      try {
        const result = await fetchCompareSheetsVc(comId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load compare sheets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, comId]);

  if (!open) return null;

  const renderedSections = new Set();

  return createPortal(
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`${styles.modal} ${styles.modalWide}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h4>Compare Sheets</h4>
          <button type="button" className={styles.dangerIcon} onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading ? <LoadingOverlay /> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        {data ? (
          <div className={styles.compareBody}>
            <h3 className={styles.compareTitle}>Main Particulars</h3>

            <div className={styles.compareHeaderGrid}>
              <div><strong>Vessel Name</strong><div>{data.header.vesselName || '—'}</div></div>
              <div><strong>Vessel Type</strong><div>{data.header.vesselType || '—'}</div></div>
              <div><strong>Flag</strong><div>{data.header.flag || '—'}</div></div>
              <div><strong>Fixture Date</strong><div>{data.header.fixtureDate || '—'}</div></div>
              <div><strong>Voyage No.</strong><div>{data.header.voyageNo || '—'}</div></div>
              <div><strong>Voyage Financials Name</strong><div>{data.header.voyageName || '—'}</div></div>
              <div><strong>DWT Summer</strong><div>{data.header.dwtSummer || '—'}</div></div>
              <div><strong>DWT Tropical</strong><div>{data.header.dwtTropical || '—'}</div></div>
            </div>

            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.compareTable}`}>
                <thead>
                  <tr>
                    <th>Sheet Name / Parameters</th>
                    {data.sheets.map((sheet) => (
                      <th
                        key={sheet.fcaId}
                        className={sheet.isFvf ? styles.compareFixtureCol : styles.compareSheetCol}
                      >
                        {sheet.name}
                      </th>
                    ))}
                    <th>Diff.</th>
                    <th>Progressive</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const showSection = row.section && !renderedSections.has(row.section);
                    if (showSection) renderedSections.add(row.section);
                    return (
                      <React.Fragment key={`${row.section}-${row.label}`}>
                        {showSection ? (
                          <tr className={styles.compareSectionRow}>
                            <td colSpan={data.sheets.length + 3}><strong>{row.section}</strong></td>
                          </tr>
                        ) : null}
                        <tr>
                          <td>{row.label}</td>
                          {row.values.map((value, index) => (
                            <td
                              key={`${row.label}-${index}`}
                              className={data.sheets[index]?.isFvf
                                ? styles.compareFixtureCol
                                : styles.compareSheetCol}
                            >
                              {value || ''}
                            </td>
                          ))}
                          <td className={toneClass(row.differenceTone)}>{row.difference || ''}</td>
                          <td>{row.progressive || ''}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  <tr>
                    <td colSpan={data.sheets.length}><strong>P/L Difference</strong></td>
                    <td>{data.plDifference || ''}</td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={data.sheets.length}><strong>Actual P/L (Calculated - Difference)</strong></td>
                    <td>{data.actualPl || ''}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className={styles.toolbarActions} style={{ marginTop: 12 }}>
          <Button variant="close" label="Close" onClick={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
