import React, { useEffect, useState } from 'react';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchTcDecisionChartDetails } from '../../../services/tcEstimates.js';
import styles from './TcPages.module.css';

export default function TcDecisionChartDetailsModal({
  message,
  onClose,
  onGeneratePdf,
  pdfLoading = false,
}) {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!message) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchTcDecisionChartDetails(message);
        if (!cancelled) setFixtures(data.fixtures || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load decision chart details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [message]);

  if (!message) return null;

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="tc-chart-details-title">
      <div className={`${styles.modal} ${styles.modalWide}`}>
        {loading ? <LoadingOverlay active label="Loading decision chart…" /> : null}
        <div className={styles.modalHeader}>
          <h3 id="tc-chart-details-title">Decision Chart {message}</h3>
          <div className={styles.actions}>
            <Button
              variant="outline"
              label={pdfLoading ? 'Generating…' : 'Generate PDF'}
              onClick={() => onGeneratePdf?.(message)}
              disabled={pdfLoading || loading || !fixtures.length}
            />
            <Button variant="close" label="Close" onClick={onClose} disabled={pdfLoading} />
          </div>
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Vessel</th>
                <th>Vessel Type</th>
                <th>TC No.</th>
                <th>CP Date</th>
                <th>DWT</th>
                <th>Del Port</th>
                <th>Re Del Port</th>
                <th>TC Days</th>
                <th>Daily Gross Hire (USD)</th>
                <th>Total Rev (USD)</th>
                <th>Status</th>
                <th>Remarks</th>
                <th className={styles.center}>Select</th>
                <th className={styles.center}>View</th>
              </tr>
            </thead>
            <tbody>
              {fixtures.map((row, index) => (
                <tr key={row.tcOutId}>
                  <td>{index + 1}</td>
                  <td>{row.vesselName}</td>
                  <td>{row.vesselType}</td>
                  <td>{row.tcNo}</td>
                  <td>{row.cpDate}</td>
                  <td>{row.dwt}</td>
                  <td>{row.delPort}</td>
                  <td>{row.reDelPort}</td>
                  <td>{row.tcDays}</td>
                  <td>{row.dailyGrossHire}</td>
                  <td>{row.totalRev}</td>
                  <td>{row.status}</td>
                  <td className={styles.wrapCell}>{row.remarks}</td>
                  <td className={styles.center}>
                    <input type="radio" checked={Boolean(row.isFinal)} readOnly aria-label={`${row.tcNo} final selection`} />
                  </td>
                  <td className={styles.center}>
                    <a href={appPath(`/internal-user/vc/tc/${row.tcOutId}/view`)} title="View Details">
                      <i className="bi bi-file-earmark-text" aria-hidden />
                    </a>
                  </td>
                </tr>
              ))}
              {!fixtures.length && !loading ? (
                <tr>
                  <td colSpan={15} className={styles.center}>No estimates found for this chart.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
