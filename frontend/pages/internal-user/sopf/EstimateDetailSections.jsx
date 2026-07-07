import React from 'react';
import { DmyDateInput } from '@bainbridge/shared-ui';
import { FIXTURE_TYPE_OPTIONS, getFixtureTypeLabel } from './estimateDetail.constants.js';
import styles from './UpdateEstimatePage.module.css';

export default function EstimateDetailSections({
  detail,
  form,
  readOnly = false,
  onFieldChange,
}) {
  const updateField = (key, value) => {
    onFieldChange?.(key, value);
  };

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>Estimate Header</div>
        <div className={styles.panelBody}>
          <div className={styles.headerGrid}>
            <div className={styles.field}>
              <label htmlFor="fixtureTypeId">Business Type</label>
              {readOnly ? (
                <input id="fixtureTypeId" value={getFixtureTypeLabel(form.fixtureTypeId)} readOnly />
              ) : (
                <select
                  id="fixtureTypeId"
                  value={form.fixtureTypeId}
                  onChange={(event) => updateField('fixtureTypeId', event.target.value)}
                >
                  <option value="">Select from list</option>
                  {FIXTURE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="vesselName">Vessel</label>
              <input id="vesselName" value={form.vesselName} readOnly />
            </div>

            <div className={styles.field}>
              <label htmlFor="vesselType">Vessel Type</label>
              <input
                id="vesselType"
                value={form.vesselType}
                readOnly={readOnly}
                onChange={(event) => updateField('vesselType', event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="flag">Flag</label>
              <input id="flag" value={form.flag} readOnly />
            </div>

            <div className={styles.field}>
              <label htmlFor="transDate">CP Date</label>
              {readOnly ? (
                <input id="transDate" value={form.transDate} readOnly />
              ) : (
                <DmyDateInput
                  id="transDate"
                  value={form.transDate}
                  onChange={(value) => updateField('transDate', value)}
                />
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="voyageNo">Voyage No.</label>
              <input id="voyageNo" value={form.voyageNo} readOnly />
            </div>

            <div className={styles.field}>
              <label htmlFor="voyageName">Sheet Name</label>
              <input
                id="voyageName"
                value={form.voyageName}
                readOnly={readOnly}
                onChange={(event) => updateField('voyageName', event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label>Estimate Type</label>
              <input value={detail.estimateTypeLabel} readOnly />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>Voyage Financials : Estimate</div>
        <div className={styles.panelBody}>
          <div className={styles.headerGrid}>
            <div className={styles.field}>
              <label htmlFor="dwtSummer">DWT (Summer)</label>
              <input id="dwtSummer" value={form.dwtSummer} readOnly />
            </div>
            <div className={styles.field}>
              <label htmlFor="gnrt">GRT</label>
              <input
                id="gnrt"
                value={form.gnrt}
                readOnly={readOnly}
                onChange={(event) => updateField('gnrt', event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>NRT</label>
              <input
                value={form.gnrt ? (Number(form.gnrt) * 0.7).toFixed(2) : ''}
                readOnly
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="loa">LOA</label>
              <input id="loa" value={form.loa} readOnly />
            </div>
            <div className={styles.field}>
              <label htmlFor="tpc">TPC</label>
              <input id="tpc" value={form.tpc} readOnly />
            </div>
          </div>

          <div className={styles.metricsGrid} style={{ marginTop: '16px' }}>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Duration</p>
              <p className={styles.metricValue}>{detail.totalDays ?? '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Cargo Qty</p>
              <p className={styles.metricValue}>{detail.cargoQuantity ?? '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>TCE</p>
              <p className={styles.metricValue}>{detail.dailyEarning ?? '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>P/L</p>
              <p className={styles.metricValue}>{detail.profitLoss ?? '—'}</p>
            </div>
          </div>
        </div>
      </section>

      {detail.portLegs?.length ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>Port Route</div>
          <div className={`${styles.panelBody} ${styles.tableWrap}`}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Distance</th>
                  <th>Sea Days</th>
                </tr>
              </thead>
              <tbody>
                {detail.portLegs.map((leg) => (
                  <tr key={leg.id}>
                    <td>{leg.fromPortName || leg.fromPortId}</td>
                    <td>{leg.toPortName || leg.toPortId}</td>
                    <td>{leg.distance ?? '—'}</td>
                    <td>{leg.seaDays ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
