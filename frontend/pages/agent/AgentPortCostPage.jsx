import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { fetchAgentPortCost, saveAgentPortCost } from '../../services/agentPortal.js';
import styles from './AgentPortal.module.css';

function toInputNumber(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '';
}

function parseMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function AgentPortCostPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = String(searchParams.get('mode') || 'pda').toLowerCase() === 'fda' ? 'fda' : 'pda';
  const isFda = mode === 'fda';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setNotice('');
      try {
        const data = await fetchAgentPortCost(mode);
        if (cancelled) return;
        setForm({
          ...data,
          header: { ...(data.header || {}) },
          lines: (data.lines || []).map((line) => ({ ...line })),
        });
      } catch (err) {
        if (!cancelled) {
          setForm(null);
          setError(err.message || 'Failed to load port costs.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const exchangeRate = Number(form?.header?.exchangeRate) > 0
    ? Number(form.header.exchangeRate)
    : 1;

  const totals = useMemo(() => {
    if (!form?.lines) {
      return { estimatedLc: 0, estimatedUsd: 0, actualLc: 0, actualUsd: 0 };
    }
    return form.lines.reduce(
      (acc, line) => {
        acc.estimatedLc += parseMoney(line.estimatedLc);
        acc.estimatedUsd += parseMoney(line.estimatedUsd);
        acc.actualLc += parseMoney(line.actualLc);
        acc.actualUsd += parseMoney(line.actualUsd);
        return acc;
      },
      { estimatedLc: 0, estimatedUsd: 0, actualLc: 0, actualUsd: 0 },
    );
  }, [form]);

  const updateHeader = (key, value) => {
    setForm((prev) => (prev ? { ...prev, header: { ...prev.header, [key]: value } } : prev));
  };

  const updateLine = (index, key, value) => {
    setForm((prev) => {
      if (!prev) return prev;
      const lines = prev.lines.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, [key]: value };
        const rate = Number(prev.header?.exchangeRate) > 0 ? Number(prev.header.exchangeRate) : 1;
        if (key === 'estimatedLc' && !isFda) {
          next.estimatedUsd = Math.round((parseMoney(value) / rate) * 100) / 100;
        }
        if (key === 'actualLc' && isFda) {
          next.actualUsd = Math.round((parseMoney(value) / rate) * 100) / 100;
        }
        return next;
      });
      return { ...prev, lines };
    });
  };

  const applyExchangeToAll = () => {
    setForm((prev) => {
      if (!prev) return prev;
      const rate = Number(prev.header?.exchangeRate) > 0 ? Number(prev.header.exchangeRate) : 1;
      return {
        ...prev,
        lines: prev.lines.map((line) => ({
          ...line,
          estimatedUsd: Math.round((parseMoney(line.estimatedLc) / rate) * 100) / 100,
          actualUsd: Math.round((parseMoney(line.actualLc) / rate) * 100) / 100,
        })),
      };
    });
  };

  const persist = async (action) => {
    if (!form || form.readOnly) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await saveAgentPortCost({
        mode,
        action,
        header: form.header,
        lines: form.lines,
      });
      setNotice(action === 'submit'
        ? (isFda ? 'FDA submitted successfully.' : 'Initial PDA submitted successfully.')
        : 'Draft saved.');
      if (action === 'submit' && !isFda) {
        navigate('/agent/port-cost?mode=fda', { replace: true });
        return;
      }
      setForm((prev) => (prev ? {
        ...prev,
        status: result.status,
        initialStatus: result.initialStatus,
        fdaStatus: result.fdaStatus,
        lpCostId: result.lpCostId,
        readOnly: !isFda ? result.status >= 2 : result.status >= 3,
      } : prev));
      if (action === 'submit') {
        navigate('/agent/', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const title = isFda ? 'Final Disbursement Account (FDA)' : 'Initial Port Disbursement Account (PDA)';
  const readOnly = Boolean(form?.readOnly);

  return (
    <>
      {(loading || saving) ? <LoadingOverlay show fullScreen={false} /> : null}

      <div className={styles.pageHead}>
        <div className={styles.pageHeadLeft}>
          <div className={styles.pageHeadIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
          </div>
          <div>
            <h1 className={styles.pageTitle}>{title}</h1>
            <div className={styles.pageSub}>
              {form?.voyage?.vessel || '—'}
              {' · '}
              {form?.voyage?.id || '—'}
              {' · '}
              {form?.voyage?.port || '—'}
            </div>
          </div>
        </div>
        <div className={styles.controls}>
          <Link to="/agent/" className={`${styles.btnMini} ${styles.btnOutline}`}>
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className={styles.breadcrumb}>
        <Link to="/agent/">Home</Link>
        {' '}
        ›
        {' '}
        {isFda ? 'FDA' : 'Initial PDA'}
      </div>

      {error ? <div className={styles.formError}>{error}</div> : null}
      {notice ? <div className={styles.formNotice}>{notice}</div> : null}

      {!loading && form ? (
        <>
          <div className={styles.formCard}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Date</span>
                <input
                  type="date"
                  value={form.header.date || ''}
                  disabled={readOnly}
                  onChange={(e) => updateHeader('date', e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Local Currency</span>
                <input
                  type="text"
                  value={form.header.localCurrency || ''}
                  disabled={readOnly}
                  onChange={(e) => updateHeader('localCurrency', e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Exchange Rate (LC → USD)</span>
                <div className={styles.inlineActions}>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={toInputNumber(form.header.exchangeRate)}
                    disabled={readOnly}
                    onChange={(e) => updateHeader('exchangeRate', e.target.value)}
                  />
                  {!readOnly ? (
                    <button type="button" className={`${styles.btnMini} ${styles.btnOutline}`} onClick={applyExchangeToAll}>
                      Apply
                    </button>
                  ) : null}
                </div>
              </label>
              <label className={styles.field}>
                <span>Prepared By</span>
                <input
                  type="text"
                  value={form.header.preparedBy || ''}
                  disabled={readOnly}
                  onChange={(e) => updateHeader('preparedBy', e.target.value)}
                />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Bank Details</span>
                <textarea
                  rows={3}
                  value={form.header.bankDetails || ''}
                  disabled={readOnly}
                  onChange={(e) => updateHeader('bankDetails', e.target.value)}
                />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Agent Remarks</span>
                <textarea
                  rows={3}
                  value={form.header.agentRemarks || ''}
                  disabled={readOnly}
                  onChange={(e) => updateHeader('agentRemarks', e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableWrap}>
              <table className={styles.grid}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cost Type</th>
                    <th>Est. (LC)</th>
                    <th>Est. (USD)</th>
                    {isFda ? (
                      <>
                        <th>Actual (LC)</th>
                        <th>Actual (USD)</th>
                      </>
                    ) : null}
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {form.lines.length === 0 ? (
                    <tr>
                      <td colSpan={isFda ? 7 : 5} className={styles.emptyCell}>
                        No port cost types found for this country.
                      </td>
                    </tr>
                  ) : (
                    form.lines.map((line, index) => (
                      <tr key={line.pcTypeId || index}>
                        <td>{index + 1}</td>
                        <td>{line.name}</td>
                        <td>
                          <input
                            className={styles.cellInput}
                            type="number"
                            step="0.01"
                            value={toInputNumber(line.estimatedLc)}
                            disabled={readOnly || isFda}
                            onChange={(e) => updateLine(index, 'estimatedLc', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.cellInput}
                            type="number"
                            step="0.01"
                            value={toInputNumber(line.estimatedUsd)}
                            disabled={readOnly || isFda}
                            onChange={(e) => updateLine(index, 'estimatedUsd', e.target.value)}
                          />
                        </td>
                        {isFda ? (
                          <>
                            <td>
                              <input
                                className={styles.cellInput}
                                type="number"
                                step="0.01"
                                value={toInputNumber(line.actualLc)}
                                disabled={readOnly}
                                onChange={(e) => updateLine(index, 'actualLc', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className={styles.cellInput}
                                type="number"
                                step="0.01"
                                value={toInputNumber(line.actualUsd)}
                                disabled={readOnly}
                                onChange={(e) => updateLine(index, 'actualUsd', e.target.value)}
                              />
                            </td>
                          </>
                        ) : null}
                        <td>
                          <input
                            className={styles.cellInputWide}
                            type="text"
                            value={line.remarksAgent || ''}
                            disabled={readOnly}
                            onChange={(e) => updateLine(index, 'remarksAgent', e.target.value)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className={styles.totalsRow}>
                    <td colSpan={2}><strong>Totals</strong></td>
                    <td><strong>{totals.estimatedLc.toFixed(2)}</strong></td>
                    <td><strong>{totals.estimatedUsd.toFixed(2)}</strong></td>
                    {isFda ? (
                      <>
                        <td><strong>{totals.actualLc.toFixed(2)}</strong></td>
                        <td><strong>{totals.actualUsd.toFixed(2)}</strong></td>
                      </>
                    ) : null}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {!readOnly ? (
            <div className={styles.formActions}>
              <button
                type="button"
                className={`${styles.btnMini} ${styles.btnOutline}`}
                disabled={saving}
                onClick={() => persist('draft')}
              >
                Save Draft
              </button>
              <button
                type="button"
                className={`${styles.btnMini} ${styles.btnNavy}`}
                disabled={saving}
                onClick={() => persist('submit')}
              >
                {isFda ? 'Submit FDA' : 'Submit Initial PDA'}
              </button>
              <span className={styles.fxHint}>
                FX rate
                {' '}
                {exchangeRate}
              </span>
            </div>
          ) : (
            <div className={styles.formNotice}>
              This
              {' '}
              {isFda ? 'FDA' : 'Initial PDA'}
              {' '}
              is locked.
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
