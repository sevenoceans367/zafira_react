import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, useAlert, useConfirm } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  downloadClubbedFreightPdf,
  fetchClubbedFreightInvoice,
  reopenClubbedFreightInvoice,
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
 * Read-only React port of PHP view_clubbed_invoice.php (Invoice Clubbed).
 * Query: id, name, invType, voyageNo, page
 */
export default function OpsVcClubbedInvoicePage() {
  const alert = useAlert();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();

  const id = searchParams.get('id') || '';
  const name = searchParams.get('name') || '';
  const invType = searchParams.get('invType') || searchParams.get('invtype') || 'Final';
  const page = searchParams.get('page') || '1';
  const voyageNo = searchParams.get('voyageNo') || searchParams.get('voyage_no') || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const backHref = useMemo(() => {
    const comId = context?.comId || id.split(',')[0] || '';
    const params = new URLSearchParams({ comid: comId, page });
    if (voyageNo || context?.voyageNo) {
      params.set('voyageNo', voyageNo || context.voyageNo);
    }
    return appPath(`/internal-user/vc/ops/payment-grid?${params.toString()}`);
  }, [context?.comId, context?.voyageNo, id, page, voyageNo]);

  useEffect(() => {
    if (!id) {
      setError('Invoice context id is required.');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchClubbedFreightInvoice({
          id,
          name,
          invType,
          voyageNo,
          page,
        });
        if (!cancelled) setContext(data);
      } catch (err) {
        if (!cancelled) {
          setContext(null);
          setError(err.message || 'Failed to load clubbed freight invoice.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, invType, name, page, reloadToken, voyageNo]);

  const isMgmt = Boolean(context?.auth?.isMgmtUser);
  const current = context?.currentInvoice || null;
  const existingInvoices = context?.existingInvoices || [];
  const clubbedCharterers = context?.clubbedCharterers || [];
  const estimateClubCharterers = context?.estimateClubCharterers || [];
  const pdfInvoiceId = context?.pdfInvoiceId || current?.invoiceId || existingInvoices[0]?.invoiceId || '';

  const handlePdf = async (invoiceId) => {
    if (!invoiceId) return;
    try {
      await downloadClubbedFreightPdf(invoiceId);
    } catch (err) {
      setError(err.message || 'Failed to download PDF.');
    }
  };

  const handleReopen = async (invoice) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to reopen this invoice?',
      confirmLabel: 'Reopen',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    setSaving(true);
    setError('');
    try {
      await reopenClubbedFreightInvoice(invoice.invoiceId);
      await alert({
        title: 'Done',
        message: 'Invoice reopened successfully.',
        confirmLabel: 'OK',
      });
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err.message || 'Failed to reopen invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? (
        <LoadingOverlay show label={saving ? 'Updating invoice…' : 'Loading clubbed invoice…'} />
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

      <h2 className={styles.title}>
        Clubbed Freight Invoice
        {name || context?.name ? `: ${name || context.name}` : ''}
        {invType || context?.invType ? ` (${invType || context.invType})` : ''}
      </h2>

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
              <p className={styles.metaLine}>Cargo: {dash(context.cargoName)}</p>
              <p className={styles.metaLine}>Load: {dash(context.loadPorts)}</p>
              <p className={styles.metaLine}>Discharge: {dash(context.dischargePorts)}</p>
            </div>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Invoice summary</p>
              <p className={styles.metaLine}>Invoice No: {dash(current?.invoiceNo)}</p>
              <p className={styles.metaLine}>Type: {dash(current?.invType || invType)}</p>
              <p className={styles.metaLine}>Date: {dash(current?.invoiceDate)}</p>
              <p className={styles.metaLine}>
                Gross Freight: {current ? money2(current.grossFreight) : '—'}
              </p>
              <p className={styles.metaLine}>
                Net Payable: {current ? money2(current.netPayableTax || current.netPayable) : '—'}
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
            <h3 className={styles.sectionTitle}>Clubbed charterers</h3>
            <div className={styles.sectionBody}>
              {clubbedCharterers.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.linesTable}>
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Type</th>
                        <th>Charterer</th>
                        <th>Cargo</th>
                        <th className={styles.num}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clubbedCharterers.map((row) => (
                        <tr key={`${row.invoiceId}-${row.vendorId}-${row.cargoId}-${row.randomId}`}>
                          <td>{dash(row.invoiceNo)}</td>
                          <td>{dash(row.invType)}</td>
                          <td>{dash(row.vendorName)}</td>
                          <td>{dash(row.cargoName)}</td>
                          <td className={styles.num}>{money2(row.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.muted}>No clubbed charterer lines on this invoice.</p>
              )}

              {estimateClubCharterers.length ? (
                <div className={styles.tableWrap} style={{ marginTop: 16 }}>
                  <table className={styles.linesTable}>
                    <thead>
                      <tr>
                        <th>Estimate charterer</th>
                        <th>Cargo</th>
                        <th className={styles.num}>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimateClubCharterers.map((row) => (
                        <tr key={`${row.vendorId}-${row.cargoId}-${row.randomId}-${row.slaveId}`}>
                          <td>{dash(row.vendorName)}</td>
                          <td>{dash(row.cargoName)}</td>
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
            <h3 className={styles.sectionTitle}>Existing invoices</h3>
            <div className={styles.sectionBody}>
              {existingInvoices.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.linesTable}>
                    <thead>
                      <tr>
                        <th>Fixture No</th>
                        <th>Vessel</th>
                        <th>Invoice Type</th>
                        <th>Invoice No</th>
                        <th>Charterer</th>
                        <th className={styles.num}>Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingInvoices.map((row) => (
                        <tr key={row.invoiceId}>
                          <td>{dash(context.voyageNo)}</td>
                          <td>{dash(context.vesselName)}</td>
                          <td>{dash(row.invType || row.invoiceType)}</td>
                          <td>{dash(row.invoiceNo)}</td>
                          <td>{dash(row.vendorName || row.chartererName || context.vendorName)}</td>
                          <td className={styles.num}>
                            {money2(row.netPayableTax || row.netPayable || row.amount)}
                          </td>
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
                <p className={styles.muted}>No approved clubbed freight invoices found.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
