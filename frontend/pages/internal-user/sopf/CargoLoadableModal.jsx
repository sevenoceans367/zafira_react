import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, CardSelect } from '@bainbridge/shared-ui';
import {
  WATER_DENSITY_OPTIONS,
  computeCargoLoadable,
  cuFtToCuM,
  cuMToCuFt,
} from './cargoLoadableCalculations.js';
import styles from './CargoLoadableModal.module.css';

function str(value) {
  return value == null ? '' : String(value);
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

/**
 * Cargo Loadable Calculation modal — PHP fields, app chrome (DistanceFetch-style).
 */
export default function CargoLoadableModal({
  open,
  onClose,
  form = {},
  context = {},
  showStowage = true,
  onApply,
}) {
  const [mode, setMode] = useState('draft');
  const [portMaxDraft, setPortMaxDraft] = useState('');
  const [summerDraft, setSummerDraft] = useState('');
  const [summerDwt, setSummerDwt] = useState('');
  const [tpc, setTpc] = useState('');
  const [constantMt, setConstantMt] = useState('');
  const [bunkersMt, setBunkersMt] = useState('');
  const [fwMt, setFwMt] = useState('');
  const [waterDensity, setWaterDensity] = useState('1.025');
  const [cubicCap, setCubicCap] = useState('');
  const [stowageCuM, setStowageCuM] = useState('');
  const [stowageCuFt, setStowageCuFt] = useState('');

  const portName = str(context.portName || '').trim() || '—';
  const vesselName = str(form.vesselName || '').trim() || '—';
  const cargoName = str(context.cargoName || '').trim() || '—';

  const densityOptions = useMemo(
    () => WATER_DENSITY_OPTIONS.map((opt) => ({ id: opt.value, name: opt.label })),
    [],
  );

  useEffect(() => {
    if (!open) return;
    setMode('draft');
    setPortMaxDraft('');
    setSummerDraft(str(form.draft || form.summerDraft || ''));
    setSummerDwt(str(form.dwtSummer || form.loadable || ''));
    setTpc(str(form.tpc || ''));
    setConstantMt(str(form.constant || form.vesselConstant || '0'));
    setBunkersMt('');
    setFwMt('');
    setWaterDensity('1.025');
    setCubicCap(str(form.grainCap || form.baleCap || form.cargoTankCap || ''));
    const sf = str(form.stowageFactor || form.stowage || '');
    setStowageCuM(sf);
    setStowageCuFt(cuMToCuFt(sf));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-only seed
  }, [open]);

  const result = useMemo(
    () => computeCargoLoadable({
      mode: showStowage ? mode : 'draft',
      portMaxDraft,
      summerDraft,
      summerDwt,
      tpc,
      constantMt,
      bunkersMt,
      fwMt,
      cubicCap,
      stowageCuM,
      waterDensity,
    }),
    [
      mode,
      showStowage,
      portMaxDraft,
      summerDraft,
      summerDwt,
      tpc,
      constantMt,
      bunkersMt,
      fwMt,
      cubicCap,
      stowageCuM,
      waterDensity,
    ],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleStowageCuM = (value) => {
    setStowageCuM(value);
    setStowageCuFt(cuMToCuFt(value));
  };

  const handleStowageCuFt = (value) => {
    setStowageCuFt(value);
    setStowageCuM(cuFtToCuM(value));
  };

  const handleSave = () => {
    const qty = str(result.cargoLoadable).trim();
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return;
    onApply?.(qty);
    onClose?.();
  };

  const stowageActive = showStowage && mode === 'stowage';
  const draftActive = !showStowage || mode === 'draft';

  return createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cargo-loadable-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="cargo-loadable-title" className={styles.title}>
            Cargo Loadable Calculation
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.columns}>
            <div>
              <section className={styles.section}>
                <p className={styles.sectionLabel}>Port</p>
                <div className={styles.sectionBody}>
                  <Field label="Port">
                    <input type="text" value={portName} readOnly title={portName} />
                  </Field>
                  <Field label="Port Max Draft (M)">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={portMaxDraft}
                      placeholder="0.00"
                      onChange={(e) => setPortMaxDraft(e.target.value)}
                    />
                  </Field>
                  <Field label="Water Density (kg/Cu.M)">
                    <div className={styles.cardSelect}>
                      <CardSelect
                        options={densityOptions}
                        value={waterDensity}
                        onChange={setWaterDensity}
                        placeholder="Water Density"
                        ariaLabel="Water Density"
                        align="start"
                      />
                    </div>
                  </Field>
                </div>
              </section>

              <section className={styles.section}>
                <p className={styles.sectionLabel}>Vessel</p>
                <div className={styles.sectionBody}>
                  <Field label="Vessel">
                    <input type="text" value={vesselName} readOnly title={vesselName} />
                  </Field>
                  <Field label="Summer DWT (MT)">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={summerDwt}
                      placeholder="0.00"
                      onChange={(e) => setSummerDwt(e.target.value)}
                    />
                  </Field>
                  <Field label="Summer Draft (M)">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={summerDraft}
                      placeholder="0.00"
                      onChange={(e) => setSummerDraft(e.target.value)}
                    />
                  </Field>
                  <Field label="TPC (Ts/CM)">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tpc}
                      placeholder="0.00"
                      onChange={(e) => setTpc(e.target.value)}
                    />
                  </Field>
                  <Field label="Cubic Cap (Cu.M)">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cubicCap}
                      placeholder="0.00"
                      onChange={(e) => setCubicCap(e.target.value)}
                    />
                  </Field>
                </div>
              </section>

              <section className={styles.section}>
                <p className={styles.sectionLabel}>Cargo</p>
                <div className={styles.sectionBody}>
                  <Field label="Cargo Name">
                    <input type="text" value={cargoName} readOnly title={cargoName} />
                  </Field>
                </div>
              </section>
            </div>

            <div>
              <section className={styles.section}>
                <p className={styles.sectionLabel}>Calculation Selection</p>
                <div className={`${styles.modeBlock} ${draftActive ? '' : styles.modeBlockInactive}`}>
                  <label className={styles.modeOption}>
                    <input
                      type="radio"
                      name="loadableMode"
                      checked={draftActive}
                      onChange={() => setMode('draft')}
                    />
                    Via Draft
                  </label>
                  <div className={styles.modeFields}>
                    <Field label="Draft (M)">
                      <input type="text" value={result.draftM || '0.00'} readOnly />
                    </Field>
                    <Field label="Constant (MT)">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={constantMt}
                        placeholder="0.00"
                        disabled={!draftActive}
                        onChange={(e) => setConstantMt(e.target.value)}
                      />
                    </Field>
                    <Field label="Bunkers on board (MT)">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={bunkersMt}
                        placeholder="0.00"
                        disabled={!draftActive}
                        onChange={(e) => setBunkersMt(e.target.value)}
                      />
                    </Field>
                    <Field label="FW (MT)">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={fwMt}
                        placeholder="0.00"
                        disabled={!draftActive}
                        onChange={(e) => setFwMt(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                {showStowage ? (
                  <div className={`${styles.modeBlock} ${stowageActive ? '' : styles.modeBlockInactive}`}>
                    <label className={styles.modeOption}>
                      <input
                        type="radio"
                        name="loadableMode"
                        checked={stowageActive}
                        onChange={() => setMode('stowage')}
                      />
                      Via Stowage Factor
                    </label>
                    <div className={styles.modeFields}>
                      <Field label="Stowage Factor (Cu.M/MT)">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={stowageCuM}
                          placeholder="0.00"
                          disabled={!stowageActive}
                          onChange={(e) => handleStowageCuM(e.target.value)}
                        />
                      </Field>
                      <Field label="Stowage Factor (Cu.Ft/MT)">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={stowageCuFt}
                          placeholder="0.00"
                          disabled={!stowageActive}
                          onChange={(e) => handleStowageCuFt(e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className={`${styles.section} ${styles.resultsSection}`}>
                <p className={styles.sectionLabel}>Cargo Results</p>
                <div className={styles.resultsBody}>
                  <div className={styles.resultRow}>
                    <span className={styles.resultLabel}>Observed DWT (MT)</span>
                    <span className={styles.resultValue}>{result.observedDwt || '0.00'}</span>
                  </div>
                  <div className={styles.resultRow}>
                    <span className={styles.resultLabel}>Cargo Loadable (MT)</span>
                    <span className={styles.resultValue}>{result.cargoLoadable || '0.00'}</span>
                  </div>
                  <div className={styles.resultRow}>
                    <span className={styles.resultLabel}>Observed Draft (M)</span>
                    <span className={styles.resultValue}>{result.observedDraft || '0.00'}</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button type="button" variant="outline" label="Close" onClick={onClose} />
          <Button
            type="button"
            variant="accent"
            label="Save changes"
            onClick={handleSave}
            disabled={!result.cargoLoadable || Number(result.cargoLoadable) <= 0}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
