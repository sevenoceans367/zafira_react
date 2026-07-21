import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchCompareSheetsTc, downloadCompareSheetsTcPdf } from '../../../services/opsTc.js';
import styles from './OpsPages.module.css';

function toneClass(tone) {
  if (tone === 'negative') return styles.compareNegative;
  if (tone === 'positive') return styles.comparePositive;
  return '';
}

function RowLabel({ row, comId }) {
  if (row.label === 'Other expenses(USD)') {
    return (
      <Link to={appPath(`/internal-user/vc/ops-tc/payment-grid?comid=${encodeURIComponent(comId)}&page=1`)}>
        {row.label}
      </Link>
    );
  }
  return row.label;
}

export default function OpsTcCompareSheetsModal({ open, comId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    if (!open || !comId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setData(null);
      try {
        const result = await fetchCompareSheetsTc(comId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load compare sheets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, comId]);

  const handleGeneratePdf = async () => {
    if (!comId || pdfLoading) return;
    setPdfLoading(true);
    setPdfError('');
    try {
      await downloadCompareSheetsTcPdf(comId);
    } catch (err) {
      setPdfError(err.message || 'Failed to generate Compare Sheet PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

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
            <div className={styles.compareToolbar}>
              <h3 className={styles.compareTitle}>Main Particulars</h3>
              <Button
                size="sm"
                variant="secondary"
                label={pdfLoading ? 'Generating…' : 'Generate Pdf'}
                onClick={handleGeneratePdf}
                disabled={pdfLoading || loading || !data}
              />
            </div>
            {pdfError ? <div className={styles.error}>{pdfError}</div> : null}

            <div className={styles.compareHeaderGrid}>
              <div><strong>Vessel Name</strong><div>{data.header.vesselName || '—'}</div></div>
              <div><strong>Vessel Type</strong><div>{data.header.vesselType || '—'}</div></div>
              <div><strong>DWT Summer</strong><div>{data.header.dwtSummer || '—'}</div></div>
              <div><strong>Fixture Date</strong><div>{data.header.fixtureDate || '—'}</div></div>
              <div><strong>CP Date</strong><div>{data.header.cpDate || '—'}</div></div>
              <div><strong>TC No</strong><div>{data.header.tcNo || '—'}</div></div>
            </div>

            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.compareTable}`}>
                <thead>
                  <tr>
                    <th>Sheet Name / Parameters</th>
                    {data.sheets.map((sheet) => (
                      <th
                        key={sheet.tcOutId}
                        className={sheet.isFixture ? styles.compareFixtureCol : styles.compareSheetCol}
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
                          <td><RowLabel row={row} comId={comId} /></td>
                          {row.values.map((value, index) => (
                            <td
                              key={`${row.label}-${index}`}
                              className={data.sheets[index]?.isFixture
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
