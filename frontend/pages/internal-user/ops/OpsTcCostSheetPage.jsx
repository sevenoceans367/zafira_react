import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchOpsTcCostSheet, saveOpsTcCostSheet } from '../../../services/opsTc.js';
import { fetchTcEstimate } from '../../../services/tcEstimates.js';
import TcCalculatePage from '../tc/TcCalculatePage.jsx';
import styles from './OpsPages.module.css';

const BACK_BY_PAGE = {
  1: '/internal-user/vc/ops-tc/in-ops-glance',
  2: '/internal-user/vc/ops-tc/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops-tc/in-ops-glance?tab=history',
};

/** Map cost-sheet GET payload into TcCalculatePage / initFromDetail shape. */
function costSheetToDetail(data) {
  const header = data.header || {};
  const trip = (data.trips && data.trips[0]) || {};
  return {
    tcOutId: data.tcOutId || data.sourceTcOutId || '',
    fixtureType: '1',
    vesselName: header.vesselName || '',
    vesselType: header.vesselType || '',
    flag: header.flag || '',
    tcDate: header.tcDate || '',
    tcNo: header.tcNo || '',
    cpDate: header.cpDate || '',
    cpType: header.cpType || '',
    charterer: header.charterer || '',
    tripTc: header.tripTc || trip.tripTc || '',
    period: header.period || trip.period || '',
    noOfTrip: header.noOfTrip || trip.noOfTrip || '',
    periodId: header.periodId || '',
    hireFixPer: header.hireFixPer || trip.dailyGrossHire || '',
    addComm: header.addComm || trip.addCommPct || '',
    brokerComm: header.brokerComm || trip.brokerCommPct || '',
    exchangeRate: header.exchangeRate || trip.exchangeRate || '1',
    exchangeCurrency: trip.exchangeCurrency || 'USD',
    cveMonth: header.cveMonth || trip.cveMonth || '',
    delDate: trip.delDate || '',
    reDelDate: trip.reDelDate || '',
    calc: {
      ...trip,
      tripTc: header.tripTc || trip.tripTc || '',
      period: header.period || trip.period || '',
      noOfTrip: header.noOfTrip || trip.noOfTrip || '',
      deliveryBunkers: trip.deliveryBunkers || [],
      redeliveryBunkers: trip.redeliveryBunkers || [],
    },
    hirePeriods: trip.hirePeriods || [],
    deliveryBunkers: trip.deliveryBunkers || [],
    redeliveryBunkers: trip.redeliveryBunkers || [],
    otherIncome: trip.otherIncome || [],
    otherExpenses: trip.otherExpenses || [],
    offHires: trip.offHires || [],
    itinerary: trip.itinerary || { from: {}, to: {} },
    itineraryExpenses: trip.itineraryExpenses || [],
    tcInExpenses: trip.tcInExpenses || null,
  };
}

function formToCostSheetBody(payload, sheetMeta) {
  const { form, totals, detail } = payload;
  const firstTrip = (sheetMeta.trips && sheetMeta.trips[0]) || {};
  const restTrips = (sheetMeta.trips || []).slice(1);

  const tripPayload = {
    slave1Id: firstTrip.slave1Id || '',
    randomId: firstTrip.randomId || '',
    ...form.calc,
    ...totals,
    delDate: form.hirePeriods?.[0]?.delDate || form.calc?.delDate || '',
    reDelDate: form.hirePeriods?.[0]?.reDelDate || form.calc?.reDelDate || '',
    tcDays: totals.tcDays || form.hirePeriods?.[0]?.days || '',
    utilisationDays: totals.utilisationDays || '',
    hirePeriods: payload.hirePeriods || form.hirePeriods || [],
    deliveryBunkers: form.deliveryBunkers || [],
    redeliveryBunkers: form.redeliveryBunkers || [],
    offHires: form.offHires || [],
    otherIncome: form.otherIncome || [],
    otherExpenses: form.otherExpenses || [],
    otherIncomeTotal: String(payload.incomeTotal ?? ''),
    totalRev: totals.totalRev || '',
    totalExp: String(payload.totalExpenses ?? totals.totalExp ?? ''),
    voyageEarn: totals.voyageEarn || '',
    profitPerDay: totals.profitPerDay || '',
    bunkerDiffAmt: totals.bunkerDiffAmt || '',
    ballastBonus: form.calc?.ballastBonus || '',
    cveMonth: form.calc?.cveMonth || '',
    cve: totals.cve || '',
    addCommPct: form.calc?.addCommPct || '',
    addCommAmt: totals.addCommAmt || '',
    brokerCommPct: form.calc?.brokerCommPct || '',
    brokerCommAmt: totals.brokerCommAmt || '',
    nettHire: totals.nettHire || '',
    nettRev: totals.nettRev || '',
    lessOffHire: totals.lessOffHire || '',
    dailyGrossHire: form.calc?.dailyGrossHire || '',
    exchangeRate: form.calc?.exchangeRate || '1',
    exchangeCurrency: form.calc?.exchangeCurrency || 'USD',
  };

  return {
    header: {
      tripTc: form.calc?.tripTc || detail?.tripTc || '',
      period: form.calc?.period || detail?.period || '',
      noOfTrip: form.calc?.noOfTrip || detail?.noOfTrip || '',
      periodId: detail?.periodId || sheetMeta.header?.periodId || '',
      totalDays: totals.utilisationDays || sheetMeta.header?.totalDays || '',
      totalEarning: totals.voyageEarn || sheetMeta.header?.totalEarning || '',
      hireFixPer: detail?.hireFixPer || sheetMeta.header?.hireFixPer || '',
      addComm: form.calc?.addCommPct || '',
      brokerComm: form.calc?.brokerCommPct || '',
      exchangeRate: form.calc?.exchangeRate || '1',
      cveMonth: form.calc?.cveMonth || '',
    },
    trips: [tripPayload, ...restTrips],
    finalStatus: 0,
  };
}

