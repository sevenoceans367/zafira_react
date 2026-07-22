import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  CardSelect,
  DmyDateInput,
  Field,
  LoadingOverlay,
  TextInput,
  useConfirm,
} from '@bainbridge/shared-ui';
import { useFleetModule } from '../../../hooks/useFleetModule.js';
import {
  downloadCommercialParametersPdf,
  fetchCommercialParameters,
  saveCommercialParameters,
} from '../../../services/commercialParameters.js';
import styles from './CommercialParametersPage.module.css';

function emptyAtSeaRow() {
  return {
    key: `at-sea-${Date.now()}`,
    bunkerId: '',
    zone: 'Non Seca',
    ballastFull: '',
    ladenFull: '',
    ballastService: '',
    ladenService: '',
    ballastEco: '',
    ladenEco: '',
  };
}

function emptyInPortRow() {
  return {
    key: `in-port-${Date.now()}`,
    bunkerId: '',
    zone: 'Non Seca',
    workingLp: '',
    workingDp: '',
    idleBallast: '',
    idleLaden: '',
  };
}

function emptyVariousRow() {
  return {
    key: `various-${Date.now()}`,
    bunkerId: '',
    zone: 'Non Seca',
    coldWash: '',
    hotWash: '',
    inertGasFree: '',
    purgeGasFree: '',
    heatingMaintain: '',
    heatingRaise: '',
  };
}

function ThemedCardSelect({
  value,
  options = [],
  onChange,
  label,
  placeholder = '----Select From List----',
}) {
  return (
    <div className={styles.cardSelect}>
      <CardSelect
        value={value || ''}
        options={options}
        placeholder={placeholder}
        ariaLabel={label || placeholder}
        align="start"
        onChange={onChange}
      />
    </div>
  );
}

