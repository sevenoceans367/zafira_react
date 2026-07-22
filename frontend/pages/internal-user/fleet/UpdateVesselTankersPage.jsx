import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  CardSelect,
  DmyDateInput,
  Field,
  LoadingOverlay,
  TextInput,
  Textarea,
} from '@bainbridge/shared-ui';
import {
  fetchTankerParticulars,
  updateTankerParticulars,
} from '../../../services/vesselTankerParticulars.js';
import { useFleetModule } from '../../../hooks/useFleetModule.js';
import { TANKER_PARTICULARS_LAYOUT } from './tankerParticularsLayout.js';
import styles from './ViewVesselTankersPage.module.css';

const VESSEL_DESCRIPTION_FIELDS = [
  { key: 'txtVName', label: "Vessel's name", type: 'text', readOnly: true },
  { key: 'txtIMONumber', label: 'IMO number', type: 'text', readOnly: true },
  { key: 'txtVPName', label: "Vessel's Previous Name(S)", type: 'text' },
  { key: 'txtDOC', label: 'Date (S) Of Change', type: 'date' },
  { key: 'txtDateDelivered', label: 'Date delivered', type: 'date' },
  { key: 'txtBuilder', label: 'Builder (where built)', type: 'text' },
  { key: 'selFlag', label: 'Flag', type: 'select', lookup: 'countries', readOnly: true },
  { key: 'selRegistryPort', label: 'Port Of Registry', type: 'select', lookup: 'ports' },
  { key: 'txtCallSign', label: 'Call sign', type: 'text' },
  { key: 'txtPhoneNo', label: "Vessel's satcom phone number", type: 'text' },
  { key: 'txtFaxNo', label: "Vessel's fax number", type: 'text' },
  { key: 'txtTelexNo', label: "Vessel's telex number", type: 'text' },
  { key: 'txtEmailAddress', label: "Vessel's email address", type: 'text' },
  { key: 'txtTypeOfVessel', label: 'Type of vessel', type: 'text', readOnly: true },
  { key: 'txtHullType', label: 'Type of hull', type: 'text' },
  { key: 'txtLOA', label: 'Length Over All (LOA)(M)', type: 'text', readOnly: true },
];

const SELECT_LOOKUPS = {
  selFlag: 'countries',
  selRegistryPort: 'ports',
  selCLASS_SOC: 'classSocieties',
  selPrevCLASS_SOC: 'classSocieties',
  selDryDockPort: 'ports',
  selSirePort: 'ports',
  selCDIPort: 'ports',
};

const TEXTAREA_KEYS = new Set([
  'txtClassNotation',
  'txtRegisteredOwner',
  'txtTechnicalOperator',
  'txtCommercialOperator',
  'txtDisponentOwner',
  'txtManningAgency',
  'txtReportedDetails',
  'txtPolutionDetails',
  'txtGroundingDetails',
  'txtCasualtyDetails',
  'txtAccidentDetails',
]);

const PITCH_OPTIONS = [
  { value: '1', label: 'Fixed Pitch' },
  { value: '2', label: 'Controllable Pitch' },
];

const READ_ONLY_KEYS = new Set([
  'txtVName',
  'txtIMONumber',
  'selFlag',
  'selCLASS_SOC',
  'txtTypeOfVessel',
  'txtLOA',
]);

const YES_NO_OPTIONS = [
  { value: '1', label: 'Yes' },
  { value: '2', label: 'No' },
];

function isDateField(field) {
  if (!field || field.type === 'radio' || field.type === 'select') return false;
  if (field.type === 'date') return true;
  const key = String(field.key || '');
  if (/Date$/i.test(key) || key === 'txtDOC') return true;
  const label = String(field.label || '').toLowerCase();
  return /\b(date|expiry)\b/.test(label);
}

function emptyCertificateRow(key = `cert-${Date.now()}`) {
  return {
    key,
    certificateId: '',
    dateIssue: '',
    dateLastAnnual: '',
    dateExpiry: '',
    existingFiles: '',
    existingNames: '',
    attachments: [],
    newFiles: [],
  };
}

function mapCertificatesToForm(certificates = []) {
  if (!certificates.length) return [emptyCertificateRow()];
  return certificates.map((cert, index) => ({
    key: `cert-${cert.id ?? index}`,
    certificateId: cert.certificateId || '',
    dateIssue: cert.dateIssue || '',
    dateLastAnnual: cert.dateLastAnnual || '',
    dateExpiry: cert.dateExpiry || '',
    existingFiles: (cert.attachments || []).map((file) => file.file).join(','),
    existingNames: (cert.attachments || []).map((file) => file.name).join(','),
    attachments: cert.attachments || [],
    newFiles: [],
  }));
}

