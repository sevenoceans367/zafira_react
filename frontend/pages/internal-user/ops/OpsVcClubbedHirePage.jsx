import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, useAlert, useConfirm } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  downloadClubbedHirePdf,
  fetchClubbedHireInvoice,
  reopenClubbedHireInvoice,
} from '../../../services/opsVc.js';
import styles from './OpsVcClubbedInvoicePage.module.css';

function money2(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function dash(value) {
  const text = value == null ? '' : String(value).trim();
  return text || '—';
}

/**
 * Read-only React port of PHP view_clubbed_invoice_hire.php (Payment Clubbed / hire ORC).
 * Query: comId, page, voyageNo
 */
export default function OpsVcClubbedHirePage() {
  const alert = useAlert();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();

  const comId = searchParams.get('comId') || searchParams.get('comid') || '';
  const page = searchParams.get('page') || '1';
  const voyageNo = searchParams.get('voyageNo') || searchParams.get('voyage_no') || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const backHref = useMemo(() => {
    const params = new URLSearchParams({ comid: comId || context?.comId || '', page });
    if (voyageNo || context?.voyageNo) {
      params.set('voyageNo', voyageNo || context.voyageNo);
    }
    return appPath(`/internal-user/vc/ops/payment-grid?${params.toString()}`);
  }, [comId, context?.comId, context?.voyageNo, page, voyageNo]);

  useEffect(() => {
    if (!comId) {
      setError('COMID is required.');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchClubbedHireInvoice({
          comId,
          page,
          voyageNo,
        });
        if (!cancelled) setContext(data);
      } catch (err) {
        if (!cancelled) {
          setContext(null);
          setError(err.message || 'Failed to load clubbed hire statement.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [comId, page, reloadToken, voyageNo]);

  const isMgmt = Boolean(context?.auth?.isMgmtUser);
  const current = context?.currentInvoice || context?.latestInvoice || null;
  const existingInvoices = context?.existingInvoices || [];
  const clubbedOrcs = context?.clubbedOrcs || [];
  const estimateOrcs = context?.estimateOrcs || [];
  const pdfInvoiceId = context?.pdfInvoiceId || current?.invoiceId || existingInvoices[0]?.invoiceId || '';

  const handlePdf = async (invoiceId) => {
    if (!invoiceId) return;
    try {
      await downloadClubbedHirePdf(invoiceId);
    } catch (err) {
      setError(err.message || 'Failed to download PDF.');
    }
  };

  const handleReopen = async (invoice) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to reopen this hire statement?',
      confirmLabel: 'Reopen',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    setSaving(true);
    setError('');
    try {
      await reopenClubbedHireInvoice(invoice.invoiceId);
      await alert({
        title: 'Done',
        message: 'Hire statement reopened successfully.',
        confirmLabel: 'OK',
      });
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err.message || 'Failed to reopen hire statement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? (
        <LoadingOverlay show label={saving ? 'Updating hire statement…' : 'Loading clubbed hire…'} />
      ) : null}

      <div className={styles.toolbar}>
        <Button variant="outline" label="Back" href={backHref} disabled={saving} />
        {pdfInvoiceId ? (
          <Button
            variant="primary"
            label="Generate PDF"
            onClick={() => handlePdf(pdfInvoiceId)}
            disabled={loading || saving}
          />
        ) : null}
      </div>

      <h2 className={styles.title}>Clubbed Hire Statement</h2>

      {error ? <div className={styles.error}>{error}</div> : null}

      {!loading && context ? (
        <>
          <div className={styles.infoGrid}>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Nomination</p>
              <p className={styles.metaLine}>Nom ID: {dash(context.nomMessage)}</p>
              <p className={styles.metaLine}>Vessel: {dash(context.vesselName)}</p>
              <p className={styles.metaLine}>Vendor: {dash(context.vendorName)}</p>
              {context.vendorAddress ? (
                <p className={styles.metaLine}>{context.vendorAddress}</p>
              ) : null}
            </div>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Voyage</p>
              <p className={styles.metaLine}>Voyage No: {dash(context.voyageNo || voyageNo)}</p>
              <p className={styles.metaLine}>CP Date: {dash(context.cpDate)}</p>
              {context.tcNo ? <p className={styles.metaLine}>TC No: {context.tcNo}</p> : null}
              <p className={styles.metaLine}>Load: {dash(context.loadPorts)}</p>
              <p className={styles.metaLine}>Discharge: {dash(context.dischargePorts)}</p>
            </div>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Hire summary</p>
              <p className={styles.metaLine}>Statement No: {dash(current?.invoiceNo)}</p>
              <p className={styles.metaLine}>Type: {dash(current?.invType)}</p>
              <p className={styles.metaLine}>Date: {dash(current?.invoiceDate)}</p>
              <p className={styles.metaLine}>
                Hire: {dash(current?.hireFrom)} – {dash(current?.hireTo)}
              </p>
              <p className={styles.metaLine}>
                Balance to owner: {current ? money2(current.balanceToOwner || current.finalAmt) : '—'}
              </p>
              {current?.lastUpdatedBy ? (
                <p className={styles.metaLine}>
                  Last updated: {current.lastUpdatedBy}
                  {current.lastUpdatedAt ? ` — ${current.lastUpdatedAt}` : ''}
                </p>
              ) : null}
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Clubbed owner related costs</h3>
            <div className={styles.sectionBody}>
              {clubbedOrcs.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.linesTable}>
                    <thead>
                      <tr>
                        <th>Hire statement</th>
                        <th>Type</th>
                        <th>Cost</th>
                        <th>Vendor</th>
                        <th className={styles.num}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clubbedOrcs.map((row) => (
                        <tr key={`${row.invoiceId}-${row.orcId}-${row.randomId}`}>
                          <td>{dash(row.invoiceNo)}</td>
                          <td>{dash(row.invType)}</td>
                          <td>{dash(row.costName)}</td>
                          <td>{dash(row.vendorName)}</td>
                          <td className={styles.num}>{money2(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.muted}>No clubbed ORC lines on hire statements for this nomination.</p>
              )}

              {estimateOrcs.length ? (
                <div className={styles.tableWrap} style={{ marginTop: 16 }}>
                  <table className={styles.linesTable}>
                    <thead>
                      <tr>
                        <th>Estimate ORC</th>
                        <th>Vendor</th>
                        <th className={styles.num}>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimateOrcs.map((row) => (
                        <tr key={`${row.orcId}-${row.randomId}-${row.vendorId}`}>
                          <td>{dash(row.costName)}</td>
                          <td>{dash(row.vendorName)}</td>
                          <td className={styles.num}>{money2(row.amount)}</td>
                          <td>
                            <span className={row.clubbed ? styles.badgeOk : styles.badge}>
                              {row.clubbed ? 'Clubbed' : 'Not clubbed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Existing hire statements</h3>
            <div className={styles.sectionBody}>
              {existingInvoices.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.linesTable}>
                    <thead>
                      <tr>
                        <th>Fixture No</th>
                        <th>Date</th>
                        <th>Statement No</th>
                        <th>Hire From – To</th>
                        <th>Days</th>
                        <th className={styles.num}>Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingInvoices.map((row) => (
                        <tr key={row.invoiceId}>
                          <td>{dash(context.voyageNo)}</td>
                          <td>{dash(row.invoiceDate)}</td>
                          <td>{dash(row.invoiceNo)}</td>
                          <td>{[row.hireFrom, row.hireTo].filter(Boolean).join(' – ') || '—'}</td>
                          <td>{row.utilisedDays != null ? money2(row.utilisedDays) : money2(row.hireDays)}</td>
                          <td className={styles.num}>{money2(row.balanceToOwner || row.finalAmt)}</td>
                          <td>
                            <div className={styles.actionBtns}>
                              {row.canPdf !== false ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  label="PDF"
                                  onClick={() => handlePdf(row.invoiceId)}
                                />
                              ) : null}
                              {isMgmt && row.canReopen !== false ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  label="Reopen"
                                  onClick={() => handleReopen(row)}
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.muted}>No approved hire statements found.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
