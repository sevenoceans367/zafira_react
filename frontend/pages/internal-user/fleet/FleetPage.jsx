import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, useAlert } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { useFleetModule } from '../../../hooks/useFleetModule.js';
import { fetchFleetCompare, fetchFleetList } from '../../../services/fleet.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import FleetHeaderActions from './FleetHeaderActions.jsx';
import styles from './FleetPage.module.css';

const PAGE_SIZE = 10;

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Fleet added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Fleet.' },
};

function FleetCompareModal({ open, loading, data, onClose }) {
  if (!open) return null;

  const vessels = data?.vessels ?? [];
  const sections = data?.sections ?? [];

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fleet-compare-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h4 id="fleet-compare-title">
            <i className="bi bi-file-text" aria-hidden /> Compare Vessels
          </h4>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          {loading ? <LoadingOverlay active label="Loading comparison…" /> : null}
          {!loading && vessels.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Vessel Name / Commercial Parameters</th>
                    {vessels.map((vessel) => (
                      <th key={vessel.id}>{vessel.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sections.flatMap((section) => {
                    const sectionRows = [];
                    if (section.title) {
                      sectionRows.push(
                        <tr key={`section-${section.title}`} className={styles.sectionRow}>
                          <td colSpan={vessels.length + 1}>{section.title}</td>
                        </tr>,
                      );
                    }
                    section.rows?.forEach((row) => {
                      sectionRows.push(
                        <tr key={`${section.title || 'base'}-${row.label}`}>
                          <td>{row.label}</td>
                          {row.values.map((value, index) => (
                            <td key={`${row.label}-${index}`}>{value || '—'}</td>
                          ))}
                        </tr>,
                      );
                    });
                    return sectionRows;
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ActionIcon({ icon, title, to }) {
  if (to) {
    return (
      <Link to={to} className={styles.actionIcon} title={title} aria-label={title}>
        <i className={`bi ${icon}`} aria-hidden />
      </Link>
    );
  }
  return (
    <button type="button" className={styles.actionIcon} title={title} aria-label={title} disabled>
      <i className={`bi ${icon}`} aria-hidden />
    </button>
  );
}

export default function FleetPage() {
  const { fleetPath, vesselPath } = useFleetModule();
  const alert = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '3');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareData, setCompareData] = useState(null);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flashMsg = searchParams.get('msg');
  const flash = flashMsg != null ? FLASH_MESSAGES[Number(flashMsg)] : null;

  const loadBusinessTypes = useCallback(async (selectedId) => {
    const types = await fetchVcBusinessTypes(selectedId);
    setBusinessTypes(types);
  }, []);

  const loadFleet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchFleetList({
        selBType: businessType,
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
      });
      setRows(data.records ?? []);
      setTotal(data.recordsTotal ?? 0);
      setSelectedIds([]);
    } catch (err) {
      setError(err.message || 'Failed to load fleet list.');
    } finally {
      setLoading(false);
    }
  }, [businessType, page, debouncedSearch]);

  useEffect(() => {
    loadBusinessTypes(businessType);
  }, [businessType, loadBusinessTypes]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, businessType]);

  const handleBusinessTypeChange = (value) => {
    setBusinessType(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('selBType', value);
    else next.delete('selBType');
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  const toggleSelected = (vesselImoId) => {
    setSelectedIds((current) => (
      current.includes(vesselImoId)
        ? current.filter((id) => id !== vesselImoId)
        : [...current, vesselImoId]
    ));
  };

  const handleCompare = async () => {
    if (!selectedIds.length) {
      await alert({
        title: 'Alert',
        message: 'Please select at least one checkbox',
        confirmLabel: 'OK',
      });
      return;
    }

    setCompareOpen(true);
    setCompareLoading(true);
    setCompareData(null);
    try {
      const data = await fetchFleetCompare(selectedIds);
      setCompareData(data);
    } catch (err) {
      setError(err.message || 'Failed to compare vessels.');
      setCompareOpen(false);
    } finally {
      setCompareLoading(false);
    }
  };

  const particularsViewPath = (row) => vesselPath(row.vesselImoId, 'particulars');

  const particularsEditPath = (row) => (
    Number(row.businessTypeId) === 3
      ? vesselPath(row.vesselImoId, 'particulars/edit')
      : vesselPath(row.vesselImoId, 'particulars-tanker/edit')
  );

  return (
    <div className={`zafira-page ${styles.page}`}>
      <FleetHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={handleBusinessTypeChange}
      />

      {loading ? <LoadingOverlay active label="Loading fleet…" /> : null}

      {flash ? (
        <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
          {flash.text}
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.toolbar}>
        <div className={styles.toolbarActions}>
          <Button variant="outline" label="Compare Vessels" onClick={handleCompare} />
          <Button
            variant="add"
            label="Add"
            to={`${fleetPath}/add?selBType=${encodeURIComponent(businessType)}`}
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>
                Vessel
                <span className={styles.headerLine2}>Type</span>
              </th>
              <th>Vessel</th>
              <th>
                Business
                <span className={styles.headerLine2}>Type</span>
              </th>
              <th>
                IMO
                <span className={styles.headerLine2}>No.</span>
              </th>
              <th>
                Summer
                <span className={styles.headerLine2}>DWT(MT)</span>
              </th>
              <th>Built</th>
              <th>
                Primary
                <span className={styles.headerLine2}>Details</span>
              </th>
              <th>
                Vessel
                <span className={styles.headerLine2}>Particulars</span>
              </th>
              <th>
                Commercial
                <span className={styles.headerLine2}>Parameters</span>
              </th>
              <th>
                Select to
                <span className={styles.headerLine2}>Compare</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.vesselImoId}>
                <td>{row.index}</td>
                <td>{row.vesselType}</td>
                <td>{row.vesselName}</td>
                <td>{row.businessType}</td>
                <td>{row.imoNo}</td>
                <td>{row.dwt}</td>
                <td>{row.yearBuilt}</td>
                <td className={styles.actionCell}>
                  <ActionIcon
                    icon="bi-pencil"
                    title="Edit Details"
                    to={vesselPath(row.vesselImoId, 'primary')}
                  />
                </td>
                <td className={styles.actionCell}>
                  <ActionIcon
                    icon="bi-file-text"
                    title="View Vessel Particulars"
                    to={particularsViewPath(row)}
                  />
                  <span className={styles.actionDivider}>|</span>
                  <ActionIcon
                    icon="bi-pencil-square"
                    title="Edit Vessel Particulars"
                    to={particularsEditPath(row)}
                  />
                </td>
                <td className={styles.actionCell}>
                  <ActionIcon
                    icon="bi-pencil-square"
                    title="Commercial Parameters"
                    to={vesselPath(row.vesselImoId, 'commercial')}
                  />
                </td>
                <td className={styles.actionCell}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.vesselImoId)}
                    onChange={() => toggleSelected(row.vesselImoId)}
                    aria-label={`Select ${row.vesselName} to compare`}
                  />
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

      <FleetCompareModal
        open={compareOpen}
        loading={compareLoading}
        data={compareData}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
}
