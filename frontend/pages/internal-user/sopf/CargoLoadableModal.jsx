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

function SectionHead({ label, tone }) {
  return (
    <div className={`${styles.secHead} ${tone === 'blue' ? styles.secHeadBlue : ''} ${tone === 'results' ? styles.secHeadResults : ''}`}>
      <span className={styles.shLabel}>{label}</span>
      <span className={styles.shDash} aria-hidden="true" />
    </div>
  );
}

function CalcIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2.5" />
      <path d="M8 6h8" />
      <path d="M8 11h0.01" />
      <path d="M12 11h0.01" />
      <path d="M16 11h0.01" />
      <path d="M8 15h0.01" />
      <path d="M12 15h0.01" />
      <path d="M16 15h0.01" />
      <path d="M8 19h0.01" />
      <path d="M12 19h0.01" />
      <path d="M16 19h0.01" />
    </svg>
  );
}

/**
 * Cargo Loadable Calculations modal — PHP fields, mockup two-column layout.
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
          <div className={styles.headerLeft}>
            <div className={styles.modalIcon} aria-hidden="true">
              <CalcIcon />
            </div>
            <h2 id="cargo-loadable-title" className={styles.title}>
              Cargo Loadable Calculations
            </h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.columns}>
            <div className={styles.col}>
              <SectionHead label="Port Details" />
              <div className={styles.row1}>
                <Field label="Port">
                  <input type="text" value={portName} readOnly title={portName} />
                </Field>
              </div>
              <div className={styles.row2}>
                <Field label="Port Max Draft (M)">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={portMaxDraft}
                    placeholder="0.00"
                    onChange={(e) => setPortMaxDraft(e.target.value)}
                  />
                </Field>
                <Field label="Water Density (KG/CU.M)">
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

              <SectionHead label="Vessel Details" />
              <div className={styles.row1}>
                <Field label="Vessel">
                  <input type="text" value={vesselName} readOnly title={vesselName} />
                </Field>
              </div>
              <div className={styles.row2}>
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
              </div>
              <div className={styles.row2}>
                <Field label="TPC (TS/CM)">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tpc}
                    placeholder="0.00"
                    onChange={(e) => setTpc(e.target.value)}
                  />
                </Field>
                <Field label="Cubic Cap (CU.M)">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cubicCap}
                    placeholder="0.00"
                    onChange={(e) => setCubicCap(e.target.value)}
                  />
                </Field>
              </div>

              <SectionHead label="Cargo Details" />
              <div className={styles.row1}>
                <Field label="Name">
                  <input type="text" value={cargoName} readOnly title={cargoName} />
                </Field>
              </div>
            </div>

            <div className={styles.col}>
              <SectionHead label="Calculation Selection" tone="blue" />

              {showStowage ? (
                <div
                  className={`${styles.calcToggle} ${stowageActive ? styles.calcToggleStowage : ''}`}
                  role="tablist"
                  aria-label="Calculation mode"
                >
                  <div className={styles.calcToggleThumb} aria-hidden="true" />
                  <button
                    type="button"
                    role="tab"
                    aria-selected={draftActive}
                    className={`${styles.calcToggleOpt} ${draftActive ? styles.calcToggleOptActive : ''}`}
                    onClick={() => setMode('draft')}
                  >
                    Via Draft
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={stowageActive}
                    className={`${styles.calcToggleOpt} ${stowageActive ? styles.calcToggleOptActive : ''}`}
                    onClick={() => setMode('stowage')}
                  >
                    Via Stowage Factor
                  </button>
                </div>
              ) : null}

              {draftActive ? (
                <div className={styles.calcFields}>
                  <div className={styles.row2}>
                    <Field label="Draft (M)">
                      <input type="text" value={result.draftM || '0.00'} readOnly />
                    </Field>
                    <Field label="Constant (MT)">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={constantMt}
                        placeholder="0.00"
                        onChange={(e) => setConstantMt(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className={styles.row2}>
                    <Field label="Bunkers on Board (MT)">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={bunkersMt}
                        placeholder="0.00"
                        onChange={(e) => setBunkersMt(e.target.value)}
                      />
                    </Field>
                    <Field label="FW (MT)">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={fwMt}
                        placeholder="0.00"
                        onChange={(e) => setFwMt(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {stowageActive ? (
                <div className={styles.calcFields}>
                  <div className={styles.row2}>
                    <Field label="Stowage Factor (CU.M/MT)">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={stowageCuM}
                        placeholder="0.00"
                        onChange={(e) => handleStowageCuM(e.target.value)}
                      />
                    </Field>
                    <Field label="Stowage Factor (CU.FT/MT)">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={stowageCuFt}
                        placeholder="0.00"
                        onChange={(e) => handleStowageCuFt(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              <SectionHead label="Cargo Results" tone="results" />
              <div className={styles.crPanel}>
                <div className={styles.crRow}>
                  <span className={styles.crLabel}>Observed DWT (MT)</span>
                  <span className={styles.crValue}>{result.observedDwt || '0.00'}</span>
                </div>
                <div className={styles.crRow}>
                  <span className={styles.crLabel}>Cargo Loadable (MT)</span>
                  <span className={styles.crValue}>{result.cargoLoadable || '0.00'}</span>
                </div>
                <div className={styles.crRow}>
                  <span className={styles.crLabel}>Observed Draft (M)</span>
                  <span className={styles.crValue}>{result.observedDraft || '0.00'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button type="button" variant="outline" label="Cancel" onClick={onClose} />
          <Button
            type="button"
            variant="accent"
            label="Save"
            onClick={handleSave}
            disabled={!result.cargoLoadable || Number(result.cargoLoadable) <= 0}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
