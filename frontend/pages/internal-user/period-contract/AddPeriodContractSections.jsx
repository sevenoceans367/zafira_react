import React, { useEffect, useRef, useState } from 'react';
import {
  AttachmentDropzone,
  CardSelect,
  DmyDateInput,
  RowAddButton,
  RowDelButton,
} from '@bainbridge/shared-ui';
import PortSearchSelect from './PortSearchSelect.jsx';
import {
  EMPTY_BUNKER_ROW,
  EMPTY_DELIVERY_NOTICE,
  EMPTY_HIRE_RATE,
  EMPTY_OFF_HIRE,
  EMPTY_OFF_HIRE_BUNKER,
} from './addPeriodContract.constants.js';
import { recalcBunkerRows } from './periodContractCalculations.js';
import styles from './AddPeriodContractPage.module.css';

function toSelectOptions(items = [], { idKey = 'id', nameKey = 'name', labelKey = 'label' } = {}) {
  return items.map((item) => ({
    id: String(item[idKey] ?? ''),
    name: item[nameKey] ?? item[labelKey] ?? '',
  }));
}

function Field({ label, children, required = false, className = '', hint = '' }) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label>
        {label}
        {required ? <span className={styles.required}>*</span> : null}
      </label>
      {children}
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </div>
  );
}

