import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { usePeriodContractModule } from '../../../hooks/usePeriodContractModule.js';
import { periodContractAddPath, periodContractEditPath } from '../../../constants/periodContractPageHeaders.js';
import { fetchPeriodContractList } from '../../../services/periodContracts.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import PeriodContractHeaderActions from './PeriodContractHeaderActions.jsx';
import styles from './PeriodContractListPage.module.css';

const PAGE_SIZE = 10;

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Period Contract added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Period Contract.' },
  2: { type: 'success', text: 'Congratulations! Period Contract delete successfully.' },
};

const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
];

function MultilineCell({ value }) {
  if (!value) return '—';
  return <span className={styles.multiline}>{value}</span>;
}

function StatusBadge({ status }) {
  const isOpen = String(status).toLowerCase().includes('open');
  return (
    <span className={isOpen ? styles.statusOpen : styles.statusClosed}>
      {status}
    </span>
  );
}

export default function PeriodContractListPage() {
  const navigate = useNavigate();
  const { module } = usePeriodContractModule();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('open');
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flashMsg = searchParams.get('msg');
  const flash = flashMsg != null ? FLASH_MESSAGES[Number(flashMsg)] : null;

  const loadBusinessTypes = useCallback(async (selectedId) => {
    const types = await fetchVcBusinessTypes(selectedId);
    setBusinessTypes(types);
  }, []);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPeriodContractList({
        selBType: businessType,
        status: activeTab,
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
      });
      setRows(data.records ?? []);
      setTotal(data.recordsTotal ?? 0);
    } catch (err) {
      setError(err.message || 'Failed to load period contract list.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, businessType, debouncedSearch, page]);

  useEffect(() => {
    loadBusinessTypes(businessType);
  }, [businessType, loadBusinessTypes]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, businessType, activeTab]);

  const handleBusinessTypeChange = (value) => {
    setBusinessType(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('selBType', value);
    else next.delete('selBType');
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      <PeriodContractHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={handleBusinessTypeChange}
      />

      {loading ? <LoadingOverlay active label="Loading period contracts…" /> : null}

      {flash ? (
        <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
          {flash.text}
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>Period Contract List</h3>

      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarActions}>
          <Button
            variant="add"
            label="Add New"
            onClick={() => navigate(periodContractAddPath(module))}
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Contract ID</th>
              <th>Contract No.</th>
              <th>Contract Date</th>
              <th>Vessel Name</th>
              <th>Vessel Type</th>
              <th>Dead weight</th>
              <th>Initial hire</th>
              <th>Own Business Account</th>
              <th>Re-Del Date (Min)</th>
              <th>Re-Del Date (Max)</th>
              <th>Total / Performed / Balance Days</th>
              <th>Remarks</th>
              <th>Bunker Opening Balance</th>
              <th>Bunker Closing Balance</th>
              <th>Status</th>
              <th>Nominate</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={18} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.periodId}>
                <td>{row.index}</td>
                <td>{row.contractId}</td>
                <td>{row.contractNo}</td>
                <td>{row.contractDate}</td>
                <td>{row.vesselName}</td>
                <td>{row.vesselType}</td>
                <td>{row.dwt}</td>
                <td>{row.initialHire}</td>
                <td>{row.ownBusinessAccount}</td>
                <td>{row.reDelMinDate}</td>
                <td>{row.reDelMaxDate}</td>
                <td>{`${row.totalDays} / ${row.performedDays} / ${row.balanceDays}`}</td>
                <td><MultilineCell value={row.remarks} /></td>
                <td><MultilineCell value={row.bunkerOpening} /></td>
                <td><MultilineCell value={row.bunkerClosing} /></td>
                <td><StatusBadge status={row.status} /></td>
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className={styles.actionIcon}
                    title={activeTab === 'open' ? 'Nominate' : 'View Voyage'}
                    disabled
                    aria-label={activeTab === 'open' ? 'Nominate' : 'View Voyage'}
                  >
                    <i className={`bi ${activeTab === 'open' ? 'bi-send' : 'bi-eye'}`} aria-hidden />
                  </button>
                </td>
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className={styles.actionIcon}
                    title="Edit Details"
                    aria-label="Edit Details"
                    onClick={() => navigate(periodContractEditPath(module, row.periodId))}
                  >
                    <i className="bi bi-pencil-square" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SopfPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
}