function NumericInput({ value, onChange }) {
  return (
    <TextInput
      className={styles.inputNumeric}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function BunkerSelect({ row, lookups, onChange }) {
  return (
    <ThemedCardSelect
      value={row.bunkerId || ''}
      options={lookups.bunkers ?? []}
      label="Bunker"
      onChange={(value) => onChange({ bunkerId: value })}
    />
  );
}

function ZoneSelect({ row, lookups, onChange }) {
  return (
    <ThemedCardSelect
      value={row.zone || 'Non Seca'}
      options={lookups.zones ?? []}
      label="Zone"
      placeholder="Zone"
      onChange={(value) => onChange({ zone: value })}
    />
  );
}

export default function CommercialParametersPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { fleetPath } = useFleetModule();
  const { id: vesselId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [vessel, setVessel] = useState(null);
  const [lookups, setLookups] = useState({ bunkers: [], zones: [] });
  const [main, setMain] = useState({ date: '', dwt: '', draft: '', tpc: '' });
  const [speed, setSpeed] = useState({
    ballastFull: '',
    ballastService: '',
    ballastEco: '',
    ladenFull: '',
    ladenService: '',
    ladenEco: '',
  });
  const [bunkersAtSea, setBunkersAtSea] = useState([emptyAtSeaRow()]);
  const [bunkersInPort, setBunkersInPort] = useState([emptyInPortRow()]);
  const [bunkersVarious, setBunkersVarious] = useState([emptyVariousRow()]);

  const loadData = useCallback(async () => {
    if (!vesselId) {
      setError('Missing vessel id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await fetchCommercialParameters(vesselId);
      setVessel(data.vessel);
      setLookups(data.lookups ?? { bunkers: [], zones: [] });
      setMain(data.main ?? {});
      setSpeed(data.speed ?? {});
      setBunkersAtSea(data.bunkersAtSea?.length ? data.bunkersAtSea : [emptyAtSeaRow()]);
      setBunkersInPort(data.bunkersInPort?.length ? data.bunkersInPort : [emptyInPortRow()]);
      setBunkersVarious(data.bunkersVarious?.length ? data.bunkersVarious : [emptyVariousRow()]);
    } catch (err) {
      setError(err.message || 'Failed to load commercial parameters.');
    } finally {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateRow = useCallback((setter, index, patch) => {
    setter((rows) => rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch } : row
    )));
  }, []);

  const removeRow = useCallback(async (setter, index, rows) => {
    if (rows.length <= 1) return;
    const accepted = await confirm({
      title: 'Remove row',
      message: 'Are you sure you want to remove this entry permanently?',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    });
    if (!accepted) return;
    setter((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }, [confirm]);

  const handleGeneratePdf = useCallback(async () => {
    if (!vesselId || loading) return;
    setPdfLoading(true);
    setError('');
    try {
      await downloadCommercialParametersPdf(vesselId);
    } catch (err) {
      setError(err.message || 'Failed to generate commercial parameters PDF.');
    } finally {
      setPdfLoading(false);
    }
  }, [loading, vesselId]);

  const handleSubmit = useCallback(async () => {
    if (!vesselId) return;
    if (!main.date) {
      setError('Date is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await saveCommercialParameters(vesselId, {
        main,
        speed,
        bunkersAtSea,
        bunkersInPort,
        bunkersVarious: vessel?.businessTypeId === 2 ? bunkersVarious : [],
      });
      navigate(fleetPath);
    } catch (err) {
      setError(err.message || 'Failed to save commercial parameters.');
    } finally {
      setSaving(false);
    }
  }, [bunkersAtSea, bunkersInPort, bunkersVarious, fleetPath, main, navigate, speed, vessel, vesselId]);

  const showVarious = vessel?.businessTypeId === 2;

  return (
    <div className={`zafira-page ${styles.page}`}>
      {loading || saving ? (
        <LoadingOverlay active label={saving ? 'Saving commercial parameters…' : 'Loading commercial parameters…'} />
      ) : null}

      <div className={styles.toolbar}>
        <Button type="button" variant="outline" label="Back" to={fleetPath} />
        <div className={styles.toolbarActions}>
          <Button
            type="button"
            variant="outline"
            label={pdfLoading ? 'Generating PDF…' : 'Generate PDF'}
            icon="download"
            onClick={handleGeneratePdf}
            disabled={loading || pdfLoading || !vessel}
          />
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <h2 className={styles.subtitle}>COMMERCIAL - PARAMETERS</h2>

      <section className={`zafira-card ${styles.section}`}>
        <h3 className={styles.sectionTitle}>Main Data</h3>
        <div className={styles.sectionBody}>
          <div className={styles.grid4}>
            <Field id="txtVName" label="Vessel Name">
              <TextInput id="txtVName" readOnly value={vessel?.name ?? ''} />
            </Field>
            <Field id="txtVType" label="Vessel Type">
              <TextInput id="txtVType" readOnly value={vessel?.type ?? ''} />
            </Field>
            <Field id="txtDate" label="Date *">
              <DmyDateInput
                id="txtDate"
                value={main.date ?? ''}
                onChange={(value) => setMain((current) => ({ ...current, date: value }))}
              />
            </Field>
            <Field id="txtDWTS" label="DWT (Summer)">
              <TextInput id="txtDWTS" readOnly value={main.dwt ?? ''} />
            </Field>
            <Field id="txtDraft" label="Draft (Summer)">
              <TextInput id="txtDraft" readOnly value={main.draft ?? ''} />
            </Field>
            <Field id="txtTPC" label="TPC">
              <TextInput id="txtTPC" readOnly value={main.tpc ?? ''} />
            </Field>
          </div>
        </div>
      </section>

      <section className={`zafira-card ${styles.section}`}>
        <h3 className={styles.sectionTitle}>Speed Data</h3>
        <div className={styles.sectionBody}>
          <div className={styles.tableWrap}>
            <table className={`zafira-data-table ${styles.table}`}>
              <thead>
                <tr>
                  <th />
                  <th className={styles.subHeader}>Full Speed</th>
                  <th className={styles.subHeader}>Service Speed</th>
                  <th className={styles.subHeader}>Most Eco Speed</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ballast Speed (Knots)</td>
                  <td><NumericInput value={speed.ballastFull} onChange={(value) => setSpeed((s) => ({ ...s, ballastFull: value }))} /></td>
                  <td><NumericInput value={speed.ballastService} onChange={(value) => setSpeed((s) => ({ ...s, ballastService: value }))} /></td>
                  <td><NumericInput value={speed.ballastEco} onChange={(value) => setSpeed((s) => ({ ...s, ballastEco: value }))} /></td>
                </tr>
                <tr>
                  <td>Laden Speed (Knots)</td>
                  <td><NumericInput value={speed.ladenFull} onChange={(value) => setSpeed((s) => ({ ...s, ladenFull: value }))} /></td>
                  <td><NumericInput value={speed.ladenService} onChange={(value) => setSpeed((s) => ({ ...s, ladenService: value }))} /></td>
                  <td><NumericInput value={speed.ladenEco} onChange={(value) => setSpeed((s) => ({ ...s, ladenEco: value }))} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={`zafira-card ${styles.section}`}>
        <h3 className={styles.sectionTitle}>Bunkers at Sea - Consumption(MT)/Day</h3>
        <div className={styles.sectionBody}>
          <div className={styles.tableWrap}>
            <table className={`zafira-data-table ${styles.table}`}>
              <thead>
                <tr>
                  <th />
                  <th />
                  <th />
                  <th colSpan={2} className={styles.groupHeader}>Full Speed</th>
                  <th colSpan={2} className={styles.groupHeader}>Service Speed</th>
                  <th colSpan={2} className={styles.groupHeader}>Most Eco Speed</th>
                </tr>
                <tr>
                  <th>#</th>
                  <th>Bunker</th>
                  <th>Zone</th>
                  <th className={styles.subHeader}>Ballast</th>
                  <th className={styles.subHeader}>Laden</th>
                  <th className={styles.subHeader}>Ballast</th>
                  <th className={styles.subHeader}>Laden</th>
                  <th className={styles.subHeader}>Ballast</th>
                  <th className={styles.subHeader}>Laden</th>
                </tr>
              </thead>
              <tbody>
                {bunkersAtSea.map((row, index) => (
                  <tr key={row.key}>
                    <td>
                      {bunkersAtSea.length > 1 ? (
                        <Button
                          type="button"
                          variant="outline"
                          label="Remove"
                          onClick={() => removeRow(setBunkersAtSea, index, bunkersAtSea)}
                        />
                      ) : null}
                    </td>
                    <td>
                      <BunkerSelect
                        row={row}
                        lookups={lookups}
                        onChange={(patch) => updateRow(setBunkersAtSea, index, patch)}
                      />
                    </td>
                    <td>
                      <ZoneSelect
                        row={row}
                        lookups={lookups}
                        onChange={(patch) => updateRow(setBunkersAtSea, index, patch)}
                      />
                    </td>
                    <td><NumericInput value={row.ballastFull} onChange={(value) => updateRow(setBunkersAtSea, index, { ballastFull: value })} /></td>
                    <td><NumericInput value={row.ladenFull} onChange={(value) => updateRow(setBunkersAtSea, index, { ladenFull: value })} /></td>
                    <td><NumericInput value={row.ballastService} onChange={(value) => updateRow(setBunkersAtSea, index, { ballastService: value })} /></td>
                    <td><NumericInput value={row.ladenService} onChange={(value) => updateRow(setBunkersAtSea, index, { ladenService: value })} /></td>
                    <td><NumericInput value={row.ballastEco} onChange={(value) => updateRow(setBunkersAtSea, index, { ballastEco: value })} /></td>
                    <td><NumericInput value={row.ladenEco} onChange={(value) => updateRow(setBunkersAtSea, index, { ladenEco: value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableActions}>
            <Button
              type="button"
              variant="outline"
              label="Add"
              onClick={() => setBunkersAtSea((rows) => [...rows, emptyAtSeaRow()])}
            />
          </div>
        </div>
      </section>

      <section className={`zafira-card ${styles.section}`}>
        <h3 className={styles.sectionTitle}>Bunkers in Port - Consumption(MT)/Day</h3>
        <div className={styles.sectionBody}>
          <div className={styles.tableWrap}>
            <table className={`zafira-data-table ${styles.table}`}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Bunker</th>
                  <th>Zone</th>
                  <th className={styles.subHeader}>Port Ldg + DeBall</th>
                  <th className={styles.subHeader}>Port Dis + IG/COW</th>
                  <th className={styles.subHeader}>Port Idle</th>
                  <th className={styles.subHeader}>Port Mnvr</th>
                </tr>
              </thead>
              <tbody>
                {bunkersInPort.map((row, index) => (
                  <tr key={row.key}>
                    <td>
                      {bunkersInPort.length > 1 ? (
                        <Button
                          type="button"
                          variant="outline"
                          label="Remove"
                          onClick={() => removeRow(setBunkersInPort, index, bunkersInPort)}
                        />
                      ) : null}
                    </td>
                    <td>
                      <BunkerSelect
                        row={row}
                        lookups={lookups}
                        onChange={(patch) => updateRow(setBunkersInPort, index, patch)}
                      />
                    </td>
                    <td>
                      <ZoneSelect
                        row={row}
                        lookups={lookups}
                        onChange={(patch) => updateRow(setBunkersInPort, index, patch)}
                      />
                    </td>
                    <td><NumericInput value={row.workingLp} onChange={(value) => updateRow(setBunkersInPort, index, { workingLp: value })} /></td>
                    <td><NumericInput value={row.workingDp} onChange={(value) => updateRow(setBunkersInPort, index, { workingDp: value })} /></td>
                    <td><NumericInput value={row.idleBallast} onChange={(value) => updateRow(setBunkersInPort, index, { idleBallast: value })} /></td>
                    <td><NumericInput value={row.idleLaden} onChange={(value) => updateRow(setBunkersInPort, index, { idleLaden: value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableActions}>
            <Button
              type="button"
              variant="outline"
              label="Add"
              onClick={() => setBunkersInPort((rows) => [...rows, emptyInPortRow()])}
            />
          </div>
        </div>
      </section>

      {showVarious ? (
        <section className={`zafira-card ${styles.section}`}>
          <h3 className={styles.sectionTitle}>Bunkers Various - Consumption(MT)/Day</h3>
          <div className={styles.sectionBody}>
            <div className={styles.tableWrap}>
              <table className={`zafira-data-table ${styles.table}`}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Bunker</th>
                    <th>Zone</th>
                    <th className={styles.subHeader}>Cold Wash</th>
                    <th className={styles.subHeader}>Hot Wash</th>
                    <th className={styles.subHeader}>Inert from Gas Free</th>
                    <th className={styles.subHeader}>Purge/Gas Free</th>
                    <th className={styles.subHeader}>Heating (Maintain)</th>
                    <th className={styles.subHeader}>Heating (Raise 3 Deg)</th>
                  </tr>
                </thead>
                <tbody>
                  {bunkersVarious.map((row, index) => (
                    <tr key={row.key}>
                      <td>
                        {bunkersVarious.length > 1 ? (
                          <Button
                            type="button"
                            variant="outline"
                            label="Remove"
                            onClick={() => removeRow(setBunkersVarious, index, bunkersVarious)}
                          />
                        ) : null}
                      </td>
                      <td>
                        <BunkerSelect
                          row={row}
                          lookups={lookups}
                          onChange={(patch) => updateRow(setBunkersVarious, index, patch)}
                        />
                      </td>
                      <td>
                        <ZoneSelect
                          row={row}
                          lookups={lookups}
                          onChange={(patch) => updateRow(setBunkersVarious, index, patch)}
                        />
                      </td>
                      <td><NumericInput value={row.coldWash} onChange={(value) => updateRow(setBunkersVarious, index, { coldWash: value })} /></td>
                      <td><NumericInput value={row.hotWash} onChange={(value) => updateRow(setBunkersVarious, index, { hotWash: value })} /></td>
                      <td><NumericInput value={row.inertGasFree} onChange={(value) => updateRow(setBunkersVarious, index, { inertGasFree: value })} /></td>
                      <td><NumericInput value={row.purgeGasFree} onChange={(value) => updateRow(setBunkersVarious, index, { purgeGasFree: value })} /></td>
                      <td><NumericInput value={row.heatingMaintain} onChange={(value) => updateRow(setBunkersVarious, index, { heatingMaintain: value })} /></td>
                      <td><NumericInput value={row.heatingRaise} onChange={(value) => updateRow(setBunkersVarious, index, { heatingRaise: value })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.tableActions}>
              <Button
                type="button"
                variant="outline"
                label="Add"
                onClick={() => setBunkersVarious((rows) => [...rows, emptyVariousRow()])}
              />
            </div>
          </div>
        </section>
      ) : null}

      <div className={styles.footerActions}>
        <Button type="button" variant="outline" label="Cancel" to={fleetPath} />
        <Button type="button" label="Submit" onClick={handleSubmit} disabled={loading || saving} />
      </div>
    </div>
  );
}