function ThemedCardSelect({
  value,
  options = [],
  onChange,
  label,
  placeholder = '----Select From List----',
  required = false,
  disabled = false,
  className = '',
}) {
  return (
    <div className={[styles.cardSelect, className].filter(Boolean).join(' ')}>
      {required ? (
        <input
          className={styles.requiredMirror}
          value={value || ''}
          required
          tabIndex={-1}
          aria-hidden
          readOnly
        />
      ) : null}
      <CardSelect
        value={value || ''}
        options={options}
        placeholder={placeholder}
        ariaLabel={label || placeholder}
        align="start"
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

const GRADE_CHIP_PALETTE = [
  styles.chipGradeVlsfo,
  styles.chipGradeLsmgo,
  styles.chipGradeHsfo,
  styles.chipGradeHsflo,
  styles.chipGradeScrubber,
  styles.chipGradeAltGreen,
  styles.chipGradeAltOrange,
  styles.chipGradeAltCyan,
];

function hashGradeName(name) {
  const str = String(name || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function gradeSelectClass(name) {
  const upper = String(name || '').toUpperCase().replace(/\s+/g, '');
  if (!upper) return '';
  if (upper.includes('VLSFO') || upper.includes('VLS')) return styles.chipGradeVlsfo;
  if (upper.includes('LSMGO')) return styles.chipGradeLsmgo;
  if (upper.includes('MGO') || upper.includes('MDO')) return styles.chipGradeHsflo;
  if (upper.includes('SCRUB')) return styles.chipGradeScrubber;
  if (upper.includes('HSFLO') || upper.includes('HSF-LO') || upper.includes('HSF_LO')) {
    return styles.chipGradeHsflo;
  }
  if (upper.includes('HSFO') || upper.includes('IFO') || upper.includes('HFO')) {
    return styles.chipGradeHsfo;
  }
  return GRADE_CHIP_PALETTE[hashGradeName(upper) % GRADE_CHIP_PALETTE.length];
}

function bunkerGradeName(bunkers, gradeId) {
  return bunkers.find((item) => String(item.id) === String(gradeId))?.name || '';
}

function managerOptions(lookups, currentValue) {
  const source = lookups?.managerVendors?.length ? lookups.managerVendors : lookups?.ownerVendors;
  const options = toSelectOptions(source);
  const id = String(currentValue || '');
  if (id && !options.some((item) => item.id === id)) {
    options.unshift({ id, name: id });
  }
  return options;
}

function KhakiRowActions({ onAdd, onRemove, removeDisabled = false, addTitle = 'Add', removeTitle = 'Delete row' }) {
  return (
    <div className={styles.khakiRowActions}>
      <RowAddButton
        title={addTitle}
        onClick={onAdd}
        disabled={!onAdd}
        style={!onAdd ? { visibility: 'hidden' } : undefined}
      />
      <RowDelButton title={removeTitle} disabled={removeDisabled} onClick={onRemove} />
    </div>
  );
}

function CircleDelButton({ title, disabled = false, onClick }) {
  return (
    <RowDelButton
      className={styles.circleDel}
      title={title}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

function SubLabel({ children, first = false, mustard = false }) {
  return (
    <div className={[
      styles.subLabel,
      first ? styles.subLabelFirst : '',
      mustard ? styles.subLabelMustard : '',
    ].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

function PeriodCard({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`${styles.estCard} ${open ? styles.estCardOpen : ''}`}>
      <button
        type="button"
        className={styles.estSummary}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <svg
          className={styles.smChev}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        {icon}
        {title}
      </button>
      <div className={open ? styles.estBody : styles.estBodyHidden} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

function hireAmount(row) {
  const days = Number(row?.hireDays);
  const rate = Number(row?.hireRate);
  if (!Number.isFinite(days) || !Number.isFinite(rate)) return '';
  return (days * rate).toFixed(2);
}

function IdentifiersIcon() {
  return (
    <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <circle cx="8.5" cy="11" r="1.8" />
      <path d="M6 16c0-1.7 1.2-2.8 2.5-2.8s2.5 1.1 2.5 2.8" />
      <path d="M13.5 9.5h4M13.5 12.5h4" />
    </svg>
  );
}

function CpIcon() {
  return (
    <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h7l4 4v13H7z" />
      <path d="M14 3.5v4h4" />
      <path d="M9.5 12h5M9.5 15h5M9.5 9h2" />
    </svg>
  );
}

function PeriodIcon() {
  return (
    <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v10" />
      <path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 3 6 1.4 6 4.4 0 1.4-1.3 2.5-3 2.5s-3-1.1-3-2.5" />
    </svg>
  );
}

function HireIcon() {
  return (
    <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h10v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4z" />
      <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
    </svg>
  );
}

function BunkersIcon() {
  return (
    <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 12.5V7a4 4 0 0 1 8 0v9a2.5 2.5 0 0 1-5 0V8.5" />
    </svg>
  );
}

function RecapIdentifiersPanel({
  form,
  lookups,
  vesselTypes,
  vessels,
  updateField,
  setForm,
  disabled,
}) {
  return (
    <PeriodCard title="Recap Identifiers" defaultOpen icon={<IdentifiersIcon />}>
      <div className={styles.identGrid}>
        <Field label="Contract ID">
          <input type="text" value={form.contractId} readOnly />
        </Field>
        <Field label="Vessel" required>
          <ThemedCardSelect
            label="Vessel"
            value={form.vesselImoId}
            required
            disabled={disabled}
            options={toSelectOptions(vessels)}
            onChange={(value) => updateField('vesselImoId', value)}
          />
        </Field>
        <Field label="Vessel Type" required>
          <ThemedCardSelect
            label="Vessel Type"
            value={form.vesselType}
            required
            disabled={disabled}
            options={toSelectOptions(vesselTypes)}
            onChange={(value) => updateField('vesselType', value)}
          />
        </Field>
        <Field label="CP Date" required>
          <DmyDateInput
            value={form.contractDate}
            required
            disabled={disabled}
            onChange={(value) => updateField('contractDate', value)}
          />
        </Field>
        <Field label="Owner" required>
          <ThemedCardSelect
            label="Owner"
            value={form.owner}
            required
            disabled={disabled}
            options={toSelectOptions(lookups?.ownerVendors)}
            onChange={(value) => updateField('owner', value)}
          />
        </Field>
        <Field label="Disponent Owner" required>
          <ThemedCardSelect
            label="Disponent Owner"
            value={form.disOwner}
            required
            disabled={disabled}
            options={toSelectOptions(lookups?.ownerVendors)}
            onChange={(value) => updateField('disOwner', value)}
          />
        </Field>
        <Field label="Charterer">
          <ThemedCardSelect
            label="Charterer"
            value={form.charterer}
            disabled={disabled}
            options={toSelectOptions(lookups?.charterers)}
            onChange={(value) => {
              const selected = (lookups?.charterers || []).find((item) => String(item.id) === String(value));
              setForm((current) => ({
                ...current,
                charterer: value,
                charterersAddress: selected?.address || '',
              }));
            }}
          />
        </Field>
        <Field label="Manager" required>
          <ThemedCardSelect
            label="Manager"
            value={form.manager}
            required
            disabled={disabled}
            options={managerOptions(lookups, form.manager)}
            onChange={(value) => updateField('manager', value)}
          />
        </Field>
        <Field label="Broker" required>
          <ThemedCardSelect
            label="Broker"
            value={form.broker}
            required
            disabled={disabled}
            options={toSelectOptions(lookups?.brokerVendors)}
            onChange={(value) => updateField('broker', value)}
          />
        </Field>
        <Field label="Chartering Team">
          <ThemedCardSelect
            label="Chartering Team"
            value={form.charteringTeam}
            disabled={disabled}
            options={toSelectOptions(lookups?.charteringTeams)}
            onChange={(value) => updateField('charteringTeam', value)}
          />
        </Field>
        <Field label="Chartering PIC">
          <ThemedCardSelect
            label="Chartering PIC"
            value={form.charteringPic}
            disabled={disabled}
            options={toSelectOptions(lookups?.charteringPics)}
            onChange={(value) => {
              setForm((current) => ({
                ...current,
                charteringPic: value,
                opsPic: value,
              }));
            }}
          />
        </Field>
        <Field label="Ops PIC">
          <ThemedCardSelect
            label="Ops PIC"
            value={form.opsPic}
            disabled={disabled}
            options={toSelectOptions(lookups?.charteringPics)}
            onChange={(value) => updateField('opsPic', value)}
          />
        </Field>
      </div>
    </PeriodCard>
  );
}

function CpInformationPanel({ form, lookups, updateField, disabled }) {
  return (
    <PeriodCard title="CP Information" icon={<CpIcon />}>
      <div className={styles.cpInfoGrid}>
        <Field label="CP Type">
          <ThemedCardSelect
            label="CP Type"
            value={form.cpType}
            disabled={disabled}
            placeholder="Select CP type"
            options={toSelectOptions(lookups?.cpTypes)}
            onChange={(value) => updateField('cpType', value)}
          />
        </Field>
        <Field label="Law / Arbitration">
          <ThemedCardSelect
            label="Law / Arbitration"
            value={form.lawArbit}
            disabled={disabled}
            options={toSelectOptions(lookups?.lawArbitration)}
            onChange={(value) => updateField('lawArbit', value)}
          />
        </Field>
        <Field label="Charterers' Address" className={styles.fieldSpan2} hint="Display from master data">
          <input
            type="text"
            value={form.charterersAddress}
            disabled
            readOnly
          />
        </Field>
      </div>
    </PeriodCard>
  );
}

function PeriodDetailsPanel({
  form,
  lookups,
  periodUnit,
  updateField,
  updateForm,
  setError,
  disabled,
}) {
  const notices = form.deliveryNotices || [];

  return (
    <PeriodCard title="Period Details" defaultOpen icon={<PeriodIcon />}>
      <SubLabel first>Terms</SubLabel>
      <div className={styles.termsGrid}>
        <Field label="Laycan Start" required className={styles.fieldWide}>
          <DmyDateInput
            value={form.laycanStart}
            required
            disabled={disabled}
            onChange={(value) => updateField('laycanStart', value)}
          />
        </Field>
        <Field label="Laycan End" required className={styles.fieldWide}>
          <DmyDateInput
            value={form.laycanEnd}
            required
            disabled={disabled}
            onChange={(value) => updateField('laycanEnd', value)}
          />
        </Field>
        <Field label="AD Comm (%)">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={form.addComm}
            disabled={disabled}
            onChange={(e) => updateField('addComm', e.target.value)}
          />
        </Field>
        <Field label="Brokerage (%)">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={form.brokerage}
            disabled={disabled}
            onChange={(e) => updateField('brokerage', e.target.value)}
          />
        </Field>
        <Field label="Hire Currency" required>
          <ThemedCardSelect
            label="Hire Currency"
            value={form.currency}
            required
            disabled={disabled}
            options={toSelectOptions(lookups?.currencies)}
            onChange={(value) => updateField('currency', value)}
          />
        </Field>
        <Field label="Initial Hire" required>
          <input
            type="text"
            inputMode="decimal"
            value={form.hire}
            required
            disabled={disabled}
            onChange={(e) => updateField('hire', e.target.value)}
          />
        </Field>
      </div>

      <div className={styles.termsGrid}>
        <Field label="Remarks (Hire)" className={styles.fieldRemarks}>
          <input
            type="text"
            value={form.hireRemarks}
            disabled={disabled}
            onChange={(e) => updateField('hireRemarks', e.target.value)}
          />
        </Field>
        <Field label="Del Port/Range" required className={styles.fieldWide}>
          <PortSearchSelect
            value={form.delPort}
            label={form.delPortLabel}
            required
            disabled={disabled}
            onChange={(id, name) => {
              updateField('delPort', id);
              updateField('delPortLabel', name);
            }}
          />
        </Field>
        <Field label="Del Date" required>
          <DmyDateInput
            value={form.deliveryDate}
            required
            disabled={disabled}
            onChange={(value) => updateField('deliveryDate', value)}
          />
        </Field>
        <Field label="Time Period Unit" required>
          <ThemedCardSelect
            label="Time Period Unit"
            value={form.periodType}
            required
            disabled={disabled}
            options={toSelectOptions(lookups?.periodTypes)}
            onChange={(value) => updateField('periodType', value)}
          />
        </Field>
        <Field
          label={periodUnit ? `Time Period Minimum (${periodUnit})` : 'Time Period Minimum'}
          hint="Calculated from Del Date and Redel Date Min"
        >
          <input
            type="text"
            inputMode="decimal"
            value={form.periodMin}
            readOnly
          />
        </Field>
        <Field
          label={periodUnit ? `Time Period Maximum (${periodUnit})` : 'Time Period Maximum'}
          hint="Calculated from Del Date and Redel Date Max"
        >
          <input
            type="text"
            inputMode="decimal"
            value={form.periodMax}
            readOnly
          />
        </Field>
      </div>

      <div className={styles.termsGrid}>
        <Field label="Re-Del Port/Range" className={styles.fieldWide}>
          <PortSearchSelect
            value={form.reDelPort}
            label={form.reDelPortLabel}
            disabled={disabled}
            onChange={(id, name) => {
              updateField('reDelPort', id);
              updateField('reDelPortLabel', name);
            }}
          />
        </Field>
        <Field label="Redel Date Min" required>
          <DmyDateInput
            value={form.reDelMinDate}
            required
            disabled={disabled}
            onChange={(value) => updateField('reDelMinDate', value)}
          />
        </Field>
        <Field label="Redel Date Max" required>
          <DmyDateInput
            value={form.reDelMaxDate}
            required
            disabled={disabled}
            onChange={(value) => updateField('reDelMaxDate', value)}
          />
        </Field>
        <Field label="Voyage Days Fixed Until">
          <DmyDateInput
            value={form.voyageDaysPerformed}
            disabled={disabled}
            onChange={(value) => updateField('voyageDaysPerformed', value)}
          />
        </Field>
        <Field label="Redelivery Range" required className={styles.fieldWide}>
          <input
            type="text"
            value={form.redelRange}
            required
            disabled={disabled}
            onChange={(e) => updateField('redelRange', e.target.value)}
          />
        </Field>
      </div>

      <SubLabel>Redelivery Notice</SubLabel>
      <div className={styles.subCard}>
        <div className={styles.tableWrap}>
          <table className={styles.miniTable}>
            <thead>
              <tr>
                <th className={styles.noticeDesc}>Description</th>
                <th className={styles.noticeDate}>Notice Date</th>
                {!disabled ? <th className={styles.actCol} /> : null}
              </tr>
            </thead>
            <tbody>
              {notices.map((row, index) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        placeholder="e.g. 90 days notice"
                        value={row.notice}
                        disabled={disabled}
                        onChange={(e) => {
                          const deliveryNotices = [...notices];
                          deliveryNotices[index] = { ...row, notice: e.target.value };
                          updateForm({ ...form, deliveryNotices });
                        }}
                      />
                    </td>
                    <td>
                      <DmyDateInput
                        enableTime
                        value={row.dateTime}
                        disabled={disabled}
                        onChange={(value) => {
                          const deliveryNotices = [...notices];
                          deliveryNotices[index] = { ...row, dateTime: value };
                          updateForm({ ...form, deliveryNotices });
                        }}
                      />
                    </td>
                    {!disabled ? (
                      <td className={styles.actCol}>
                        <KhakiRowActions
                          removeDisabled={notices.length <= 1}
                          onRemove={() => updateForm({
                            ...form,
                            deliveryNotices: notices.filter((item) => item.id !== row.id),
                          })}
                        />
                      </td>
                    ) : null}
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!disabled ? (
        <button
          type="button"
          className={styles.addRowBtn}
          onClick={() => {
            const last = notices[notices.length - 1];
            if (!last?.notice || !last?.dateTime) {
              setError('Please fill the previous notice row before adding another.');
              return;
            }
            setError('');
            updateForm({
              ...form,
              deliveryNotices: [...notices, EMPTY_DELIVERY_NOTICE()],
            });
          }}
        >
          <span className={styles.plus}>+</span> Add Notice
        </button>
      ) : null}
    </PeriodCard>
  );
}

function HirePanel({ form, bunkers = [], defaultGradeId = '', updateForm, setError, disabled }) {
  const hireRates = form.hireRates || [];
  const offHires = form.offHires || [];
  const latestHireRate = [...hireRates]
    .map((row) => String(row.hireRate ?? '').trim())
    .filter(Boolean)
    .at(-1) || '';
  const [masterRate, setMasterRate] = useState('');
  const [masterTouched, setMasterTouched] = useState(false);
  const manualOffHireRatesRef = useRef(new Set());
  const displayedMaster = masterTouched ? masterRate : (latestHireRate || masterRate);

  useEffect(() => {
    if (masterTouched || !latestHireRate) return undefined;
    setMasterRate(latestHireRate);
    updateForm((current) => {
      const rows = current.offHires || [];
      const skipped = manualOffHireRatesRef.current;
      const nextRows = rows.map((row) => (
        skipped.has(row.id) ? row : { ...row, rate: latestHireRate }
      ));
      if (nextRows.every((row, index) => row === rows[index])) {
        return current;
      }
      return { ...current, offHires: nextRows };
    });
    return undefined;
  }, [latestHireRate, masterTouched, updateForm]);

  const patchOffHire = (offIndex, patch) => {
    const next = [...offHires];
    next[offIndex] = { ...offHires[offIndex], ...patch };
    updateForm({ ...form, offHires: next });
  };

  return (
    <PeriodCard title="Hire" defaultOpen icon={<HireIcon />}>
      <div className={`${styles.subCard} ${styles.subCardSpaced}`}>
        <div className={styles.tableWrap}>
          <table className={styles.miniTable}>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Hire ($/day)</th>
                <th>Hire Amount ($)</th>
                <th>Remarks</th>
                {!disabled ? <th className={styles.actCol} /> : null}
              </tr>
            </thead>
            <tbody>
              {hireRates.map((row, index) => {
                const isLast = index === hireRates.length - 1;
                return (
                  <tr key={row.id}>
                    <td>
                      <DmyDateInput
                        enableTime
                        value={row.hireFrom}
                        disabled={disabled}
                        onChange={(value) => {
                          const next = [...hireRates];
                          next[index] = { ...row, hireFrom: value };
                          updateForm({ ...form, hireRates: next });
                        }}
                      />
                    </td>
                    <td>
                      <DmyDateInput
                        enableTime
                        value={row.hireTo}
                        disabled={disabled}
                        onChange={(value) => {
                          const next = [...hireRates];
                          next[index] = { ...row, hireTo: value };
                          updateForm({ ...form, hireRates: next });
                        }}
                      />
                    </td>
                    <td><input type="text" value={row.hireDays} readOnly /></td>
                    <td>
                      <input
                        type="text"
                        placeholder="0.00"
                        value={row.hireRate}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = [...hireRates];
                          next[index] = { ...row, hireRate: e.target.value };
                          updateForm({ ...form, hireRates: next });
                        }}
                      />
                    </td>
                    <td><input type="text" value={hireAmount(row)} readOnly /></td>
                    <td>
                      <input
                        type="text"
                        value={row.remarks}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = [...hireRates];
                          next[index] = { ...row, remarks: e.target.value };
                          updateForm({ ...form, hireRates: next });
                        }}
                      />
                    </td>
                    {!disabled ? (
                      <td className={styles.actCol}>
                        <KhakiRowActions
                          onAdd={isLast ? () => {
                            const last = hireRates[hireRates.length - 1];
                            if (!last?.hireFrom || !last?.hireTo) {
                              setError('Please fill the previous hire row before adding another.');
                              return;
                            }
                            setError('');
                            updateForm({
                              ...form,
                              hireRates: [...hireRates, EMPTY_HIRE_RATE()],
                            });
                          } : undefined}
                          addTitle="Add a new hire period"
                          removeDisabled={hireRates.length <= 1}
                          onRemove={() => updateForm({
                            ...form,
                            hireRates: hireRates.filter((item) => item.id !== row.id),
                          })}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.totalBar}>
          <span className={styles.totalBarLabel}>Total Days</span>
          <span className={styles.totalBarVal}>
            {hireRates.reduce((sum, row) => sum + (Number(row.hireDays) || 0), 0).toFixed(1)}
          </span>
          <span className={styles.totalBarLabel}>Total Hire Amount ($)</span>
          <span className={styles.totalBarVal}>
            {hireRates.reduce((sum, row) => sum + (Number(hireAmount(row)) || 0), 0).toFixed(2)}
          </span>
        </div>
      </div>

      <div className={styles.offHireSection}>
        <div className={styles.ohSecHead}>
          <div className={styles.ohChip}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            Off Hire
          </div>
        </div>

        <div className={styles.offHireList}>
          {offHires.map((offHire, offIndex) => (
            <div key={offHire.id} className={`${styles.offHireItem} ${styles.subCard}`}>
              <div className={styles.tableWrap}>
                <table className={`${styles.miniTable} ${styles.offHireMain}`}>
                  <thead>
                    <tr>
                      <th>Reason</th>
                      <th>From → To</th>
                      <th>Days</th>
                      <th>Rate/Day</th>
                      <th>Off Hire Amount ($)</th>
                      {!disabled ? <th className={styles.circleActCol} /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <input
                          type="text"
                          placeholder="Description"
                          value={offHire.reason}
                          disabled={disabled}
                          onChange={(e) => patchOffHire(offIndex, { reason: e.target.value })}
                        />
                      </td>
                      <td>
                        <div className={styles.fromToCell}>
                          <DmyDateInput
                            enableTime
                            value={offHire.from}
                            disabled={disabled}
                            onChange={(value) => patchOffHire(offIndex, { from: value })}
                          />
                          <span className={styles.fromToArrow} aria-hidden>→</span>
                          <DmyDateInput
                            enableTime
                            value={offHire.to}
                            disabled={disabled}
                            onChange={(value) => patchOffHire(offIndex, { to: value })}
                          />
                        </div>
                      </td>
                      <td><input type="text" value={offHire.days} readOnly /></td>
                      <td>
                        <input
                          type="text"
                          value={offHire.rate}
                          disabled={disabled}
                          onChange={(e) => {
                            manualOffHireRatesRef.current.add(offHire.id);
                            patchOffHire(offIndex, { rate: e.target.value });
                          }}
                        />
                      </td>
                      <td><input type="text" value={offHire.amount} readOnly /></td>
                      {!disabled ? (
                        <td className={styles.circleActCol}>
                          <CircleDelButton
                            title="Delete this off-hire item"
                            disabled={offHires.length <= 1}
                            onClick={() => updateForm({
                              ...form,
                              offHires: offHires.filter((item) => item.id !== offHire.id),
                            })}
                          />
                        </td>
                      ) : null}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={styles.offHireBunkers}>
                <div className={styles.ohBunkerTitle}>Off-Hire Bunkers</div>
                <div className={styles.tableWrap}>
                  <table className={`${styles.miniTable} ${styles.offHireBunkerTable}`}>
                    <thead>
                      <tr>
                        <th>Grade</th>
                        <th>Qty (MT)</th>
                        <th>Price (MT)</th>
                        <th>Amount ($)</th>
                        <th className={styles.ownAcctCell}>On Owner&apos;s A/C</th>
                        {!disabled ? <th className={styles.circleActCol} /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {offHire.bunkers.map((bunker, bunkerIndex) => {
                        const patchBunker = (patch) => {
                          const nextBunkers = [...offHire.bunkers];
                          nextBunkers[bunkerIndex] = { ...bunker, ...patch };
                          patchOffHire(offIndex, { bunkers: nextBunkers });
                        };
                        return (
                          <tr key={bunker.id}>
                            <td>
                              <ThemedCardSelect
                                label="Bunker Grade"
                                value={bunker.gradeId}
                                disabled={disabled}
                                className={gradeSelectClass(bunkerGradeName(bunkers, bunker.gradeId))}
                                options={toSelectOptions(bunkers)}
                                onChange={(value) => patchBunker({ gradeId: value })}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                placeholder="0.00"
                                value={bunker.qty}
                                disabled={disabled}
                                onChange={(e) => patchBunker({ qty: e.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                placeholder="0.00"
                                value={bunker.price}
                                disabled={disabled}
                                onChange={(e) => patchBunker({ price: e.target.value })}
                              />
                            </td>
                            <td><input type="text" value={bunker.amount} readOnly /></td>
                            <td className={styles.ownAcctCell}>
                              <label className={styles.ownToggle}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(bunker.ownerAccount)}
                                  disabled={disabled}
                                  onChange={(e) => patchBunker({ ownerAccount: e.target.checked })}
                                />
                                <span className={styles.ownTrack} />
                              </label>
                            </td>
                            {!disabled ? (
                              <td className={styles.circleActCol}>
                                <CircleDelButton
                                  title="Remove bunker item"
                                  disabled={offHire.bunkers.length <= 1}
                                  onClick={() => patchOffHire(offIndex, {
                                    bunkers: offHire.bunkers.filter((item) => item.id !== bunker.id),
                                  })}
                                />
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!disabled ? (
                  <button
                    type="button"
                    className={`${styles.addRowBtn} ${styles.addBunkersBtn}`}
                    onClick={() => {
                      const last = offHire.bunkers[offHire.bunkers.length - 1];
                      if (!last?.gradeId || !last?.qty || !last?.price) {
                        setError('Please fill the previous off-hire bunker row before adding another.');
                        return;
                      }
                      setError('');
                      patchOffHire(offIndex, {
                        bunkers: [...offHire.bunkers, { ...EMPTY_OFF_HIRE_BUNKER(), gradeId: defaultGradeId }],
                      });
                    }}
                  >
                    <span className={styles.plus}>+</span> Add Bunkers
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.totalBar}>
          <span className={styles.totalBarLabel}>Total Off-Hire Days</span>
          <span className={styles.totalBarVal}>
            {offHires.reduce((sum, row) => sum + (Number(row.days) || 0), 0).toFixed(1)}
          </span>
          <span className={styles.totalBarLabel}>Total Off-Hire Amount ($)</span>
          <span className={styles.totalBarVal}>
            {offHires.reduce((sum, row) => sum + (Number(row.amount) || 0), 0).toFixed(2)}
          </span>
        </div>
        {!disabled ? (
          <button
            type="button"
            className={styles.addRowBtn}
            onClick={() => {
              const last = offHires[offHires.length - 1];
              if (!last?.reason || ((!last?.from || !last?.to) && !last?.days)) {
                setError('Please fill the previous off-hire row before adding another.');
                return;
              }
              setError('');
              updateForm({
                ...form,
                offHires: [...offHires, {
                  ...EMPTY_OFF_HIRE(),
                  rate: displayedMaster,
                  bunkers: [{ ...EMPTY_OFF_HIRE_BUNKER(), gradeId: defaultGradeId }],
                }],
              });
            }}
          >
            <span className={styles.plus}>+</span> Add Reason
          </button>
        ) : null}
      </div>
    </PeriodCard>
  );
}

function BunkerTable({ rows, bunkers, total, disabled, onChange, onAdd }) {
  const updateRow = (index, patch) => {
    const nextRows = [...rows];
    nextRows[index] = { ...nextRows[index], ...patch };
    onChange(nextRows);
  };

  return (
    <>
      <div className={`${styles.subCard} ${styles.subCardMustard}`}>
        <div className={styles.tableWrap}>
          <table className={styles.miniTable}>
            <thead>
              <tr>
                <th>Bunker Grade</th>
                <th>Qty (MT)</th>
                <th>Price (MT)</th>
                <th>Bunker Date</th>
                <th>Amount ($)</th>
                {!disabled ? <th className={styles.actCol} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isLast = index === rows.length - 1;
                return (
                  <tr key={row.id}>
                    <td>
                      <ThemedCardSelect
                        label="Bunker Grade"
                        value={row.gradeId}
                        disabled={disabled}
                        className={gradeSelectClass(bunkerGradeName(bunkers, row.gradeId))}
                        options={toSelectOptions(bunkers)}
                        onChange={(value) => updateRow(index, { gradeId: value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="0.00"
                        value={row.qty}
                        disabled={disabled}
                        onChange={(e) => updateRow(index, { qty: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="0.00"
                        value={row.price}
                        disabled={disabled}
                        onChange={(e) => updateRow(index, { price: e.target.value })}
                      />
                    </td>
                    <td>
                      <DmyDateInput
                        id={`bunkerDate_${row.id}`}
                        value={row.date}
                        disabled={disabled}
                        onChange={(value) => updateRow(index, { date: value })}
                      />
                    </td>
                    <td><input type="text" value={row.amount} readOnly /></td>
                    {!disabled ? (
                      <td className={styles.actCol}>
                        <KhakiRowActions
                          onAdd={isLast ? onAdd : undefined}
                          addTitle="Add a new bunker line"
                          removeDisabled={rows.length <= 1}
                          onRemove={() => onChange(rows.filter((item) => item.id !== row.id))}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} />
                <td className={styles.bunkerTotalLabel}>Total ($)</td>
                <td>
                  <input type="text" value={total || '0.00'} readOnly />
                </td>
                {!disabled ? <td /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}

function BunkersPanel({
  form,
  lookups,
  deliveryBunkerTotal,
  redeliveryBunkerTotal,
  defaultGradeId = '',
  updateForm,
  setError,
  disabled,
}) {
  const bunkers = lookups?.bunkers ?? [];

  return (
    <PeriodCard title="Bunkers" defaultOpen={false} icon={<BunkersIcon />}>
      <SubLabel first mustard>
        Bunkers on <span className={styles.dirChip}>Delivery</span>
      </SubLabel>
      <BunkerTable
        rows={form.deliveryBunkers}
        bunkers={bunkers}
        total={deliveryBunkerTotal}
        disabled={disabled}
        onChange={(deliveryBunkers) => updateForm({
          ...form,
          deliveryBunkers: recalcBunkerRows(deliveryBunkers),
        })}
        onAdd={() => {
          const last = form.deliveryBunkers[form.deliveryBunkers.length - 1];
          if (!last?.gradeId || !last?.qty || !last?.date || !last?.price) {
            setError('Please fill the previous delivery bunker row before adding another.');
            return;
          }
          setError('');
          updateForm({
            ...form,
            deliveryBunkers: [...form.deliveryBunkers, { ...EMPTY_BUNKER_ROW(), gradeId: defaultGradeId }],
          });
        }}
      />

      <SubLabel mustard>
        Bunkers on <span className={styles.dirChip}>Redelivery</span>
      </SubLabel>
      <BunkerTable
        rows={form.redeliveryBunkers}
        bunkers={bunkers}
        total={redeliveryBunkerTotal}
        disabled={disabled}
        onChange={(redeliveryBunkers) => updateForm({
          ...form,
          redeliveryBunkers: recalcBunkerRows(redeliveryBunkers),
        })}
        onAdd={() => {
          const last = form.redeliveryBunkers[form.redeliveryBunkers.length - 1];
          if (!last?.gradeId || !last?.qty || !last?.date || !last?.price) {
            setError('Please fill the previous re-delivery bunker row before adding another.');
            return;
          }
          setError('');
          updateForm({
            ...form,
            redeliveryBunkers: [...form.redeliveryBunkers, { ...EMPTY_BUNKER_ROW(), gradeId: defaultGradeId }],
          });
        }}
      />
    </PeriodCard>
  );
}

function AdditionalInfoPanel({
  form,
  updateField,
  files,
  setFiles,
  attachments,
  removeAttachment,
  disabled,
  footer = null,
}) {
  return (
    <>
    <PeriodCard title="Additional Info & Documents" defaultOpen icon={<DocsIcon />}>
      <div className={styles.addinfoLayout}>
        <div className={styles.addinfoFields}>
          <Field label="Trade Exclusions">
            <textarea
              rows={2}
              placeholder="Trade exclusions..."
              value={form.tradeExclusions}
              disabled={disabled}
              onChange={(e) => updateField('tradeExclusions', e.target.value)}
            />
          </Field>
          <Field label="Cargo Exclusions">
            <textarea
              rows={2}
              placeholder="Cargo exclusions..."
              value={form.cargoExclusions}
              disabled={disabled}
              onChange={(e) => updateField('cargoExclusions', e.target.value)}
            />
          </Field>
          <Field label="Hold/Tank Cleaning">
            <textarea
              rows={2}
              placeholder="Hold / tank cleaning requirements..."
              value={form.intermediateHoldCleaning}
              disabled={disabled}
              onChange={(e) => updateField('intermediateHoldCleaning', e.target.value)}
            />
          </Field>
          <Field label="ILOHC">
            <input
              type="text"
              placeholder="0.00"
              value={form.ilohc}
              disabled={disabled}
              onChange={(e) => updateField('ilohc', e.target.value)}
            />
          </Field>
          <Field label="Overall Remarks">
            <textarea
              rows={2}
              placeholder="Overall remarks..."
              value={form.remarks}
              disabled={disabled}
              onChange={(e) => updateField('remarks', e.target.value)}
            />
          </Field>
          <Field label="1st Leg Remarks" className={styles.legRemarksField}>
            <textarea
              rows={2}
              placeholder="1st leg remarks..."
              value={form.legDetails}
              disabled={disabled}
              onChange={(e) => updateField('legDetails', e.target.value)}
            />
          </Field>
        </div>
        <div className={styles.addinfoDocs}>
          <AttachmentDropzone
            className={styles.periodDropzoneRoot}
            readOnly={disabled}
            files={files}
            existing={attachments}
            onAddFiles={(added) => setFiles((current) => [...current, ...added])}
            onRemoveFile={(index) => setFiles((current) => current.filter((_, i) => i !== index))}
            onRemoveExisting={(item) => removeAttachment(item.file)}
          />
        </div>
      </div>
    </PeriodCard>
    {footer}
  </>
  );
}

export default function AddPeriodContractSections({
  form,
  lookups,
  vesselTypes,
  vessels,
  periodUnit,
  updateField,
  updateForm,
  setForm,
  setError,
  files,
  setFiles,
  attachments,
  removeAttachment,
  deliveryBunkerTotal,
  redeliveryBunkerTotal,
  defaultGradeId = '',
  disabled = false,
  footer = null,
}) {
  return (
    <>
      <RecapIdentifiersPanel
        form={form}
        lookups={lookups}
        vesselTypes={vesselTypes}
        vessels={vessels}
        updateField={updateField}
        setForm={setForm}
        disabled={disabled}
      />
      <CpInformationPanel
        form={form}
        lookups={lookups}
        updateField={updateField}
        disabled={disabled}
      />
      <PeriodDetailsPanel
        form={form}
        lookups={lookups}
        periodUnit={periodUnit}
        updateField={updateField}
        updateForm={updateForm}
        setError={setError}
        disabled={disabled}
      />
      <HirePanel
        form={form}
        bunkers={lookups?.bunkers ?? []}
        defaultGradeId={defaultGradeId}
        updateForm={updateForm}
        setError={setError}
        disabled={disabled}
      />
      <BunkersPanel
        form={form}
        lookups={lookups}
        deliveryBunkerTotal={deliveryBunkerTotal}
        redeliveryBunkerTotal={redeliveryBunkerTotal}
        defaultGradeId={defaultGradeId}
        updateForm={updateForm}
        setError={setError}
        disabled={disabled}
      />
      <AdditionalInfoPanel
        form={form}
        updateField={updateField}
        files={files}
        setFiles={setFiles}
        attachments={attachments}
        removeAttachment={removeAttachment}
        disabled={disabled}
        footer={footer}
      />
    </>
  );
}