function ThemedCardSelect({
  value,
  options = [],
  onChange,
  label,
  placeholder = '----Select From List----',
  disabled = false,
}) {
  return (
    <div className={styles.cardSelect}>
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

function EditableField({
  field,
  value,
  lookups,
  onChange,
}) {
  const lookupName = field.lookup || SELECT_LOOKUPS[field.key];
  const isWide = TEXTAREA_KEYS.has(field.key) || field.label.length > 80;
  const readOnly = Boolean(field.readOnly) || READ_ONLY_KEYS.has(field.key);
  const spanClass = TEXTAREA_KEYS.has(field.key)
    ? styles.fieldWideFull
    : (isWide ? styles.fieldWide : '');

  if (field.type === 'radio') {
    const options = field.key === 'rdoPitch' ? PITCH_OPTIONS : YES_NO_OPTIONS;
    return (
      <Field id={field.key} label={field.label} className={spanClass}>
        <div className={styles.radioGroup}>
          {options.map((option) => (
            <label key={option.value} className={styles.radioOption}>
              <input
                type="radio"
                name={field.key}
                value={option.value}
                checked={String(value || '1') === option.value}
                disabled={readOnly}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </Field>
    );
  }

  if (field.type === 'select' && lookupName) {
    const options = lookups?.[lookupName] ?? [];
    return (
      <Field id={field.key} label={field.label} className={spanClass}>
        <ThemedCardSelect
          value={value || ''}
          options={options}
          label={field.label}
          disabled={readOnly}
          onChange={(nextValue) => onChange(field.key, nextValue)}
        />
      </Field>
    );
  }

  if (TEXTAREA_KEYS.has(field.key)) {
    return (
      <Field id={field.key} label={field.label} className={styles.fieldWideFull}>
        <Textarea
          id={field.key}
          value={value || ''}
          rows={4}
          readOnly={readOnly}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      </Field>
    );
  }

  if (isDateField(field)) {
    return (
      <Field id={field.key} label={field.label} className={spanClass}>
        <DmyDateInput
          id={field.key}
          value={value || ''}
          disabled={readOnly}
          onChange={(next) => onChange(field.key, next)}
        />
      </Field>
    );
  }

  return (
    <Field id={field.key} label={field.label} className={spanClass}>
      <TextInput
        id={field.key}
        value={value || ''}
        readOnly={readOnly}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    </Field>
  );
}

function FormSection({ title, fields, values, lookups, onChange }) {
  if (!fields?.length) return null;
  return (
    <section className={`zafira-card ${styles.section}`}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>
        <div className={styles.fieldGrid}>
          {fields.map((field) => (
            <EditableField
              key={field.key}
              field={field}
              value={values[field.key]}
              lookups={lookups}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CertificatesEditor({ certificates, lookups, onChange, onAdd, onRemove }) {
  const certificateOptions = lookups?.certificates ?? [];

  return (
    <div className={styles.tableWrap}>
      <table className={`zafira-data-table ${styles.table}`}>
        <thead>
          <tr>
            <th>Certificate Name</th>
            <th>Date Of Issue</th>
            <th>Date Of Last Annual Endorsement</th>
            <th>Date Of Expiry</th>
            <th>Upload</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {certificates.map((row, index) => (
            <tr key={row.key}>
              <td>
                <ThemedCardSelect
                  value={row.certificateId || ''}
                  options={certificateOptions}
                  label="Certificate Name"
                  onChange={(value) => onChange(index, { certificateId: value })}
                />
              </td>
              <td>
                <DmyDateInput
                  value={row.dateIssue || ''}
                  onChange={(value) => onChange(index, { dateIssue: value })}
                />
              </td>
              <td>
                <DmyDateInput
                  value={row.dateLastAnnual || ''}
                  onChange={(value) => onChange(index, { dateLastAnnual: value })}
                />
              </td>
              <td>
                <DmyDateInput
                  value={row.dateExpiry || ''}
                  onChange={(value) => onChange(index, { dateExpiry: value })}
                />
              </td>
              <td>
                {row.attachments?.length ? (
                  <div className={styles.attachmentList}>
                    {row.attachments.map((file) => (
                      <a
                        key={`${row.key}-${file.file}`}
                        href={file.url}
                        className={styles.attachmentLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.name}
                      </a>
                    ))}
                  </div>
                ) : null}
                <input
                  type="file"
                  multiple
                  className={styles.fileInput}
                  onChange={(event) => onChange(index, { newFiles: Array.from(event.target.files || []) })}
                />
              </td>
              <td>
                {certificates.length > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    label="Remove"
                    onClick={() => onRemove(index)}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.tableActions}>
        <Button type="button" variant="outline" label="Add Certificate" onClick={onAdd} />
      </div>
    </div>
  );
}

export default function UpdateVesselTankersPage() {
  const navigate = useNavigate();
  const { fleetPath } = useFleetModule();
  const { id: vesselId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookups, setLookups] = useState({});
  const [fields, setFields] = useState({});
  const [certificates, setCertificates] = useState([emptyCertificateRow()]);
  const [vesselName, setVesselName] = useState('Vessel');
  const [activeTab, setActiveTab] = useState(TANKER_PARTICULARS_LAYOUT.tabs[0]?.id ?? 'certification');

  const loadParticulars = useCallback(async () => {
    if (!vesselId) {
      setError('Missing vessel id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetchTankerParticulars(vesselId);
      setFields(response.fields ?? {});
      setLookups(response.lookups ?? {});
      setCertificates(mapCertificatesToForm(response.certificates ?? []));
      setVesselName(response.vessel?.name || response.fields?.txtVName || 'Vessel');
    } catch (err) {
      setError(err.message || 'Failed to load vessel particulars.');
    } finally {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    loadParticulars();
  }, [loadParticulars]);

  const activeTabConfig = useMemo(
    () => TANKER_PARTICULARS_LAYOUT.tabs.find((tab) => tab.id === activeTab),
    [activeTab],
  );

  const handleFieldChange = useCallback((key, value) => {
    setFields((current) => ({ ...current, [key]: value }));
  }, []);

  const handleCertificateChange = useCallback((index, patch) => {
    setCertificates((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch } : row
    )));
  }, []);

  const handleAddCertificate = useCallback(() => {
    setCertificates((current) => [...current, emptyCertificateRow(`cert-${Date.now()}`)]);
  }, []);

  const handleRemoveCertificate = useCallback((index) => {
    setCertificates((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!vesselId) return;
    setSaving(true);
    setError('');
    try {
      await updateTankerParticulars(vesselId, { fields, certificates });
      navigate(fleetPath);
    } catch (err) {
      setError(err.message || 'Failed to update vessel particulars.');
    } finally {
      setSaving(false);
    }
  }, [certificates, fields, fleetPath, navigate, vesselId]);

  return (
    <div className={`zafira-page ${styles.page}`}>
      {loading || saving ? (
        <LoadingOverlay active label={saving ? 'Saving vessel particulars…' : 'Loading vessel particulars…'} />
      ) : null}

      <div className={styles.toolbar}>
        <Button type="button" variant="outline" label="Back" to={fleetPath} />
        <div className={styles.toolbarActions}>
          <Button type="button" variant="outline" label="Cancel" to={fleetPath} />
          <Button type="button" label="Save" onClick={handleSubmit} disabled={loading || saving} />
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <h2 className={styles.subtitle}>
        Edit Vessel Particulars ({vesselName.toUpperCase()})
      </h2>

      <FormSection
        title="Vessel Description"
        fields={VESSEL_DESCRIPTION_FIELDS}
        values={fields}
        lookups={lookups}
        onChange={handleFieldChange}
      />

      {TANKER_PARTICULARS_LAYOUT.mainSections.map((section) => (
        <FormSection
          key={section.title}
          title={section.title}
          fields={section.fields}
          values={fields}
          lookups={lookups}
          onChange={handleFieldChange}
        />
      ))}

      <div className={`zafira-card ${styles.tabs}`}>
        <div className={styles.tabList} role="tablist" aria-label="Vessel particulars tabs">
          {TANKER_PARTICULARS_LAYOUT.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.tabPanel} role="tabpanel">
          {activeTabConfig?.certificates ? (
            <section className={`zafira-card ${styles.section}`}>
              <h3 className={styles.sectionTitle}>Certification</h3>
              <div className={styles.sectionBody}>
                <CertificatesEditor
                  certificates={certificates}
                  lookups={lookups}
                  onChange={handleCertificateChange}
                  onAdd={handleAddCertificate}
                  onRemove={handleRemoveCertificate}
                />
              </div>
            </section>
          ) : null}

          {activeTabConfig?.sections?.map((section) => (
            <FormSection
              key={`${activeTab}-${section.title}`}
              title={section.title}
              fields={section.fields}
              values={fields}
              lookups={lookups}
              onChange={handleFieldChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
