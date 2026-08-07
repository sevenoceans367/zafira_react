import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LoadingOverlay,
  Select,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import {
  fetchFinalisedVoyageFixturesTc,
  fetchOpsTcOperators,
  finaliseVoyageFixturesTc,
} from '../../../services/opsTc.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import OpsTcFinalisedFixturesHeaderActions from './OpsTcFinalisedFixturesHeaderActions.jsx';
import styles from './OpsPages.module.css';

const PAGE_SIZE = 50;
const FLASH = {
  1: { type: 'success', text: 'Fixtures Finalised successfully.' },
};

export default function OpsTcFinalisedFixturesPage() {
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [operators, setOperators] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [operatorById, setOperatorById] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flash = FLASH[Number(searchParams.get('msg'))];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [operatorOptions, data] = await Promise.all([
        fetchOpsTcOperators(),
        fetchFinalisedVoyageFixturesTc({
          search: debouncedSearch,
          page,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setOperators(operatorOptions);
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
      setSelectedIds([]);
      setOperatorById((prev) => {
        const next = { ...prev };
        (data.records || []).forEach((row) => {
          if (row.operatorId && next[String(row.tcOutId)] == null) {
            next[String(row.tcOutId)] = String(row.operatorId);
          }
        });
        return next;
      });
    } catch (err) {
      setError(err.message || 'Failed to load Finalised Voyage Fixtures TC.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const finalisableIds = useMemo(
    () => rows.filter((row) => row.canFinalise).map((row) => String(row.tcOutId)),
    [rows],
  );
  const allSelected = finalisableIds.length > 0
    && finalisableIds.every((id) => selectedIds.includes(id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : finalisableIds);
  };

  const toggleOne = (row) => {
    if (!row.canFinalise) return;
    const id = String(row.tcOutId);
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    ));
  };

  const handleFinalise = async () => {
    if (!selectedIds.length) {
      setError('Please select at least one Fixture');
      return;
    }

    const fixtures = selectedIds.map((id) => {
      const row = rows.find((item) => String(item.tcOutId) === id);
      return {
        tcOutId: row?.tcOutId,
        comId: row?.comId,
        operatorId: operatorById[id] || row?.operatorId || '',
      };
    });

    if (fixtures.some((item) => !item.operatorId)) {
      setError('Please select an Operator for each selected fixture.');
      return;
    }

    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure to finalise this Fixture ?',
      confirmLabel: 'Finalise',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      await finaliseVoyageFixturesTc(fixtures);
      const next = new URLSearchParams(searchParams);
      next.set('msg', '1');
      setSearchParams(next, { replace: true });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to finalise fixtures.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <OpsTcFinalisedFixturesHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        onFinalise={handleFinalise}
        finaliseDisabled={saving || loading}
      />

      <div className={`zafira-page ${styles.page}`}>
      <LoadingOverlay show={loading || saving} fullScreen={false} label={saving ? 'Finalising…' : 'Loading Finalised TC Fixtures…'} />
      {flash ? <div className={styles.flashSuccess}>{flash.text}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>Finalised TC Fixtures List</h3>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Vessel</th>
              <th>Vessel Type</th>
              <th>TC No.</th>
              <th>CP Date</th>
              <th>DWT</th>
              <th>Del Port</th>
              <th>Re Del Port</th>
              <th>TC Days</th>
              <th>Daily Gross Hire(USD)</th>
              <th>Total Rev(USD)</th>
              <th>
                Status
                {finalisableIds.length ? (
                  <>
                    {' '}
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all fixtures"
                      title="Select all"
                    />
                  </>
                ) : null}
              </th>
              <th>Operator</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={14} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => {
              const id = String(row.tcOutId);
              const selected = selectedIds.includes(id);
              return (
                <tr key={id}>
                  <td>{row.index}.</td>
                  <td>{row.vesselName || '—'}</td>
                  <td>{row.vesselType || '—'}</td>
                  <td>{row.tcNo || '—'}</td>
                  <td>{row.cpDate || '—'}</td>
                  <td>{row.dwt || '—'}</td>
                  <td>{row.delPort || '—'}</td>
                  <td>{row.reDelPort || '—'}</td>
                  <td>{row.tcDays || '—'}</td>
                  <td>{row.dailyGrossHire || '—'}</td>
                  <td>{row.totalRev || '—'}</td>
                  <td>
                    {row.fixed ? (
                      <strong>{row.statusLabel}</strong>
                    ) : (
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleOne(row)}
                        aria-label={`Select ${row.tcNo || id}`}
                      />
                    )}
                  </td>
                  <td>
                    {row.fixed ? (
                      <strong>{row.operatorName || '—'}</strong>
                    ) : (
                      <Select
                        value={operatorById[id] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setOperatorById((prev) => ({ ...prev, [id]: value }));
                        }}
                        aria-label={`Operator for ${row.tcNo || id}`}
                      >
                        <option value="">Select</option>
                        {operators.map((op) => (
                          <option key={op.id} value={op.id}>{op.name}</option>
                        ))}
                      </Select>
                    )}
                  </td>
                  <td>
                    <Link
                      to={appPath(`/internal-user/vc/tc/${encodeURIComponent(row.tcOutId)}/calculate?mode=view&from=ops-tc`)}
                      title="View Details"
                      aria-label={`View ${row.tcNo || id}`}
                    >
                      <i className="bi bi-file-earmark-text" aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SopfPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
    </>
  );
}
