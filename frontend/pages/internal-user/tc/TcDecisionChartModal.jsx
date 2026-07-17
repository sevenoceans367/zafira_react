import React, { useEffect, useState } from 'react';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchTcCompareEstimates, submitTcDecisionChart } from '../../../services/tcEstimates.js';
import styles from './TcPages.module.css';

export default function TcDecisionChartModal({
  open,
  ids = [],
  onClose,
  onSubmitted,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fixtures, setFixtures] = useState([]);
  const [finalId, setFinalId] = useState('');
  const [remarks, setRemarks] = useState({});

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchTcCompareEstimates(ids);
        if (cancelled) return;
        const rows = data.fixtures || [];
        setFixtures(rows);
        setFinalId(rows[0]?.tcOutId ? String(rows[0].tcOutId) : '');
        setRemarks({});
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load compare list.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, ids]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!finalId) {
      setError('Please select one final estimate.');
      return;
    }
    if (!String(remarks[finalId] || '').trim()) {
      setError('Please select one Fixture and fill remarks.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await submitTcDecisionChart({
        finalId,
        candidates: fixtures.map((row) => ({
          tcOutId: row.tcOutId,
          remarks: remarks[row.tcOutId] || '',
        })),
      });
      onSubmitted?.();
    } catch (err) {
      setError(err.message || 'Failed to submit decision chart.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        {loading ? <LoadingOverlay active label="Loading compare candidates…" /> : null}
        <div className={styles.modalHeader}>
          <h3>Decision Chart — Select Final TC Estimate</h3>
          <Button variant="outline" label="Close" onClick={onClose} disabled={saving} />
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Vessel</th>
                <th>TC No.</th>
                <th>CP Date</th>
                <th>Del / ReDel</th>
                <th>TC Days</th>
                <th>Daily Gross Hire</th>
                <th>Total Rev</th>
                <th>Remarks</th>
                <th className={styles.center}>Final</th>
                <th className={styles.center}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {fixtures.map((row) => (
                <tr key={row.tcOutId}>
                  <td>{row.index}</td>
                  <td>{row.vesselName}</td>
                  <td>{row.tcNo}</td>
                  <td>{row.cpDate}</td>
                  <td>{row.delPort} / {row.reDelPort}</td>
                  <td>{row.tcDays}</td>
                  <td>{row.dailyGrossHire}</td>
                  <td>{row.totalRev}</td>
                  <td>
                    <input
                      value={remarks[row.tcOutId] || ''}
                      onChange={(e) => setRemarks((prev) => ({ ...prev, [row.tcOutId]: e.target.value }))}
                      placeholder="Remarks"
                    />
                  </td>
                  <td className={styles.center}>
                    <input
                      type="radio"
                      name="finalTc"
                      checked={String(finalId) === String(row.tcOutId)}
                      onChange={() => setFinalId(String(row.tcOutId))}
                    />
                  </td>
                  <td className={styles.center}>
                    <a href={appPath(`/internal-user/vc/tc/${row.tcOutId}/edit`)}>Edit</a>
                  </td>
                </tr>
              ))}
              {!fixtures.length && !loading ? (
                <tr>
                  <td colSpan={11} className={styles.center}>No candidates selected.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className={styles.formActions}>
          <Button label={saving ? 'Submitting…' : 'Submit Final'} onClick={handleSubmit} disabled={saving || !fixtures.length} />
          <Button variant="outline" label="Cancel" onClick={onClose} disabled={saving} />
        </div>
      </div>
    </div>
  );
}
