import React, { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  DmyDateInput,
  FilterBar,
  FilterField,
  LoadingOverlay,
} from '@bainbridge/shared-ui';
import { getReportDefinition } from '../../../constants/reportsDefinitions.js';
import { fetchReport } from '../../../services/reports.js';
import ReportsHeaderActions from './ReportsHeaderActions.jsx';
import {
  downloadReportExcel,
  downloadReportPdf,
  filterReportRows,
} from './reportExports.js';
import styles from './ReportPages.module.css';

export default function CargoTonnageReportPage({ reportId: reportIdProp }) {
  const { reportId: reportIdParam } = useParams();
  const reportId = reportIdProp || reportIdParam || 'cargo-tonnage-report';
  const definition = getReportDefinition(reportId);

  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });
  const [rows, setRows] = useState([]);
  const [chart, setChart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [search, setSearch] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const columns = useMemo(() => definition?.columns || [], [definition]);
  const filteredRows = useMemo(
    () => filterReportRows(rows, columns, search),
    [rows, columns, search],
  );

  const runSearch = useCallback(async () => {
    if (!filters.dateFrom || !filters.dateTo) {
      setError(definition?.requiredMessage || 'Please select Date From and Date To.');
      setRows([]);
      setChart([]);
      setSearched(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchReport(reportId, filters);
      setRows(data.records || []);
      setChart(data.chart || []);
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Failed to load report.');
      setRows([]);
      setChart([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [definition, filters, reportId]);

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

  const maxValue = Math.max(...chart.map((item) => Number(item.value) || 0), 1);

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
          <FilterField label="Date From (CP From)">
            <DmyDateInput
              value={filters.dateFrom}
              onChange={(value) => setFilters((prev) => ({ ...prev, dateFrom: value }))}
            />
          </FilterField>
          <FilterField label="Date To (CP Date To)">
            <DmyDateInput
              value={filters.dateTo}
              onChange={(value) => setFilters((prev) => ({ ...prev, dateTo: value }))}
            />
          </FilterField>
        </FilterBar>

        {error ? <div className={styles.error}>{error}</div> : null}

        {searched && chart.length ? (
          <div className={`zafira-card ${styles.chartCard}`}>
            <div className={styles.chartBars}>
              {chart.map((item) => (
                <div key={item.label} className={styles.chartCol}>
                  <div className={styles.chartValue}>{item.value}</div>
                  <div
                    className={styles.chartBar}
                    style={{ height: `${Math.max(8, (Number(item.value) / maxValue) * 180)}px` }}
                    title={`${item.label}: ${item.value} (MT/1000)`}
                  />
                  <div className={styles.chartLabel}>{item.label}</div>
                </div>
              ))}
            </div>
            <p className={styles.hint}>Cargo Quantity (MT / 1000)</p>
          </div>
        ) : null}

        {searched ? <h3 className={styles.sectionTitle}>Report Summary</h3> : null}

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
                  <tr key={row.id || row.cargoName}>
                    {columns.map((col) => (
                      <td key={col.key}>
                        {row[col.key] == null || row[col.key] === '' ? '—' : String(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}
