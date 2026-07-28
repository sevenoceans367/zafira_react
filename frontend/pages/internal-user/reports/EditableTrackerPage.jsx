import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  DmyDateInput,
  FilterBar,
  FilterField,
  LoadingOverlay,
  TextInput,
} from '@bainbridge/shared-ui';
import { getReportDefinition } from '../../../constants/reportsDefinitions.js';
import {
  fetchReport,
  fetchReportFilterOptions,
  updateReportTrackerField,
} from '../../../services/reports.js';
import ReportCardSelect from './ReportCardSelect.jsx';
import ReportsHeaderActions from './ReportsHeaderActions.jsx';
import {
  downloadReportExcel,
  downloadReportPdf,
  filterReportRows,
} from './reportExports.js';
import styles from './ReportPages.module.css';

export default function EditableTrackerPage({ reportId: reportIdProp }) {
  const { reportId: reportIdParam } = useParams();
  const reportId = reportIdProp || reportIdParam;
  const definition = getReportDefinition(reportId);

  const [options, setOptions] = useState({
    years: [],
    teams: [],
    businessTypes: [],
    ports: [],
    vendors: [],
    costTypes: [],
  });
  const [filters, setFilters] = useState({
    selYear: String(new Date().getFullYear()),
    selTeam: '',
    selBType: '2',
    selPort: '',
    selAgent: '',
    selCostType: '',
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searched, setSearched] = useState(false);
  const [search, setSearch] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const exportColumns = useMemo(() => ([
    ...(definition?.fixedColumns || []),
    ...(definition?.editableColumns || []),
  ]), [definition]);

  const exportRows = useMemo(() => rows.map((row) => {
    const next = { ...row };
    (definition?.editableColumns || []).forEach((col) => {
      next[col.key] = row.editable?.[col.key] ?? row[col.key] ?? '';
    });
    return next;
  }), [rows, definition]);

  const filteredRows = useMemo(
    () => filterReportRows(exportRows, exportColumns, search),
    [exportRows, exportColumns, search],
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
    setMessage('');
    try {
      const data = await fetchReport(reportId, filters);
      setRows(data.records || []);
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Failed to load tracker.');
      setRows([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [definition, filters, reportId]);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const setCell = (comId, iden, value) => {
    setRows((prev) => prev.map((row) => (
      String(row.comId) === String(comId)
        ? {
          ...row,
          [iden]: value,
          editable: { ...(row.editable || {}), [iden]: value },
        }
        : row
    )));
  };

  const saveCell = async (comId, iden, value) => {
    const key = `${comId}:${iden}`;
    setSavingKey(key);
    setMessage('');
    try {
      await updateReportTrackerField(reportId, { comId, iden, value });
      setMessage('Saved.');
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSavingKey('');
    }
  };

  const handleExcel = () => {
    downloadReportExcel(reportId, exportColumns, filteredRows);
  };

  const handlePdf = async () => {
    setPdfLoading(true);
    setError('');
    try {
      await downloadReportPdf({
        title: definition?.title || reportId,
        filename: reportId,
        columns: exportColumns,
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

  const filterDefs = definition.filters || [];
  const filteredComIds = new Set(filteredRows.map((row) => String(row.comId || row.id)));
  const visibleRows = rows.filter((row) => filteredComIds.has(String(row.comId || row.id)));

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
        {filterDefs.map((filter) => {
          if (filter.type === 'year') {
            return (
              <FilterField key={filter.key} label={filter.label}>
                <ReportCardSelect
                  label={filter.label}
                  value={filters[filter.key] || ''}
                  options={options.years || []}
                  includeEmpty={false}
                  placeholder="Year"
                  onChange={(value) => setFilter(filter.key, value)}
                />
              </FilterField>
            );
          }
          if (filter.type === 'team') {
            return (
              <FilterField key={filter.key} label={filter.label}>
                <ReportCardSelect
                  label={filter.label}
                  value={filters[filter.key] || ''}
                  options={(options.teams || []).filter((opt) => opt.id !== '')}
                  emptyLabel="All"
                  placeholder="All"
                  onChange={(value) => setFilter(filter.key, value)}
                />
              </FilterField>
            );
          }
          if (filter.type === 'businessType') {
            return (
              <FilterField key={filter.key} label={filter.label}>
                <ReportCardSelect
                  label={filter.label}
                  value={filters[filter.key] || ''}
                  options={(options.businessTypes || []).filter((opt) => opt.id !== '')}
                  emptyLabel="All"
                  placeholder="All"
                  onChange={(value) => setFilter(filter.key, value)}
                />
              </FilterField>
            );
          }
          if (filter.type === 'vendor') {
            return (
              <FilterField key={filter.key} label={filter.label}>
                <ReportCardSelect
                  label={filter.label}
                  value={filters[filter.key] || ''}
                  options={options.vendors || []}
                  onChange={(value) => setFilter(filter.key, value)}
                />
              </FilterField>
            );
          }
          if (filter.type === 'costType') {
            return (
              <FilterField key={filter.key} label={filter.label}>
                <ReportCardSelect
                  label={filter.label}
                  value={filters[filter.key] || ''}
                  options={options.costTypes?.length
                    ? options.costTypes
                    : [
                      { id: 'Load Port Costs', name: 'Load Port Costs' },
                      { id: 'Discharge Port Costs', name: 'Discharge Port Costs' },
                      { id: 'Transit Port Costs', name: 'Transit Port Costs' },
                    ]}
                  onChange={(value) => setFilter(filter.key, value)}
                />
              </FilterField>
            );
          }
          if (filter.type === 'port') {
            return (
              <FilterField key={filter.key} label={filter.label}>
                <ReportCardSelect
                  label={filter.label}
                  value={filters[filter.key] || ''}
                  options={options.ports || []}
                  onChange={(value) => setFilter(filter.key, value)}
                />
              </FilterField>
            );
          }
          return null;
        })}
      </FilterBar>

      {error ? <div className={styles.error}>{error}</div> : null}
      {message ? <div className={styles.success}>{message}</div> : null}

      {searched && !rows.length && !loading ? (
        <div className={styles.empty}>No records found for the selected filters.</div>
      ) : null}

      {searched && rows.length && !visibleRows.length && !loading ? (
        <div className={styles.empty}>No records match the search.</div>
      ) : null}

      {visibleRows.length ? (
        <div className={`zafira-card ${styles.tableWrap}`}>
          <table className="zafira-data-table">
            <thead>
              <tr>
                {(definition.fixedColumns || []).map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
                {(definition.editableColumns || []).map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.comId || row.id}>
                  {(definition.fixedColumns || []).map((col) => (
                    <td key={col.key}>
                      {row[col.key] == null || row[col.key] === '' ? '—' : String(row[col.key])}
                    </td>
                  ))}
                  {(definition.editableColumns || []).map((col) => {
                    const value = row.editable?.[col.key] ?? row[col.key] ?? '';
                    const busy = savingKey === `${row.comId}:${col.key}`;
                    if (col.inputType === 'date') {
                      return (
                        <td key={col.key}>
                          <DmyDateInput
                            value={value}
                            onChange={(next) => {
                              setCell(row.comId, col.key, next);
                              saveCell(row.comId, col.key, next);
                            }}
                          />
                          {busy ? <span className={styles.saving}>…</span> : null}
                        </td>
                      );
                    }
                    return (
                      <td key={col.key}>
                        <TextInput
                          value={value}
                          onChange={(e) => setCell(row.comId, col.key, e.target.value)}
                          onBlur={(e) => saveCell(row.comId, col.key, e.target.value)}
                        />
                        {busy ? <span className={styles.saving}>…</span> : null}
                      </td>
                    );
                  })}
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
