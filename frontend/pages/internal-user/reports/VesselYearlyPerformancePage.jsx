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

const SERIES_COLORS = [
  '#5b8def',
  '#6fbf8b',
  '#e6a23c',
  '#9b7bdb',
  '#4db6c0',
  '#ef7b6c',
  '#8a9ba8',
  '#c9a227',
  '#3d8bfd',
  '#7a9e4a',
];

export default function VesselYearlyPerformancePage({ reportId: reportIdProp }) {
  const { reportId: reportIdParam } = useParams();
  const reportId = reportIdProp || reportIdParam || 'vessel-yearly-performance';
  const definition = getReportDefinition(reportId);

  const [options, setOptions] = useState({ businessTypes: [] });
  const [filters, setFilters] = useState({ selBType: '2' });
  const [rows, setRows] = useState([]);
  const [chart, setChart] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [search, setSearch] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const columns = useMemo(() => {
    const base = [
      { key: 'srNo', label: '#' },
      { key: 'year', label: 'Year' },
    ];
    const typeCols = series.map((s) => ({ key: s.key, label: s.label }));
    return [...base, ...typeCols, { key: 'total', label: 'Total' }];
  }, [series]);

  const filteredRows = useMemo(
    () => filterReportRows(rows, columns, search),
    [rows, columns, search],
  );

  const maxTotal = Math.max(...chart.map((item) => Number(item.Total) || 0), 1);

  const runSearch = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchReport(reportId, nextFilters);
      setRows(data.records || []);
      setChart(data.chart || []);
      setSeries(data.series || []);
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Failed to load report.');
      setRows([]);
      setChart([]);
      setSeries([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [filters, reportId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetchReportFilterOptions();
        if (!cancelled) {
          const businessTypes = meta.businessTypes?.some((t) => t.id === '')
            ? meta.businessTypes
            : [{ id: '', name: 'All' }, ...(meta.businessTypes || [])];
          setOptions({ businessTypes });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load filters.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    runSearch({ selBType: '2' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

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
    return (
      <div className={`zafira-page ${styles.page}`}>
        <div className={styles.empty}>Unknown report.</div>
      </div>
    );
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
      <p className={styles.hint}>Total number of vessels performed by type per financial year.</p>

      <FilterBar
        actions={(
          <Button
            type="button"
            variant="primary"
            label="Search"
            onClick={() => runSearch()}
            disabled={loading}
          />
        )}
      >
        <FilterField label="Business Type">
          <ReportCardSelect
            label="Business Type"
            value={filters.selBType}
            options={(options.businessTypes || []).filter((opt) => opt.id !== '')}
            emptyLabel="All"
            placeholder="All"
            onChange={(value) => setFilters((prev) => ({ ...prev, selBType: value }))}
          />
        </FilterField>
      </FilterBar>

      {error ? <div className={styles.error}>{error}</div> : null}

      {searched && chart.length ? (
        <div className={`zafira-card ${styles.chartCard}`}>
          <div className={styles.groupedChart}>
            {chart.map((point) => (
              <div key={point.year} className={styles.groupedYear}>
                <div className={styles.groupedBars}>
                  {series.map((s, index) => {
                    const value = Number(point[s.key]) || 0;
                    return (
                      <div
                        key={s.key}
                        className={styles.groupedBarWrap}
                        title={`${s.label}: ${value}`}
                      >
                        <div className={styles.groupedBarValue}>{value || ''}</div>
                        <div
                          className={styles.groupedBar}
                          style={{
                            height: `${Math.max(value ? 8 : 2, (value / maxTotal) * 200)}px`,
                            background: SERIES_COLORS[index % SERIES_COLORS.length],
                            opacity: point.toDate ? 0.45 : 1,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className={styles.groupedTotal}>
                  Total {point.Total}
                  {point.toDate ? ' *' : ''}
                </div>
                <div className={styles.chartLabel}>
                  {point.year}
                  {point.toDate ? ' (to date)' : ''}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.legend}>
            {series.map((s, index) => (
              <span key={s.key} className={styles.legendItem}>
                <span
                  className={styles.legendSwatch}
                  style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
                />
                {s.label}
              </span>
            ))}
            <span className={styles.legendItem}>Line total shown under each year</span>
          </div>
          <p className={styles.hint}>Vessel count by type (current year marked as to-date).</p>
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
                <tr key={row.id || row.year}>
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
