import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchVoyageReports } from '../../../services/opsVc.js';
import styles from './OpsPages.module.css';

const COLUMNS = [
  { key: 'index', label: '#' },
  { key: 'reportTitle', label: 'Report Title/type' },
  { key: 'vesselType', label: 'Vessel Type' },
  { key: 'messageNo', label: 'Message No.' },
  { key: 'vesselName', label: 'Vessel Name' },
  { key: 'voyageNo', label: 'Voy No.' },
  { key: 'charterer', label: 'Charterer' },
  { key: 'reportingLt', label: 'Reporting Date/Time(LT)' },
  { key: 'timeZone', label: 'Time Zone' },
  { key: 'reportingUtc', label: 'Reporting Date/Time(UTC)' },
  { key: 'draftFore', label: 'Draft Fore(M)' },
  { key: 'draftAft', label: 'Draft Fore(A)' },
  { key: 'depPort', label: 'Dep Port' },
  { key: 'portOfArrival', label: 'Port Of Arrival' },
  { key: 'portVisitReasons', label: 'Port Visit Reasons' },
  { key: 'nextPort', label: 'Next Port' },
  { key: 'etaNextPort', label: 'ETA Next Port' },
  { key: 'vesselCondition', label: 'Vessel Condition' },
  { key: 'weatherDirection', label: 'Weather Direction' },
  { key: 'windForce', label: 'Wind Force' },
  { key: 'seaState', label: 'Sea State' },
  { key: 'swellState', label: 'Swell State' },
  { key: 'swellDirection', label: 'Swell Direction' },
  { key: 'latitude', label: 'Lat' },
  { key: 'longitude', label: 'Long' },
  { key: 'orderedSpeed', label: 'Ordered Speed' },
  { key: 'distToGo', label: 'Dist To Go (Nm)' },
  { key: 'totalVoyageDist', label: 'Total Voyage Dist. (Nm)' },
  { key: 'observedDist', label: 'Obsd Dist. (Nm)' },
  { key: 'noonHdg', label: 'Noon Hdg (Deg)' },
  { key: 'stoppage', label: 'Stoppage (Hrs)' },
  { key: 'effectiveSteaming', label: 'Effective Steaming (Hrs)' },
  { key: 'observedSpeed', label: 'Obsd Speed (Kts)' },
  { key: 'downtime', label: 'Down Time', wrap: true },
  { key: 'conspMain', label: 'Consp (Main Propulsion + AEs)', wrap: true },
  { key: 'conspTankCleaning', label: 'Consp (Tank Cleaning/Crude Oil Washing)', wrap: true },
  { key: 'conspGasFreeing', label: 'Consp (Gas Freeing/Inerting)', wrap: true },
  { key: 'conspOther', label: 'Consp Other', wrap: true },
  { key: 'totalRob', label: 'Total ROB', wrap: true },
  { key: 'totalConsp', label: 'Total Consp', wrap: true },
  { key: 'bunkerSupplied', label: 'Bunker Supplied', wrap: true },
];

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

function Multiline({ value }) {
  if (value == null || value === '') return '—';
  return String(value).split('\n').map((line, index) => (
    <span key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line || '\u00A0'}
    </span>
  ));
}

function cellValue(row, column) {
  const value = row[column.key];
  if (column.key === 'index') return value != null ? `${value}.` : '—';
  if (column.wrap) return <Multiline value={value} />;
  return value == null || value === '' ? '—' : String(value);
}

export default function OpsVcVoyageReportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vesselImoNo = searchParams.get('vesselimono') || searchParams.get('vesselImoNo') || '';
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';
  const selYear = searchParams.get('selYear') || '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    const year = selYear || data?.voyageYear || '';
    const query = year ? `?selYear=${encodeURIComponent(year)}` : '';
    return appPath(`${path}${query}`);
  }, [page, selYear, data?.voyageYear]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await fetchVoyageReports({ vesselImoNo, comId, selYear });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err.message || 'Failed to load voyage reports.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vesselImoNo, comId, selYear]);

  const records = data?.records || [];

  return (
    <div className={`zafira-page ${styles.page}`}>
      {loading ? <LoadingOverlay /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.toolbar}>
        <div>
          {data?.vesselName ? (
            <div className={styles.muted}>
              {data.vesselName}
              {data.voyageNo ? ` · Voy ${data.voyageNo}` : ''}
              {data.vesselImoNo ? ` · IMO ${data.vesselImoNo}` : ''}
            </div>
          ) : null}
        </div>
        <div className={styles.toolbarActions}>
          <Button variant="secondary" label="Back" onClick={() => navigate(backHref)} />
        </div>
      </div>

      <h3 className={styles.title}>VOYAGE REPORT</h3>

      <div className={`${styles.tableWrap} ${styles.wideTableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && !records.length ? (
              <tr>
                <td colSpan={COLUMNS.length} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : records.map((row) => (
              <tr key={`${row.reportType}-${row.messageNo}-${row.reportingLt}-${row.index}`}>
                {COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    className={column.wrap ? styles.wrapCell : undefined}
                  >
                    {cellValue(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
