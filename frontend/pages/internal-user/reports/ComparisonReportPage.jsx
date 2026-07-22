import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  FilterBar,
  FilterField,
  LoadingOverlay,
} from '@bainbridge/shared-ui';
import { getReportDefinition } from '../../../constants/reportsDefinitions.js';
import {
  fetchComparisonSheets,
  fetchReport,
  fetchReportFilterOptions,
} from '../../../services/reports.js';
import ReportCardSelect from './ReportCardSelect.jsx';
import ReportsHeaderActions from './ReportsHeaderActions.jsx';
import {
  downloadReportExcel,
  downloadReportPdf,
  filterReportRows,
} from './reportExports.js';
import styles from './ReportPages.module.css';

export default function ComparisonReportPage({ reportId: reportIdProp }) {
  const { reportId: reportIdParam } = useParams();
  const reportId = reportIdProp || reportIdParam || 'comparison-report';
  const definition = getReportDefinition(reportId);

  const [options, setOptions] = useState({ years: [] });
  const [filters, setFilters] = useState({
    selYear: String(new Date().getFullYear()),
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [sheetData, setSheetData] = useState(null);
  const [search, setSearch] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const columns = useMemo(() => definition?.columns || [], [definition]);
  const filteredRows = useMemo(
    () => filterReportRows(rows, columns, search),
    [rows, columns, search],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetchReportFilterOptions();
        if (!cancelled) setOptions(meta);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load filters.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const runSearch = useCallback(async () => {
    if (!filters.selYear) {
      setError(definition?.requiredMessage || 'Please select Year.');
      setRows([]);
      setSearched(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchReport(reportId, filters);
      setRows(data.records || []);
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Failed to load report.');
      setRows([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [definition, filters, reportId]);

  const openCompare = async (comId) => {
    setModalOpen(true);
    setModalLoading(true);
    setSheetData(null);
    try {
      const data = await fetchComparisonSheets(comId);
      setSheetData(data);
    } catch (err) {
      setError(err.message || 'Failed to load compare sheets.');
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const handleExcel = () => {
    downloadReportExcel(reportId, columns, filteredRows);
  };

  const handlePdf = async () => {
    setPdfLoading(true);
    setError('');
    try {
      await downloadReportPdf({
        title: definition?.title || reportId,
        filename: reportId,
        columns,
        rows: filteredRows,
      });
    } catch (err) {
      setError(err.message || 'Failed to generate PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (!definition) {
    return <div className={`zafira-page ${styles.page}`}><div className={styles.empty}>Unknown report.</div></div>;
  }

  return (
    <>
      <ReportsHeaderActions
        search={search}
        onSearchChange={setSearch}
        onExcel={handleExcel}
        onPdf={handlePdf}
        excelDisabled={!filteredRows.length}
        pdfDisabled={!filteredRows.length}
        pdfLoading={pdfLoading}
      />
      <div className={`zafira-page ${styles.page}`}>
      {loading ? <LoadingOverlay active label={`Loading ${definition.title}…`} /> : null}
      <h2 className={styles.title}>{definition.title}</h2>

      <FilterBar
        actions={(
          <Button type="button" variant="primary" label="Search" onClick={runSearch} disabled={loading} />
        )}
      >
        <FilterField label="Year">
          <ReportCardSelect
            label="Year"
            value={filters.selYear}
            options={options.years || []}
            includeEmpty={false}
            placeholder="Year"
            onChange={(value) => setFilters((prev) => ({ ...prev, selYear: value }))}
          />
        </FilterField>
      </FilterBar>

      {error ? <div className={styles.error}>{error}</div> : null}
      {searched && !loading && !rows.length && !error ? (
        <div className={styles.empty}>No records found for the selected filters.</div>
      ) : null}
      {searched && rows.length && !filteredRows.length && !error ? (
        <div className={styles.empty}>No records match the search.</div>
      ) : null}

      {filteredRows.length ? (
        <div className={`zafira-card ${styles.tableWrap}`}>
          <table className="zafira-data-table">
            <thead>
              <tr>
                {columns.map((col) => <th key={col.key}>{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.comId || row.id}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.action === 'compareSheets' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          label="Compare Sheets"
                          onClick={() => openCompare(row.comId || row.id)}
                        />
                      ) : (
                        row[col.key] == null || row[col.key] === '' ? '—' : String(row[col.key])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {modalOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setModalOpen(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Compare Sheets"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>Compare Sheets</h3>
              <Button type="button" variant="close" label="Close" onClick={() => setModalOpen(false)} />
            </div>
            {modalLoading ? <div className={styles.empty}>Loading sheets…</div> : null}
            {sheetData ? (
              <div className={styles.modalBody}>
                <h4>Main Particulars</h4>
                <div className={styles.particularsGrid}>
                  {Object.entries({
                    'Vessel Name': sheetData.particulars.vesselName,
                    'Vessel Type': sheetData.particulars.vesselType,
                    Flag: sheetData.particulars.flag,
                    'Fixture Date': sheetData.particulars.fixtureDate,
                    'Voyage No.': sheetData.particulars.voyageNo,
                    'Voyage Financials Name': sheetData.particulars.voyageName,
                    'DWT (Summer)': sheetData.particulars.dwtSummer,
                    'DWT (Tropical)': sheetData.particulars.dwtTropical,
                  }).map(([label, value]) => (
                    <div key={label}>
                      <div className={styles.fieldLabel}>{label}</div>
                      <div>{value || '—'}</div>
                    </div>
                  ))}
                </div>
                <div className={styles.tableWrap}>
                  <table className="zafira-data-table">
                    <thead>
                      <tr>
                        <th>Sheet Name/Parameters</th>
                        {(sheetData.sheetColumns || []).map((col) => (
                          <th key={col.fcaId}>{col.label}</th>
                        ))}
                        <th>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sheetData.rows || []).map((row) => (
                        <tr key={row.parameter}>
                          <td>{row.parameter}</td>
                          {(row.values || []).map((value, index) => (
                            <td key={`${row.parameter}-${index}`}>
                              {value === '' || value == null ? '—' : String(value)}
                            </td>
                          ))}
                          <td className={Number(row.difference) < 0 ? styles.diffNeg : styles.diffPos}>
                            {row.difference || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
}
