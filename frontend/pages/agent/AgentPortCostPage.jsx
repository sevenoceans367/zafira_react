import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  CardSelect,
  HeaderFilterControls,
  LoadingOverlay,
  TextInput,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchAgentPortCost, saveAgentPortCost } from '../../services/agentPortal.js';
import PageHeaderActions from '../internal-user/PageHeaderActions.jsx';
import {
  COST_CATEGORIES,
  CURRENCY_OPTIONS,
  groupLinesByCategory,
} from './agentCostCategories.js';
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

function fmtMoney(n) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function InfoTip({ text }) {
  if (!text) return null;
  return (
    <span className={styles.infoTip} title={text} aria-label={text}>
      i
    </span>
  );
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
  const [costSearch, setCostSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [displayMode, setDisplayMode] = useState('local');
  const [openCats, setOpenCats] = useState(() => new Set(COST_CATEGORIES.map((c) => c.key)));

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
        setOpenCats(new Set(COST_CATEGORIES.map((c) => c.key)));
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
  const localCurrency = form?.header?.localCurrency || 'USD';
  const showLocal = displayMode === 'local';

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

  const varianceLc = totals.actualLc - totals.estimatedLc;
  const varianceUsd = totals.actualUsd - totals.estimatedUsd;

  const grouped = useMemo(() => {
    const cats = groupLinesByCategory(form?.lines || []);
    const q = costSearch.trim().toLowerCase();
    return cats
      .map((cat) => ({
        ...cat,
        lines: cat.lines.filter((line) => {
          if (categoryFilter && cat.key !== categoryFilter) return false;
          if (!q) return true;
          return String(line.name || '').toLowerCase().includes(q)
            || String(line.description || '').toLowerCase().includes(q);
        }),
      }))
      .filter((cat) => cat.lines.length > 0);
  }, [form?.lines, costSearch, categoryFilter]);

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
        if (key === 'estimatedUsd' && !isFda) {
          next.estimatedLc = Math.round((parseMoney(value) * rate) * 100) / 100;
        }
        if (key === 'actualLc' && isFda) {
          next.actualUsd = Math.round((parseMoney(value) / rate) * 100) / 100;
        }
        if (key === 'actualUsd' && isFda) {
          next.actualLc = Math.round((parseMoney(value) * rate) * 100) / 100;
        }
        return next;
      });
      return { ...prev, lines };
    });
  };

  const onExchangeChange = (value) => {
    setForm((prev) => {
      if (!prev) return prev;
      const rate = Number(value) > 0 ? Number(value) : 1;
      return {
        ...prev,
        header: { ...prev.header, exchangeRate: value },
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

  const toggleCat = (key) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onCategoryFilterChange = (value) => {
    setCategoryFilter(value);
    if (value) setOpenCats(new Set([value]));
    else setOpenCats(new Set(COST_CATEGORIES.map((c) => c.key)));
  };

  const readOnly = Boolean(form?.readOnly);
  const modeTitle = isFda ? 'FDA' : 'Initial PDA';

  const primaryEst = (line) => (showLocal ? line.estimatedLc : line.estimatedUsd);
  const primaryAct = (line) => (showLocal ? line.actualLc : line.actualUsd);
  const fxEst = (line) => (showLocal
    ? `≈ ${fmtMoney(parseMoney(line.estimatedUsd))} USD`
    : `≈ ${fmtMoney(parseMoney(line.estimatedLc))} ${localCurrency}`);
  const fxAct = (line) => (showLocal
    ? `≈ ${fmtMoney(parseMoney(line.actualUsd))} USD`
    : `≈ ${fmtMoney(parseMoney(line.actualLc))} ${localCurrency}`);

  return (
    <>
      {(loading || saving) ? <LoadingOverlay show fullScreen={false} /> : null}

      <PageHeaderActions deps={[]}>
        <HeaderFilterControls>
          <Button variant="secondary" label="Back" href={appPath('/agent/')} />
        </HeaderFilterControls>
      </PageHeaderActions>

      <p className={styles.pageSubInline}>
        Fill in every line item that applies to this call — leave the rest blank.
        Your Estimated/Actual figures roll up automatically.
      </p>

      {error ? <div className={styles.formError}>{error}</div> : null}
      {notice ? <div className={styles.formNotice}>{notice}</div> : null}

      {!loading && form ? (
        <>
          <div className={styles.voyageStrip}>
            <div className={styles.vsRow}>
              <div className={styles.vsItem}>
                <label>Voyage No.</label>
                <div className={styles.vsVal}>{form.voyage?.id || '—'}</div>
              </div>
              <div className={styles.vsItem}>
                <label>Vessel</label>
                <div className={styles.vsVal}>{form.voyage?.vessel || '—'}</div>
              </div>
              <div className={styles.vsItem}>
                <label>Port</label>
                <div className={styles.vsVal}>{form.voyage?.port || '—'}</div>
              </div>
              <div className={styles.vsItem}>
                <label>Agent</label>
                <div className={styles.vsVal}>
                  {form.agent?.contactPerson || form.agent?.organisation || '—'}
                </div>
              </div>
              <div className={styles.vsItem}>
                <label>Date</label>
                <TextInput
                  type="date"
                  value={form.header.date || ''}
                  disabled={readOnly}
                  onChange={(e) => updateHeader('date', e.target.value)}
                />
              </div>
            </div>
            <div className={`${styles.vsRow} ${styles.vsRow2}`}>
              <div className={styles.vsItem}>
                <label>Country</label>
                <div className={styles.vsVal}>{form.voyage?.country || '—'}</div>
              </div>
              <div className={styles.vsItem}>
                <label>Currency</label>
                <CardSelect
                  options={CURRENCY_OPTIONS.map((c) => ({ id: c, name: c }))}
                  value={form.header.localCurrency || 'USD'}
                  onChange={(next) => updateHeader('localCurrency', next)}
                  placeholder="Currency"
                  ariaLabel="Currency"
                  disabled={readOnly}
                  align="start"
                />
              </div>
              <div className={styles.vsItem}>
                <label>X-Rate to USD</label>
                <TextInput
                  type="number"
                  step="0.0001"
                  min="0"
                  value={toInputNumber(form.header.exchangeRate)}
                  disabled={readOnly}
                  onChange={(e) => onExchangeChange(e.target.value)}
                />
              </div>
              <div className={styles.vsItem}>
                <label>Show Values In</label>
                <div className={styles.segToggle}>
                  <button
                    type="button"
                    className={`${styles.segBtn} ${showLocal ? styles.segBtnActive : ''}`}
                    onClick={() => setDisplayMode('local')}
                  >
                    Local
                  </button>
                  <button
                    type="button"
                    className={`${styles.segBtn} ${!showLocal ? styles.segBtnActive : ''}`}
                    onClick={() => setDisplayMode('usd')}
                  >
                    USD
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.pcHintBanner}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-5M12 8h.01" />
            </svg>
            <div>
              Not sure what a line means? Tap the
              {' '}
              <b>i</b>
              {' '}
              next to its name for a plain-English explanation. Only enter a cost if it actually
              applies to this call — everything else can stay at 0.00.
              {isFda ? (
                <>
                  {' '}
                  On FDA, Estimated Cost is locked from Initial PDA — only Actual Cost is editable.
                </>
              ) : null}
            </div>
          </div>

          <div className={styles.pcSearchRow}>
            <div className={styles.searchBox}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={costSearch}
                onChange={(e) => setCostSearch(e.target.value)}
                placeholder="Find a cost line, e.g. 'pilotage' or 'agency fee'..."
                aria-label="Search cost lines"
              />
            </div>
            <div className={styles.filterSelectWrap}>
              <CardSelect
                options={[
                  { id: '', name: 'Filter by Section — All' },
                  ...COST_CATEGORIES.map((cat) => ({ id: cat.key, name: cat.title })),
                ]}
                value={categoryFilter}
                onChange={onCategoryFilterChange}
                placeholder="Filter by Section — All"
                ariaLabel="Filter by section"
                align="end"
              />
            </div>
          </div>

          <div className={styles.costCategories}>
            {grouped.length === 0 ? (
              <div className={styles.emptyCell}>No cost lines match this filter.</div>
            ) : (
              grouped.map((cat) => {
                const open = openCats.has(cat.key);
                const catEst = cat.lines.reduce((s, l) => s + parseMoney(showLocal ? l.estimatedLc : l.estimatedUsd), 0);
                const catAct = cat.lines.reduce((s, l) => s + parseMoney(showLocal ? l.actualLc : l.actualUsd), 0);
                return (
                  <details
                    key={cat.key}
                    className={`${styles.costCat} ${styles[`costCat_${cat.color}`] || ''}`}
                    open={open}
                    onToggle={(e) => {
                      const isOpen = e.currentTarget.open;
                      setOpenCats((prev) => {
                        const next = new Set(prev);
                        if (isOpen) next.add(cat.key);
                        else next.delete(cat.key);
                        return next;
                      });
                    }}
                  >
                    <summary className={styles.costCatSummary} onClick={(e) => {
                      e.preventDefault();
                      toggleCat(cat.key);
                    }}
                    >
                      <span className={styles.costCatTitle}>{cat.title}</span>
                      <span className={styles.costCatMeta}>
                        {cat.lines.length}
                        {' '}
                        lines · Est
                        {' '}
                        {fmtMoney(catEst)}
                        {' · '}
                        Act
                        {' '}
                        {fmtMoney(catAct)}
                      </span>
                    </summary>
                    <div className={styles.costCatBody}>
                      <div className={styles.tableWrap}>
                        <table className={styles.costGrid}>
                          <thead>
                            <tr>
                              <th style={{ width: '26%' }}>Cost Type</th>
                              <th style={{ width: '15%' }}>Estimated Cost</th>
                              <th style={{ width: '15%' }}>Actual Cost</th>
                              <th style={{ width: '22%' }}>Agent Remarks</th>
                              <th style={{ width: '22%' }}>Office Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cat.lines.map((line) => {
                              const idx = line._index;
                              const tip = line.description || line.name;
                              return (
                                <tr key={line.pcTypeId || idx}>
                                  <td>
                                    <span className={styles.costTypeCell}>
                                      {line.name}
                                      <InfoTip text={tip} />
                                    </span>
                                  </td>
                                  <td>
                                    <input
                                      className={styles.costInput}
                                      type="number"
                                      step="0.01"
                                      value={toInputNumber(primaryEst(line))}
                                      disabled={readOnly || isFda}
                                      title={isFda ? 'Estimated cost is locked from Initial PDA' : undefined}
                                      onChange={(e) => updateLine(
                                        idx,
                                        showLocal ? 'estimatedLc' : 'estimatedUsd',
                                        e.target.value,
                                      )}
                                    />
                                    <div className={styles.fxLine}>{fxEst(line)}</div>
                                  </td>
                                  <td>
                                    <input
                                      className={styles.costInput}
                                      type="number"
                                      step="0.01"
                                      value={toInputNumber(primaryAct(line))}
                                      disabled={readOnly || !isFda}
                                      title={!isFda ? 'Actual cost is entered on FDA' : undefined}
                                      onChange={(e) => updateLine(
                                        idx,
                                        showLocal ? 'actualLc' : 'actualUsd',
                                        e.target.value,
                                      )}
                                    />
                                    <div className={styles.fxLine}>{fxAct(line)}</div>
                                  </td>
                                  <td>
                                    <input
                                      className={styles.costInput}
                                      type="text"
                                      placeholder="Agent remarks"
                                      value={line.remarksAgent || ''}
                                      disabled={readOnly}
                                      onChange={(e) => updateLine(idx, 'remarksAgent', e.target.value)}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className={styles.costInput}
                                      type="text"
                                      value={line.remarksOperator || ''}
                                      disabled
                                      title="Office remarks are read-only for agents"
                                      placeholder="—"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                );
              })
            )}
          </div>

          <div className={styles.pcSummary}>
            <div className={`${styles.sumCard} ${styles.sumEst}`}>
              <div className={styles.sumLabel}>Total Estimated</div>
              <div className={styles.sumVal}>
                {fmtMoney(showLocal ? totals.estimatedLc : totals.estimatedUsd)}
              </div>
              <div className={styles.sumFx}>
                ≈
                {' '}
                {fmtMoney(showLocal ? totals.estimatedUsd : totals.estimatedLc)}
                {' '}
                {showLocal ? 'USD' : localCurrency}
              </div>
            </div>
            <div className={`${styles.sumCard} ${styles.sumAct}`}>
              <div className={styles.sumLabel}>Total Actual</div>
              <div className={styles.sumVal}>
                {fmtMoney(showLocal ? totals.actualLc : totals.actualUsd)}
              </div>
              <div className={styles.sumFx}>
                ≈
                {' '}
                {fmtMoney(showLocal ? totals.actualUsd : totals.actualLc)}
                {' '}
                {showLocal ? 'USD' : localCurrency}
              </div>
            </div>
            <div className={`${styles.sumCard} ${styles.sumVar}`}>
              <div className={styles.sumLabel}>Variance</div>
              <div className={styles.sumVal}>
                {fmtMoney(showLocal ? varianceLc : varianceUsd)}
              </div>
              <div className={styles.sumFx}>
                ≈
                {' '}
                {fmtMoney(showLocal ? varianceUsd : varianceLc)}
                {' '}
                {showLocal ? 'USD' : localCurrency}
              </div>
            </div>
          </div>

          <div className={styles.pcFooterCard}>
            <div className={styles.fGrid}>
              <label className={styles.fItem}>
                <span>Bank Details</span>
                <input
                  type="text"
                  value={form.header.bankDetails || ''}
                  disabled={readOnly}
                  placeholder="Beneficiary bank / account no."
                  onChange={(e) => updateHeader('bankDetails', e.target.value)}
                />
              </label>
              <label className={styles.fItem}>
                <span>Prepared By (Agent)</span>
                <input
                  type="text"
                  value={form.header.preparedBy || ''}
                  disabled={readOnly}
                  placeholder="Full name"
                  onChange={(e) => updateHeader('preparedBy', e.target.value)}
                />
              </label>
            </div>
          </div>

          {!readOnly ? (
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.btnOutlineLg}
                disabled={saving}
                onClick={() => persist('draft')}
              >
                Save Draft
              </button>
              <button
                type="button"
                className={styles.btnNavyLg}
                disabled={saving}
                onClick={() => persist('submit')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                Submit for Review
              </button>
            </div>
          ) : (
            <div className={styles.formNotice}>
              This
              {' '}
              {modeTitle}
              {' '}
              is locked.
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
