import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  CardSelect,
  DmyDateInput,
  Field,
  LoadingOverlay,
  Textarea,
  TextInput,
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchBunkerForm, saveBunker } from '../../../services/opsVc.js';
import OpsVcBunkerHeaderActions from './OpsVcBunkerHeaderActions.jsx';
import { recomputeBunkerForm } from './bunkerCalculations.js';
import styles from './OpsPages.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

const FLASH = {
  0: { type: 'success', text: 'Bunker added/updated successfully.' },
};

function emptyBunkerRow() {
  return {
    bunkerId: '',
    robSosp: '',
    qtyStemmed: '',
    supplyPrice: '',
    addCost: '',
    effectivePrice: '',
    stemmedValue: '',
    remarks: '',
    accountOf: '',
  };
}

function mapBunkerRow(row = {}) {
  return {
    bunkerId: row.bunkerId != null ? String(row.bunkerId) : '',
    robSosp: row.robSosp ?? '',
    qtyStemmed: row.qtyStemmed ?? '',
    supplyPrice: row.supplyPrice ?? '',
    addCost: row.addCost ?? '',
    effectivePrice: row.effectivePrice ?? '',
    stemmedValue: row.stemmedValue ?? '',
    remarks: row.remarks || '',
    accountOf: row.accountOf || '',
  };
}

function mapPrevRow(row = {}) {
  return {
    bunkerId: row.bunkerId != null ? String(row.bunkerId) : '',
    name: row.name || '',
    qty: row.qty ?? '',
    value: row.value ?? '',
    calDesc: row.calDesc || '',
  };
}

function draftFromForm(data) {
  const foGrades = data.lookups?.foGrades || [];
  const doGrades = data.lookups?.doGrades || [];
  const previousFo = (data.previousFo || []).length
    ? data.previousFo.map(mapPrevRow)
    : foGrades.map((g) => mapPrevRow({ bunkerId: g.id, name: g.name }));
  const previousDo = (data.previousDo || []).length
    ? data.previousDo.map(mapPrevRow)
    : doGrades.map((g) => mapPrevRow({ bunkerId: g.id, name: g.name }));

  return recomputeBunkerForm({
    previousFo: previousFo.length ? previousFo : [mapPrevRow()],
    previousDo: previousDo.length ? previousDo : [mapPrevRow()],
    ports: (data.ports || []).map((port) => ({
      key: port.key,
      portId: port.portId,
      randomId: port.randomId,
      portName: port.portName || '',
      comSlaveId: port.comSlaveId || '',
      sospDate: port.sospDate || '',
      foRows: (port.foRows?.length ? port.foRows : [emptyBunkerRow()]).map(mapBunkerRow),
      doRows: (port.doRows?.length ? port.doRows : [emptyBunkerRow()]).map(mapBunkerRow),
    })),
    sospResults: data.sospResults || { fo: [], do: [] },
    consumedCharterer: data.consumedCharterer || { fo: [], do: [] },
    consumedOwner: data.consumedOwner || { fo: [], do: [] },
    lookups: data.lookups || { foGrades: [], doGrades: [], accountOfOptions: [] },
  });
}

function rowFilled(row) {
  return Boolean(
    String(row.bunkerId || '').trim()
    && String(row.robSosp || '').trim()
    && String(row.qtyStemmed || '').trim()
    && String(row.supplyPrice || '').trim()
    && String(row.effectivePrice || '').trim()
    && String(row.accountOf || '').trim(),
  );
}

/**
 * PHP bunker_calculation.php — Ops VC Bunker Calculations (voyage-level, not port tabs).
 */