/** Ops TC Financials — reuses TcCalculatePage layout (updatetcestimatecal). */
export default function OpsTcCostSheetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const costSheetId = searchParams.get('cost_sheet_id') || searchParams.get('costSheetId') || '';
  const page = Number(searchParams.get('page') || 1);
  const backHref = appPath(BACK_BY_PAGE[page] || BACK_BY_PAGE[1]);

  const [sheetMeta, setSheetMeta] = useState(null);
  const [initialDetail, setInitialDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!comId || !costSheetId) {
        setError('COMID and cost sheet id are required.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const sheet = await fetchOpsTcCostSheet(comId, costSheetId);
        if (cancelled) return;
        setSheetMeta(sheet);

        let detail = costSheetToDetail(sheet);
        // Prefer full estimate payload when a sheet TCOUTID already exists (edit/closed).
        if (sheet.tcOutId) {
          try {
            const estimate = await fetchTcEstimate(sheet.tcOutId);
            if (!cancelled && estimate) {
              detail = {
                ...estimate,
                tripTc: sheet.header?.tripTc || estimate.tripTc,
                period: sheet.header?.period || estimate.period,
                noOfTrip: sheet.header?.noOfTrip || estimate.noOfTrip,
                periodId: sheet.header?.periodId || estimate.periodId,
              };
            }
          } catch {
            // Keep mapped cost-sheet detail if estimate fetch fails.
          }
        }
        if (!cancelled) setInitialDetail(detail);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load TC Cost Sheet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [comId, costSheetId]);

  const handleSave = useCallback(async (payload) => {
    if (!sheetMeta) return;
    const body = formToCostSheetBody(payload, sheetMeta);
    await saveOpsTcCostSheet(comId, costSheetId, body);
    navigate(`${backHref}?msg=0`);
  }, [sheetMeta, comId, costSheetId, backHref, navigate]);

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay active label="Loading cost sheet…" />
      </div>
    );
  }

  if (error || !initialDetail || !sheetMeta) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <div className={styles.error}>{error || 'TC Cost Sheet not found.'}</div>
        <Link to={backHref}>Back</Link>
      </div>
    );
  }

  const mode = sheetMeta.mode || 'create';
  const readOnly = mode === 'closed';
  const sheetLabel = sheetMeta.sheetName || `Sheet ${costSheetId}`;
  const title = mode === 'closed'
    ? `Closed TC Cost Sheet — ${sheetLabel}`
    : mode === 'edit'
      ? `Update TC Cost Sheet — ${sheetLabel}`
      : `TC Cost Sheet — ${sheetLabel}`;

  return (
    <TcCalculatePage
      key={`${comId}-${costSheetId}-${sheetMeta.tcOutId || 'new'}`}
      initialDetail={initialDetail}
      overrideTcOutId={sheetMeta.tcOutId || null}
      readOnly={readOnly}
      listHref={backHref}
      pageTitle={title}
      onSave={handleSave}
      hideEditFixture
      saveLabel="Submit"
    />
  );
}
