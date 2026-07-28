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

function ReportTable({ columns, rows }) {
  if (!rows.length) {
    return <div className={styles.empty}>No records found.</div>;
  }
  return (
    <div className={`zafira-card ${styles.tableWrap}`}>
      <table className="zafira-data-table">
        <thead>
          <tr>
            {columns.map((col) => <th key={col.key}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `${row.voyageNo}-${index}`}>
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
  );
}

export default function DualPlReportPage({ reportId: reportIdProp }) {
  const { reportId: reportIdParam } = useParams();
  const reportId = reportIdProp || reportIdParam || 'pl-at-a-glance-vc-tc';
  const definition = getReportDefinition(reportId);

  const [options, setOptions] = useState({
    businessTypes: [],
    years: [],
    teams: [],
  });
  const [filters, setFilters] = useState({
    selYear: String(new Date().getFullYear()),
    selTeam: '',
    selBType: '2',
  });
  const [vcRows, setVcRows] = useState([]);
  const [tcRows, setTcRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [search, setSearch] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const vcColumns = useMemo(() => definition?.vcColumns || [], [definition]);
  const tcColumns = useMemo(() => definition?.tcColumns || [], [definition]);

  const filteredVcRows = useMemo(
    () => filterReportRows(vcRows, vcColumns, search),
    [vcRows, vcColumns, search],
  );
  const filteredTcRows = useMemo(
    () => filterReportRows(tcRows, tcColumns, search),
    [tcRows, tcColumns, search],
  );

  const exportColumns = useMemo(() => ([
    { key: 'section', label: 'Section' },
    ...vcColumns,
  ]), [vcColumns]);

  const exportRows = useMemo(() => {
    const mapRows = (section, rows, columns) => rows.map((row) => {
      const next = { section };
      columns.forEach((col) => {
        next[col.key] = row[col.key];
      });
      return next;
    });
    return [
      ...mapRows(definition?.vcTitle || 'VC', filteredVcRows, vcColumns),
      ...mapRows(definition?.tcTitle || 'TC', filteredTcRows, tcColumns),
    ];
  }, [definition, filteredVcRows, filteredTcRows, vcColumns, tcColumns]);

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
      setVcRows([]);
      setTcRows([]);
      setSearched(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchReport(reportId, filters);
      setVcRows(data.recordsVc || []);
      setTcRows(data.recordsTc || []);
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Failed to load report.');
      setVcRows([]);
      setTcRows([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [definition, filters, reportId]);

  const handleExcel = () => {
    downloadReportExcel(reportId, exportColumns, exportRows);
  };

  const handlePdf = async () => {
    setPdfLoading(true);
    setError('');
    try {
      await downloadReportPdf({
        title: definition?.title || reportId,
        filename: reportId,
        columns: exportColumns,
        rows: exportRows,
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

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const hasExportRows = exportRows.length > 0;

  return (
    <>
      <ReportsHeaderActions
        search={search}
        onSearchChange={setSearch}
        onExcel={handleExcel}
        onPdf={handlePdf}
        excelDisabled={!hasExportRows}
        pdfDisabled={!hasExportRows}
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
              onChange={(value) => setFilter('selYear', value)}
            />
          </FilterField>
          <FilterField label="Team">
            <ReportCardSelect
              label="Team"
              value={filters.selTeam}
              options={(options.teams || []).filter((opt) => opt.id !== '')}
              emptyLabel="All"
              placeholder="All"
              onChange={(value) => setFilter('selTeam', value)}
            />
          </FilterField>
          <FilterField label="Business Type">
            <ReportCardSelect
              label="Business Type"
              value={filters.selBType}
              options={(options.businessTypes || []).filter((opt) => opt.id !== '')}
              emptyLabel="All"
              placeholder="All"
              onChange={(value) => setFilter('selBType', value)}
            />
          </FilterField>
        </FilterBar>

        {error ? <div className={styles.error}>{error}</div> : null}

        {searched ? (
          <>
            <h3 className={styles.sectionTitle}>{definition.vcTitle || 'VC'}</h3>
            <ReportTable columns={vcColumns} rows={filteredVcRows} />
            <hr className={styles.dashed} />
            <h3 className={styles.sectionTitle}>{definition.tcTitle || 'TC'}</h3>
            <ReportTable columns={tcColumns} rows={filteredTcRows} />
          </>
        ) : null}
      </div>
    </>
  );
}
