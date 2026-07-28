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
import {
  COA_SPOT_OPTIONS,
  getReportDefinition,
} from '../../../constants/reportsDefinitions.js';
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

function defaultFilters(definition) {
  const next = {};
  (definition.filters || []).forEach((filter) => {
    if (filter.defaultValue != null) next[filter.key] = filter.defaultValue;
    else if (filter.type === 'year') next[filter.key] = String(new Date().getFullYear());
    else if (filter.type === 'businessType') next[filter.key] = '2';
    else next[filter.key] = '';
  });
  return next;
}

export default function ConfigurableReportPage({ reportId: reportIdProp }) {
  const { reportId: reportIdParam } = useParams();
  const reportId = reportIdProp || reportIdParam;
  const definition = getReportDefinition(reportId);

  const [options, setOptions] = useState({
    businessTypes: [],
    years: [],
    teams: [],
    ports: [],
    vendors: [],
    vessels: [],
    costTypes: [],
    daySelections: [],
    spotCoaTcOptions: [],
    amountTypes: [],
    shipmentDateTypes: [],
    isMgmtUser: false,
  });
  const [filters, setFilters] = useState(() => (
    definition ? defaultFilters(definition) : {}
  ));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [search, setSearch] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const columns = useMemo(() => {
    if (!definition) return [];
    return (definition.columns || []).filter((col) => (
      !col.mgmtOnly || options.isMgmtUser
    ));
  }, [definition, options.isMgmtUser]);

  const filteredRows = useMemo(
    () => filterReportRows(rows, columns, search),
    [rows, columns, search],
  );

  const runSearch = useCallback(async (nextFilters = filters) => {
    if (!definition) return;
    const missing = (definition.requiredFilters || []).filter((key) => !nextFilters[key]);
    if (missing.length) {
      setError(definition.requiredMessage || 'Please complete required filters.');
      setRows([]);
      setSearched(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchReport(reportId, nextFilters);
      setRows(data.records || []);
      setSearched(true);
      if (typeof data.isMgmtUser === 'boolean') {
        setOptions((prev) => ({ ...prev, isMgmtUser: data.isMgmtUser }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load report.');
      setRows([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [definition, filters, reportId]);

  useEffect(() => {
    if (!definition) return;
    const next = defaultFilters(definition);
    setFilters(next);
    setRows([]);
    setSearched(false);
    setError('');
    setSearch('');
    if (definition.searchOnMount) {
      runSearch(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, definition]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetchReportFilterOptions();
        if (!cancelled) {
          setOptions(meta);
          // Ensure All is always available even if API omits it
          if (!meta.businessTypes?.some((t) => t.id === '')) {
            setOptions({
              ...meta,
              businessTypes: [{ id: '', name: 'All' }, ...(meta.businessTypes || [])],
            });
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load filters.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

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

      {definition.filters?.length ? (
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
          {definition.filters.map((filter) => {
            if (filter.type === 'date') {
              return (
                <FilterField key={filter.key} label={filter.label}>
                  <DmyDateInput
                    value={filters[filter.key] || ''}
                    onChange={(value) => setFilter(filter.key, value)}
                  />
                </FilterField>
              );
            }
            if (filter.type === 'checkbox') {
              return (
                <FilterField key={filter.key} label={filter.label}>
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={filters[filter.key] === '1'}
                      onChange={(e) => setFilter(filter.key, e.target.checked ? '1' : '')}
                    />
                    {' '}Yes
                  </label>
                </FilterField>
              );
            }
            if (filter.type === 'text' || !filter.type) {
              return (
                <FilterField key={filter.key} label={filter.label}>
                  <TextInput
                    value={filters[filter.key] || ''}
                    onChange={(e) => setFilter(filter.key, e.target.value)}
                  />
                </FilterField>
              );
            }

            let selectOptions = [];
            let includeEmpty = true;
            let emptyLabel = '---Select from list---';
            let placeholder = filter.label;

            if (filter.type === 'businessType') {
              selectOptions = options.businessTypes.length
                ? options.businessTypes.filter((opt) => opt.id !== '')
                : [{ id: '3', name: 'Dry' }, { id: '2', name: 'Tankers' }, { id: '1', name: 'Gas' }];
              emptyLabel = 'All';
              placeholder = 'All';
            } else if (filter.type === 'coaSpot') {
              selectOptions = COA_SPOT_OPTIONS.map((opt) => ({ id: opt.value, name: opt.label }));
              includeEmpty = false;
              placeholder = 'Spot';
            } else if (filter.type === 'team') {
              selectOptions = (options.teams || []).filter((opt) => opt.id !== '');
              emptyLabel = 'All';
              placeholder = 'All';
            } else if (filter.type === 'vendor') {
              selectOptions = options.vendors || [];
            } else if (filter.type === 'costType') {
              selectOptions = options.costTypes?.length
                ? options.costTypes
                : [
                  { id: 'Load Port Costs', name: 'Load Port Costs' },
                  { id: 'Discharge Port Costs', name: 'Discharge Port Costs' },
                  { id: 'Transit Port Costs', name: 'Transit Port Costs' },
                ];
            } else if (filter.type === 'port') {
              selectOptions = options.ports || [];
            } else if (filter.type === 'vessel') {
              selectOptions = options.vessels || [];
              emptyLabel = 'All';
              placeholder = 'All';
            } else if (filter.type === 'voyageType') {
              selectOptions = [
                { id: 'VC', name: 'VC' },
                { id: 'COA', name: 'COA' },
              ];
              includeEmpty = false;
              placeholder = 'VC';
            } else if (filter.type === 'daySelection') {
              selectOptions = options.daySelections?.length
                ? options.daySelections
                : [
                  { id: '1', name: 'All' },
                  { id: '2', name: '0 - 30 Days' },
                  { id: '3', name: '30 - 60 Days' },
                  { id: '4', name: '60 - 90 Days' },
                  { id: '5', name: '> 90 Days' },
                ];
              includeEmpty = false;
              placeholder = 'All';
            } else if (filter.type === 'spotCoaTc') {
              selectOptions = options.spotCoaTcOptions?.length
                ? options.spotCoaTcOptions
                : [
                  { id: '1', name: 'Spot' },
                  { id: '2', name: 'COA' },
                  { id: '3', name: 'TC' },
                ];
              includeEmpty = false;
              placeholder = 'Spot';
            } else if (filter.type === 'amountType') {
              selectOptions = options.amountTypes?.length
                ? options.amountTypes
                : [
                  { id: '1', name: 'ETA' },
                  { id: '2', name: 'ETC/D' },
                ];
              includeEmpty = false;
              placeholder = 'ETA';
            } else if (filter.type === 'shipmentDateType') {
              selectOptions = options.shipmentDateTypes?.length
                ? options.shipmentDateTypes
                : [
                  { id: '1', name: 'BL Date' },
                  { id: '2', name: 'Financial Year (CP Date)' },
                ];
              includeEmpty = false;
              placeholder = 'Financial Year (CP Date)';
            } else if (filter.type === 'year') {
              selectOptions = options.years || [];
              includeEmpty = false;
              placeholder = 'Year';
            } else {
              return (
                <FilterField key={filter.key} label={filter.label}>
                  <TextInput
                    value={filters[filter.key] || ''}
                    onChange={(e) => setFilter(filter.key, e.target.value)}
                  />
                </FilterField>
              );
            }

            return (
              <FilterField key={filter.key} label={filter.label}>
                <ReportCardSelect
                  label={filter.label}
                  value={filters[filter.key] || ''}
                  options={selectOptions}
                  includeEmpty={includeEmpty}
                  emptyLabel={emptyLabel}
                  placeholder={placeholder}
                  onChange={(value) => setFilter(filter.key, value)}
                />
              </FilterField>
            );
          })}
        </FilterBar>
      ) : (
        <p className={styles.hint}>This report loads automatically.</p>
      )}

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
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={row.id || row.comId || `${reportId}-${index}`}>
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
