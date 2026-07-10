import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import { getLegacyDryoutHref } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import {
  fetchTodoList,
  holdTodoPayment,
  inactiveTodoAlert,
  unholdTodoPayment,
  updateTodoAlRem,
} from '../../../services/todoList.js';
import styles from './ToDoListPage.module.css';

const TABS = [
  { id: 'hold', label: 'Payment Hold' },
  { id: 'payable', label: 'Payment Payable' },
];

const ACCOUNT_TYPES = [
  { value: '', label: '---Select Account Type---' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Dubai', label: 'Dubai' },
];

function statusClass(tone) {
  if (tone === 'danger') return styles.statusDanger;
  if (tone === 'warning') return styles.statusWarning;
  return styles.statusInfo;
}

function LegacyLink({ href, children }) {
  if (!href) return '—';
  return (
    <a className={styles.link} href={getLegacyDryoutHref(href)} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export default function ToDoListPage() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('hold');
  const [accountType, setAccountType] = useState('');
  const [appliedAccountType, setAppliedAccountType] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState([]);
  const [paymentUnlock, setPaymentUnlock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alRemDrafts, setAlRemDrafts] = useState({});
  const alRemTimers = useRef({});

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTodoList({
        tab: activeTab,
        accountType: appliedAccountType,
        search: debouncedSearch,
      });
      setRows(data.records ?? []);
      setPaymentUnlock(Boolean(data.paymentUnlock));
      const drafts = {};
      for (const row of data.records ?? []) {
        drafts[row.alertId] = row.alRem ?? '';
      }
      setAlRemDrafts(drafts);
    } catch (err) {
      setError(err.message || 'Failed to load to-do list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, appliedAccountType, debouncedSearch]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => () => {
    Object.values(alRemTimers.current).forEach(clearTimeout);
  }, []);

  const handleLoad = () => {
    setAppliedAccountType(accountType);
  };

  const handleInactive = async (row) => {
    const ok = await confirm({
      title: 'Are you sure?',
      message: "You won't be able to revert this!",
      confirmLabel: 'Yes, Inactive it!',
      cancelLabel: 'Cancel',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    try {
      await inactiveTodoAlert(row.alertId);
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to inactive alert.');
    }
  };

  const handleHold = async (row) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to hold this payment?',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
      confirmVariant: 'accent',
    });
    if (!ok) return;
    try {
      await holdTodoPayment({ identify: row.identify, identifyId: row.identifyId });
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to hold payment.');
    }
  };

  const handleUnhold = async (row) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to unhold this payment?',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
      confirmVariant: 'accent',
    });
    if (!ok) return;
    try {
      await unholdTodoPayment({ identify: row.identify, identifyId: row.identifyId });
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to unhold payment.');
    }
  };

  const handleAlRemChange = (row, value) => {
    setAlRemDrafts((prev) => ({ ...prev, [row.alertId]: value }));
    const key = row.alertId;
    if (alRemTimers.current[key]) clearTimeout(alRemTimers.current[key]);
    alRemTimers.current[key] = setTimeout(async () => {
      try {
        await updateTodoAlRem({
          identify: row.identify,
          identifyId: row.identifyId,
          value,
        });
      } catch (err) {
        setError(err.message || 'Failed to update accruals.');
      }
    }, 500);
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      <h2 className={styles.title}>To - Do List</h2>

      {loading ? <LoadingOverlay active label="Loading to-do list…" /> : null}

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.tabs} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.filters}>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Account Type</span>
          <select
            className={styles.select}
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
          >
            {ACCOUNT_TYPES.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="primary" label="Load" onClick={handleLoad} />
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Search</span>
          <input
            className={styles.searchInput}
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search vessel, voyage, vendor…"
          />
        </label>
      </div>

      <div className={styles.tableWrap}>
        <table className={`zafira-data-table ${styles.table}`}>
          <thead>
            <tr>
              <th>#</th>
              <th>Vessel</th>
              <th>Voyage No</th>
              <th>Form Name</th>
              <th>Invoice/Advice No./SOA No.</th>
              <th>Type</th>
              <th>Hold by</th>
              <th>Vendor Name</th>
              <th>Status</th>
              <th>Date</th>
              <th>Documents</th>
              <th>Edit Link</th>
              {paymentUnlock ? (
                <>
                  <th>Accruals</th>
                  <th>{activeTab === 'hold' ? 'Payment Unhold' : 'Payment Hold'}</th>
                </>
              ) : null}
              <th>Inactive</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td
                  className={styles.emptyCell}
                  colSpan={paymentUnlock ? 15 : 13}
                >
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.alertId}>
                <td>{row.index}</td>
                <td>{row.vessel || '—'}</td>
                <td>{row.voyageNo || '—'}</td>
                <td>{row.formName || '—'}</td>
                <td>{row.invoiceNo || '—'}</td>
                <td>{row.payType || '—'}</td>
                <td>{row.holdBy || '—'}</td>
                <td>{row.vendor || '—'}</td>
                <td>
                  <span className={statusClass(row.statusTone)}>{row.statusLabel}</span>
                </td>
                <td>{row.date || '—'}</td>
                <td>
                  <LegacyLink href={row.docsHref}>Documents</LegacyLink>
                </td>
                <td>
                  <LegacyLink href={row.editHref}>Edit</LegacyLink>
                </td>
                {paymentUnlock ? (
                  <>
                    <td>
                      <input
                        className={styles.alRemInput}
                        type="text"
                        value={alRemDrafts[row.alertId] ?? ''}
                        onChange={(e) => handleAlRemChange(row, e.target.value)}
                      />
                    </td>
                    <td>
                      {activeTab === 'hold' && row.canUnhold ? (
                        <Button
                          type="button"
                          variant="accent"
                          size="sm"
                          label="Unhold"
                          onClick={() => handleUnhold(row)}
                        />
                      ) : null}
                      {activeTab === 'payable' && row.canHold ? (
                        <Button
                          type="button"
                          variant="accent"
                          size="sm"
                          label="Hold"
                          onClick={() => handleHold(row)}
                        />
                      ) : null}
                    </td>
                  </>
                ) : null}
                <td>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    label="Inactive"
                    onClick={() => handleInactive(row)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
