import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay, useAlert } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { useFleetModule } from '../../../hooks/useFleetModule.js';
import { fetchFleetCompare, downloadFleetComparePdf, fetchFleetList } from '../../../services/fleet.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import { CompareIcon } from '../ops/OpsVcGlanceUi.jsx';
import SopfPagination from '../sopf/SopfPagination.jsx';
import FleetHeaderActions from './FleetHeaderActions.jsx';
import styles from './FleetPage.module.css';

const PAGE_SIZE = 10;

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Fleet added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Fleet.' },
};

function liveValue(value) {
  if (value == null) return '—';
  const text = String(value).trim();
  return text === '' ? '—' : text;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3h9l5 5v13H6z" />
      <path d="M15 3v5h5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function FleetCompareModal({ open, loading, data, vesselIds, onClose }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const vessels = data?.vessels ?? [];
  const sections = data?.sections ?? [];

  const handlePdf = async () => {
    setPdfLoading(true);
    setPdfError('');
    try {
      await downloadFleetComparePdf(vesselIds);
    } catch (err) {
      setPdfError(err.message || 'Failed to generate PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (!open) return null;

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
          <h4 id="fleet-compare-title">Compare Vessels</h4>
          <div className={styles.modalHeaderActions}>
            <button
              type="button"
              className={styles.btnPdf}
              onClick={handlePdf}
              disabled={loading || pdfLoading || !vessels.length}
            >
              {pdfLoading ? 'Generating PDF…' : 'Generate PDF'}
            </button>
            <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className={styles.modalBody}>
          {loading ? <LoadingOverlay show label="Loading comparison…" /> : null}
          {pdfError ? <div className={styles.error}>{pdfError}</div> : null}
          {!loading && vessels.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.grid}>
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

export default function FleetPage() {
  const navigate = useNavigate();
  const { fleetPath, vesselPath } = useFleetModule();
  const alert = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
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
  const compareEnabled = selectedIds.length > 0;

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
    const id = String(vesselImoId);
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  };

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(String(row.vesselImoId)));

  const toggleAll = () => {
    if (allSelected) {
      const pageIds = new Set(rows.map((row) => String(row.vesselImoId)));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      rows.forEach((row) => next.add(String(row.vesselImoId)));
      return [...next];
    });
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

      {loading ? <LoadingOverlay show label="Loading fleet…" /> : null}

      {flash ? (
        <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError} role="alert">
          <strong>{flash.type === 'success' ? 'Success!' : 'Error!'}</strong> {flash.text}
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.btnAdd}
          onClick={() => navigate(`${fleetPath}/add?selBType=${encodeURIComponent(businessType)}`)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add
        </button>
        <button
          type="button"
          className={`${styles.btnCompare} ${compareEnabled ? styles.btnCompareEnabled : ''}`}
          disabled={!compareEnabled}
          title={compareEnabled ? 'Compare selected vessels' : 'Select a row to enable'}
          onClick={handleCompare}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19V5" />
            <path d="M8 19v-7" />
            <path d="M12 19V9" />
            <path d="M16 19v-4" />
            <path d="M20 19V6" />
          </svg>
          Compare Vessels
        </button>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>#</th>
                <th>Vessel</th>
                <th>Business Type</th>
                <th>IMO No.</th>
                <th>Summer DWT</th>
                <th>Built</th>
                <th>Primary</th>
                <th>Particulars</th>
                <th>Commercial</th>
                <th className={styles.compareHeader} title="Compare">
                  <CompareIcon />
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={!rows.length}
                    aria-label="Select all to compare"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.empty}>
                    {loading ? 'Loading vessels…' : 'No operated vessels for the selected business type.'}
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.vesselImoId}>
                  <td className={styles.cellItem}>{row.index}.</td>
                  <td className={styles.cellVessel}>
                    <span>{liveValue(row.vesselName)}</span>
                    <span className={styles.vesselType}>{liveValue(row.vesselType)}</span>
                  </td>
                  <td>{liveValue(row.businessType)}</td>
                  <td className={styles.cellNum}>{liveValue(row.imoNo)}</td>
                  <td className={styles.cellNum}>{liveValue(row.dwt)}</td>
                  <td className={styles.cellNum}>{liveValue(row.yearBuilt)}</td>
                  <td>
                    <div className={styles.iconPair}>
                      <Link
                        to={vesselPath(row.vesselImoId, 'primary')}
                        className={styles.iconBtn}
                        title="Edit Details"
                      >
                        <PencilIcon />
                      </Link>
                    </div>
                  </td>
                  <td>
                    <div className={styles.iconPair}>
                      <Link
                        to={particularsViewPath(row)}
                        className={styles.iconBtn}
                        title="View Vessel Particulars"
                      >
                        <EyeIcon />
                      </Link>
                      <Link
                        to={particularsEditPath(row)}
                        className={styles.iconBtn}
                        title="Edit Vessel Particulars"
                      >
                        <PencilIcon />
                      </Link>
                    </div>
                  </td>
                  <td>
                    <div className={styles.iconPair}>
                      <Link
                        to={vesselPath(row.vesselImoId, 'commercial')}
                        className={styles.iconBtn}
                        title="Commercial Parameters"
                      >
                        <DocIcon />
                      </Link>
                    </div>
                  </td>
                  <td className={styles.center}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(row.vesselImoId))}
                      onChange={() => toggleSelected(row.vesselImoId)}
                      aria-label={`Select ${row.vesselName} to compare`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.tableFooter}>
          <SopfPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </div>
      </div>

      <FleetCompareModal
        open={compareOpen}
        loading={compareLoading}
        data={compareData}
        vesselIds={selectedIds}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
}