export default function OpsVcBunkerPage() {
  const confirm = useConfirm();
  const alert = useAlert();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';
  const prevComIdParam = searchParams.get('prevComId') || searchParams.get('prevcomid') || '';
  const flash = FLASH[Number(searchParams.get('msg'))];

  const [form, setForm] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  const lookups = draft?.lookups || form?.lookups || {
    foGrades: [],
    doGrades: [],
    accountOfOptions: [],
  };
  const accountOptions = (lookups.accountOfOptions?.length
    ? lookups.accountOfOptions
    : [
      { id: 'Owner', name: 'Owner' },
      { id: 'Charterer', name: 'Charterer' },
    ]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBunkerForm(comId, prevComIdParam || undefined);
      setForm(data);
      setDraft(draftFromForm(data));
    } catch (err) {
      setForm(null);
      setDraft(null);
      setError(err.message || 'Failed to load Bunker Calculations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!comId) {
      setError('COMID is required.');
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comId, prevComIdParam]);

  const patchDraft = (patch) => {
    setDraft((current) => recomputeBunkerForm({ ...current, ...patch }));
  };

  const patchPrevious = (side, index, patch) => {
    const key = side === 'fo' ? 'previousFo' : 'previousDo';
    const rows = [...(draft[key] || [])];
    rows[index] = { ...rows[index], ...patch };
    patchDraft({ [key]: rows });
  };

  const patchPort = (portIndex, patch) => {
    const ports = [...(draft.ports || [])];
    ports[portIndex] = { ...ports[portIndex], ...patch };
    patchDraft({ ports });
  };

  const patchPortRow = (portIndex, side, rowIndex, patch) => {
    const field = side === 'fo' ? 'foRows' : 'doRows';
    const ports = [...(draft.ports || [])];
    const rows = [...(ports[portIndex][field] || [])];
    rows[rowIndex] = { ...rows[rowIndex], ...patch };
    ports[portIndex] = { ...ports[portIndex], [field]: rows };
    patchDraft({ ports });
  };

  const addPortRow = async (portIndex, side) => {
    const field = side === 'fo' ? 'foRows' : 'doRows';
    const rows = draft.ports[portIndex][field] || [];
    const last = rows[rows.length - 1];
    if (last && !rowFilled(last)) {
      await alert({ title: 'Alert', message: 'Please fill previous data' });
      return;
    }
    const ports = [...draft.ports];
    ports[portIndex] = {
      ...ports[portIndex],
      [field]: [...rows, emptyBunkerRow()],
    };
    patchDraft({ ports });
  };

  const handlePrevVoyageChange = (value) => {
    const next = {
      comid: comId,
      page,
    };
    if (value) next.prevComId = String(value);
    setSearchParams(next);
  };

  const handleSubmit = async (status) => {
    if (!draft) return;

    for (const port of draft.ports || []) {
      if (!String(port.sospDate || '').trim()) {
        await alert({
          title: 'Alert',
          message: `Please enter SOSP Date/Time for port ${port.portName || ''}.`,
        });
        return;
      }
    }

    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you have checked each entry ?',
      confirmLabel: status === 1 ? 'Submit to Close' : 'Submit to Edit',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const result = await saveBunker({
        comId,
        page,
        status,
        prevComId: prevComIdParam || form?.prevComId || '',
        previousFo: draft.previousFo,
        previousDo: draft.previousDo,
        ports: draft.ports,
        sospResults: draft.sospResults,
        consumedCharterer: draft.consumedCharterer,
        consumedOwner: draft.consumedOwner,
      });

      if (result.closed || status === 1) {
        navigate(`${backHref}?msg=3`);
        return;
      }

      setSearchParams({
        comid: comId,
        page,
        ...(prevComIdParam ? { prevComId: prevComIdParam } : {}),
        msg: String(result.msg ?? 0),
      });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to save Bunker Calculations.');
    } finally {
      setSaving(false);
    }
  };

  const lastPortName = draft?.ports?.length
    ? draft.ports[draft.ports.length - 1].portName
    : '';

  const renderPrevTable = (side) => {
    const rows = side === 'fo' ? draft.previousFo : draft.previousDo;
    const title = side === 'fo' ? 'FUEL OIL' : 'DO/MGO';
    return (
      <>
        <tr>
          <th colSpan={4}>{title}</th>
        </tr>
        {(rows || []).map((row, index) => (
          <tr key={`${side}-prev-${row.bunkerId || index}`}>
            <td>{row.name || '—'}</td>
            <td>
              <TextInput
                value={row.qty}
                onChange={(e) => patchPrevious(side, index, { qty: e.target.value })}
                placeholder="0.00"
              />
            </td>
            <td>
              <TextInput
                value={row.value}
                onChange={(e) => patchPrevious(side, index, { value: e.target.value })}
                placeholder="0.00"
              />
            </td>
            <td>
              <TextInput
                value={row.calDesc}
                onChange={(e) => patchPrevious(side, index, { calDesc: e.target.value })}
                placeholder="Qty1*price1,Qty2*price2"
              />
            </td>
          </tr>
        ))}
        {!rows?.length ? (
          <tr>
            <td colSpan={4} className={styles.emptyCell}>No previous {title} rows.</td>
          </tr>
        ) : null}
      </>
    );
  };

  const renderPortRows = (portIndex, side) => {
    const port = draft.ports[portIndex];
    const field = side === 'fo' ? 'foRows' : 'doRows';
    const rows = (port[field]?.length ? port[field] : [emptyBunkerRow()]);
    const gradeOptions = side === 'fo' ? (lookups.foGrades || []) : (lookups.doGrades || []);
    const title = side === 'fo' ? 'FUEL OIL' : 'DO/MGO';

    return (
      <>
        <tr>
          <th colSpan={9}>{title}</th>
        </tr>
        {rows.map((row, rowIndex) => (
          <tr key={`${port.key}-${side}-${rowIndex}`}>
            <td>
              <CardSelect
                value={row.bunkerId}
                options={gradeOptions}
                onChange={(v) => patchPortRow(portIndex, side, rowIndex, { bunkerId: String(v || '') })}
                align="start"
                ariaLabel={`${title} grade`}
              />
            </td>
            <td>
              <TextInput
                value={row.robSosp}
                onChange={(e) => patchPortRow(portIndex, side, rowIndex, { robSosp: e.target.value })}
                placeholder="0.00"
              />
            </td>
            <td>
              <TextInput
                value={row.qtyStemmed}
                onChange={(e) => patchPortRow(portIndex, side, rowIndex, { qtyStemmed: e.target.value })}
                placeholder="0.00"
              />
            </td>
            <td>
              <TextInput
                value={row.supplyPrice}
                onChange={(e) => patchPortRow(portIndex, side, rowIndex, { supplyPrice: e.target.value })}
                placeholder="0.00"
              />
            </td>
            <td>
              <TextInput
                value={row.addCost}
                onChange={(e) => patchPortRow(portIndex, side, rowIndex, { addCost: e.target.value })}
                placeholder="0.00"
              />
            </td>
            <td>
              <TextInput value={row.effectivePrice} disabled placeholder="0.00" />
            </td>
            <td>
              <TextInput value={row.stemmedValue} disabled placeholder="0.00" />
            </td>
            <td>
              <Textarea
                rows={2}
                value={row.remarks}
                onChange={(e) => patchPortRow(portIndex, side, rowIndex, { remarks: e.target.value })}
                placeholder="Description"
              />
            </td>
            <td>
              <CardSelect
                value={row.accountOf}
                options={accountOptions}
                onChange={(v) => patchPortRow(portIndex, side, rowIndex, { accountOf: String(v || '') })}
                align="start"
                ariaLabel="On Account Of"
              />
            </td>
          </tr>
        ))}
        <tr>
          <td colSpan={9}>
            <Button
              variant="outline"
              label="Add"
              onClick={() => addPortRow(portIndex, side)}
            />
          </td>
        </tr>
      </>
    );
  };

  const renderResultRows = (rows, kind, side) => {
    if (!(rows || []).length) {
      return (
        <tr>
          <td colSpan={3} className={styles.emptyCell}>—</td>
        </tr>
      );
    }
    return rows.map((row, i) => (
      <tr key={`res-${side}-${row.bunkerId || i}`}>
        <td>{row.name || '—'}</td>
        {kind === 'sosp' ? (
          <>
            <td><TextInput value={row.value} disabled placeholder="0.00" /></td>
            <td><TextInput value={row.calDesc} disabled placeholder="Qty1*price1" /></td>
          </>
        ) : (
          <>
            <td><TextInput value={row.qty} disabled placeholder="0.00" /></td>
            <td><TextInput value={row.value} disabled placeholder="0.00" /></td>
          </>
        )}
      </tr>
    ));
  };

  const renderResultTable = (title, foRows, doRows, kind) => {
    const columns = kind === 'sosp'
      ? ['Bunker Grade', 'Total Value(USD)', 'Bunker Calculation Desc']
      : ['Bunker Grade', 'Qty Used(MT)', 'Value Used(USD)'];
    return (
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>{title}</h4>
        <div className={styles.tableWrap}>
          <table className={`zafira-data-table ${styles.nestedTable}`}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><th colSpan={3}>FUEL OIL</th></tr>
              {renderResultRows(foRows, kind, 'fo')}
              <tr><th colSpan={3}>DO/MGO</th></tr>
              {renderResultRows(doRows, kind, 'do')}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <>
      <OpsVcBunkerHeaderActions backHref={backHref} disabled={loading || saving} />

      <div className={`zafira-page ${styles.page}`}>
        {(loading || saving) ? (
          <LoadingOverlay active label={saving ? 'Saving Bunkers…' : 'Loading Bunkers…'} />
        ) : null}
        {flash ? (
          <div className={flash.type === 'error' ? styles.error : styles.flashSuccess}>{flash.text}</div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <h3 className={styles.title}>Bunker Calculations</h3>

        {form ? (
          <div className={styles.compareHeaderGrid}>
            <div><strong>Vessel :</strong> {form.vesselName || '—'}</div>
            <div><strong>Nom ID :</strong> {form.message || '—'}</div>
            <div><strong>Voy No. :</strong> {form.voyageNo || '—'}</div>
            <div><strong>Charterer :</strong> {form.charterer || '—'}</div>
          </div>
        ) : null}

        {draft ? (
          <>
            <div className={styles.section}>
              <div className={styles.tripHeader}>
                <h4 className={styles.sectionTitle} style={{ margin: 0 }}>
                  Last Port Bunker SOSP Details
                </h4>
                {(form?.prevVoyageOptions || []).length ? (
                  <Field label="Previous Voyage">
                    <CardSelect
                      value={prevComIdParam || form?.prevComId || ''}
                      options={(form.prevVoyageOptions || []).map((opt) => ({
                        id: String(opt.id),
                        name: opt.name || String(opt.id),
                      }))}
                      onChange={handlePrevVoyageChange}
                      align="end"
                      ariaLabel="Previous voyage"
                    />
                  </Field>
                ) : null}
              </div>

              <div className={styles.tableWrap}>
                <table className={`zafira-data-table ${styles.nestedTable}`}>
                  <thead>
                    <tr>
                      <th>Bunker Grade</th>
                      <th>Qty(MT)</th>
                      <th>Bunker Value({form?.currency || 'USD'})</th>
                      <th>Last Bunker(Qty x Price) In, 2nd Last…</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderPrevTable('fo')}
                    {renderPrevTable('do')}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Current Voyage Bunker Details</h4>
              {(draft.ports || []).map((port, portIndex) => (
                <div key={port.key || portIndex} style={{ marginBottom: 20 }}>
                  <div className={styles.formGrid}>
                    <div>
                      <strong style={{ color: '#006FDD' }}>
                        Port :&nbsp;&nbsp;{port.portName || '—'}
                      </strong>
                    </div>
                    <Field label="SOSP (Date/Time)">
                      <DmyDateInput
                        enableTime
                        value={port.sospDate}
                        onChange={(v) => patchPort(portIndex, { sospDate: v })}
                      />
                    </Field>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={`zafira-data-table ${styles.nestedTable}`}>
                      <thead>
                        <tr>
                          <th>Bunker Grade</th>
                          <th>ROB SOSP(MT)</th>
                          <th>Qty Stemmed(MT)</th>
                          <th>Supply Price(Cost/MT)</th>
                          <th>Add. Costs(USD)</th>
                          <th>Effective Price(Cost/MT)</th>
                          <th>Stemmed Value(USD)</th>
                          <th>Remarks</th>
                          <th>On Account Of</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renderPortRows(portIndex, 'fo')}
                        {renderPortRows(portIndex, 'do')}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {!draft.ports?.length ? (
                <p className={styles.muted}>No ports found on the cost sheet for bunker entry.</p>
              ) : null}
            </div>

            {renderResultTable(
              `Current Voyage Bunker Results — SOSP value (Last Port${lastPortName ? ` — ${String(lastPortName).toUpperCase()}` : ''})`,
              draft.sospResults?.fo,
              draft.sospResults?.do,
              'sosp',
            )}

            {renderResultTable(
              'Consumed on Charterer',
              draft.consumedCharterer?.fo,
              draft.consumedCharterer?.do,
              'consumed',
            )}

            {renderResultTable(
              "Consumed on Owner's Account",
              draft.consumedOwner?.fo,
              draft.consumedOwner?.do,
              'consumed',
            )}

            <div className={styles.footerActions}>
              <Button
                variant="primary"
                label="Submit to Edit"
                onClick={() => handleSubmit(0)}
                disabled={saving || loading}
              />
              <Button
                variant="primary"
                label="Submit to Close"
                onClick={() => handleSubmit(1)}
                disabled={saving || loading}
              />
            </div>
          </>
        ) : null}

        {!loading && !draft && !error ? (
          <div className={styles.empty}>No bunker form data available.</div>
        ) : null}
      </div>
    </>
  );
}
