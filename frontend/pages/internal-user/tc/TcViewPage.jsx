import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchTcEstimate } from '../../../services/tcEstimates.js';
import TcFormHeaderActions from './TcFormHeaderActions.jsx';
import styles from './TcPages.module.css';

function ReadField({ label, value }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <div className={styles.fieldRead}>{value || '—'}</div>
    </div>
  );
}

export default function TcViewPage() {
  const { tcOutId } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const listHref = appPath('/internal-user/vc/tc');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchTcEstimate(tcOutId);
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load estimate.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tcOutId]);

  const calc = detail?.calc || {};

  return (
    <div className={`zafira-page ${styles.page}`}>
      <TcFormHeaderActions listHref={listHref} />
      {loading ? <LoadingOverlay active label="Loading estimate…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      <h3 className={styles.title}>View TC Estimate {detail?.tcNo ? `— ${detail.tcNo}` : ''}</h3>

      {detail ? (
        <>
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Fixture Summary</h4>
            <div className={styles.formGrid}>
              <ReadField label="TC No." value={detail.tcNo} />
              <ReadField label="CP Date" value={detail.cpDate} />
              <ReadField label="Vessel Type" value={detail.vesselType} />
              <ReadField label="Delivery Port" value={detail.delRangePort} />
              <ReadField label="Redelivery Port" value={detail.reDelRange} />
              <ReadField label="Hire Fix / Day" value={detail.hireFixPer} />
              <ReadField label="Exchange Rate" value={detail.exchangeRate} />
              <ReadField label="Add Comm %" value={detail.addComm} />
              <ReadField label="Broker Comm %" value={detail.brokerComm} />
              <ReadField label="COMID" value={detail.comId} />
            </div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Calculation / P&L</h4>
            <div className={styles.formGrid}>
              <ReadField label="TC Days" value={calc.tcDays} />
              <ReadField label="Utilisation Days" value={calc.utilisationDays} />
              <ReadField label="Daily Gross Hire" value={calc.dailyGrossHire} />
              <ReadField label="Nett Hire" value={calc.nettHire} />
              <ReadField label="Nett Revenue" value={calc.nettRev} />
              <ReadField label="Less Off Hire" value={calc.lessOffHire} />
              <ReadField label="CVE" value={calc.cve} />
              <ReadField label="Other Income" value={calc.otherIncome} />
              <ReadField label="Bunker Diff" value={calc.bunkerDiffAmt} />
              <ReadField label="Total Revenue" value={calc.totalRev} />
              <ReadField label="Total Expenses" value={calc.totalExp} />
              <ReadField label="Voyage Earnings" value={calc.voyageEarn} />
              <ReadField label="Profit / Day" value={calc.profitPerDay} />
            </div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Other Income Rows</h4>
            <table className={styles.rowTable}>
              <thead><tr><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {(detail.otherIncome || []).map((row, index) => (
                  <tr key={`inc-${index}`}>
                    <td>{row.description || '—'}</td>
                    <td>{row.amount || '—'}</td>
                  </tr>
                ))}
                {!detail.otherIncome?.length ? (
                  <tr><td colSpan={2} className={styles.center}>None</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Other Expenses</h4>
            <table className={styles.rowTable}>
              <thead><tr><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {(detail.otherExpenses || []).map((row, index) => (
                  <tr key={`exp-${index}`}>
                    <td>{row.description || '—'}</td>
                    <td>{row.amount || '—'}</td>
                  </tr>
                ))}
                {!detail.otherExpenses?.length ? (
                  <tr><td colSpan={2} className={styles.center}>None</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className={styles.formActions}>
            <Button label="Edit Fixture" href={appPath(`/internal-user/vc/tc/${tcOutId}/edit`)} />
            {!detail.comId ? (
              <Button variant="outline" label="Calculate" href={appPath(`/internal-user/vc/tc/${tcOutId}/calculate`)} />
            ) : null}
            <Button variant="outline" label="Back to List" href={listHref} />
          </div>
        </>
      ) : null}
    </div>
  );
}
