import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../../packages/shared-ui/src/components/Button/Button.jsx';
import {
  WATER_DENSITY_OPTIONS,
  computeCargoLoadable,
} from './cargoLoadableCalculations.js';
import styles from './CargoLoadableModal.module.css';

function str(value) {
  return value == null ? '' : String(value);
}

/**
 * Cargo Loadable Calculation modal (legacy compose-modal_CalLoadable).
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   form: object,
 *   showStowage?: boolean,
 *   onApply: (cargoLoadable: string) => void,
 * }} props
 */
export default function CargoLoadableModal({
  open,
  onClose,
  form = {},
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
    setStowageCuM(str(form.stowageFactor || form.stowage || ''));
    // Seed once when opened — do not reset while parent form recalculates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-only seed
  }, [open]);

  const result = useMemo(
    () => computeCargoLoadable({
      mode,
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

  const handleApply = () => {
    const qty = str(result.cargoLoadable).trim();
    if (!qty || Number(qty) <= 0) return;
    onApply?.(qty);
    onClose?.();
  };

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
          <div className={styles.grid}>
            {showStowage ? (
              <div className={styles.modeRow}>
                <label className={styles.modeOption}>
                  <input
                    type="radio"
                    name="loadableMode"
                    checked={mode === 'draft'}
                    onChange={() => setMode('draft')}
                  />
                  Via Draft
                </label>
                <label className={styles.modeOption}>
                  <input
                    type="radio"
                    name="loadableMode"
                    checked={mode === 'stowage'}
                    onChange={() => setMode('stowage')}
                  />
                  Via Stowage
                </label>
              </div>
            ) : null}

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Port Max Draft (m)</span>
              <input
                type="text"
                inputMode="decimal"
                value={portMaxDraft}
                onChange={(e) => setPortMaxDraft(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Summer Draft (m)</span>
              <input
                type="text"
                inputMode="decimal"
                value={summerDraft}
                onChange={(e) => setSummerDraft(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Draft (m)</span>
              <input type="text" value={result.draftM} readOnly />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Summer DWT (MT)</span>
              <input
                type="text"
                inputMode="decimal"
                value={summerDwt}
                onChange={(e) => setSummerDwt(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>TPC</span>
              <input
                type="text"
                inputMode="decimal"
                value={tpc}
                onChange={(e) => setTpc(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Water Density</span>
              <select value={waterDensity} onChange={(e) => setWaterDensity(e.target.value)}>
                {WATER_DENSITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Constant (MT)</span>
              <input
                type="text"
                inputMode="decimal"
                value={constantMt}
                onChange={(e) => setConstantMt(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Bunkers (MT)</span>
              <input
                type="text"
                inputMode="decimal"
                value={bunkersMt}
                onChange={(e) => setBunkersMt(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>FW (MT)</span>
              <input
                type="text"
                inputMode="decimal"
                value={fwMt}
                onChange={(e) => setFwMt(e.target.value)}
              />
            </label>

            {showStowage && mode === 'stowage' ? (
              <>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Cubic Capacity</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cubicCap}
                    onChange={(e) => setCubicCap(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Stowage (cu.m / MT)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={stowageCuM}
                    onChange={(e) => setStowageCuM(e.target.value)}
                  />
                </label>
              </>
            ) : null}
          </div>

          <div className={styles.resultBanner}>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Observed Draft (m)</span>
              <span className={styles.resultValue}>{result.observedDraft || '—'}</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Observed DWT (MT)</span>
              <span className={styles.resultValue}>{result.observedDwt || '—'}</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Cargo Loadable (MT)</span>
              <span className={styles.resultValue}>{result.cargoLoadable || '—'}</span>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button type="button" variant="outline" label="Cancel" onClick={onClose} />
          <Button
            type="button"
            variant="accent"
            label="Apply"
            onClick={handleApply}
            disabled={!result.cargoLoadable || Number(result.cargoLoadable) <= 0}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
