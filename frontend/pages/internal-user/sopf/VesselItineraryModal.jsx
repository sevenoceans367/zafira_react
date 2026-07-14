import React, { useMemo } from 'react';
import { Button } from '@bainbridge/shared-ui';
import styles from './VesselItineraryModal.module.css';

function formatReportDate() {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(today.getDate())}-${pad(today.getMonth() + 1)}-${today.getFullYear()}`;
}

function formatMonDay(value) {
  if (!value) return '';
  const parts = String(value).trim().split(/[\s/:.-]+/);
  if (parts.length < 3) return value;
  const [d, m] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m) - 1] || m;
  return `${month} ${d}`;
}

/** PHP getVesselItinerary() — client-side itinerary report from passage legs. */
export default function VesselItineraryModal({
  open,
  onClose,
  form,
}) {
  const legs = form.portLegs || [];

  const rows = useMemo(() => {
    const out = [];
    for (const leg of legs) {
      if (leg.fromPortName || leg.fromArrival || leg.fromDeparture) {
        out.push({
          port: (leg.fromPortName || '').split(' / ')[0] || leg.fromPortName || '—',
          type: 'From',
          arrival: leg.fromArrival || '',
          departure: leg.fromDeparture || '',
          workingDays: leg.loadPortWorkDays || '',
          idleDays: leg.loadPortIdleDays || '',
          seaDays: '',
        });
      }
      if (leg.toPortName || leg.toArrival || leg.toDeparture) {
        out.push({
          port: (leg.toPortName || '').split(' / ')[0] || leg.toPortName || '—',
          type: 'To',
          arrival: leg.toArrival || '',
          departure: leg.toDeparture || '',
          workingDays: leg.discPortWorkDays || '',
          idleDays: leg.discPortIdleDays || '',
          seaDays: leg.seaDays || '',
        });
      }
    }
    return out;
  }, [legs]);

  const copyText = useMemo(() => {
    const vessel = form.vesselName || '';
    let text = `Vessel Name:    ${vessel}\n`;
    text += `Voyage No.:    ${form.voyageNo || ''}\n`;
    text += `Report Date:    ${formatReportDate()}\n\n`;
    text += 'Leg Details\n';
    for (const row of rows) {
      if (row.arrival) {
        text += `${formatMonDay(row.arrival)}  -  ${formatMonDay(row.departure)}  ETA/D  ${row.port}\n`;
      } else if (row.departure) {
        text += `${formatMonDay(row.departure)}  ETD  ${row.port}\n`;
      } else {
        text += `${row.port}\n`;
      }
    }
    return text;
  }, [form.vesselName, form.voyageNo, rows]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText.replace(/&nbsp;/g, ' '));
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Vessel itinerary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3>Itinerary</h3>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.body}>
          <div className={styles.meta}>
            <span>Voyage No.: {form.voyageNo || '—'}</span>
            <span>Vessel: {(form.vesselName || '').split('(')[0].trim() || '—'}</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Type</th>
                  <th>Arrival</th>
                  <th>Departure</th>
                  <th>Working Days</th>
                  <th>Idle Days</th>
                  <th>Sea Days</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row, index) => (
                  <tr key={`${row.port}-${row.type}-${index}`}>
                    <td>{row.port}</td>
                    <td>{row.type}</td>
                    <td>{row.arrival || '—'}</td>
                    <td>{row.departure || '—'}</td>
                    <td>{row.workingDays || '—'}</td>
                    <td>{row.idleDays || '—'}</td>
                    <td>{row.seaDays || '—'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>No passage legs yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className={styles.footer}>
          <Button type="button" variant="outline" label="Close" onClick={onClose} />
          <Button type="button" variant="primary" label="Copy Itinerary" onClick={handleCopy} />
        </div>
      </div>
    </div>
  );
}
