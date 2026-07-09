import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, CardSelect, LoadingOverlay } from '@bainbridge/shared-ui';
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

function EditableField({
  field,
  value,
  lookups,
  onChange,
}) {
  const lookupName = field.lookup || SELECT_LOOKUPS[field.key];
  const isWide = TEXTAREA_KEYS.has(field.key) || field.label.length > 80;
  const readOnly = Boolean(field.readOnly) || READ_ONLY_KEYS.has(field.key);

  if (field.type === 'radio') {
    const options = field.key === 'rdoPitch' ? PITCH_OPTIONS : YES_NO_OPTIONS;
    return (
      <div className={`${styles.field} ${isWide ? styles.fieldWide : ''}`}>
        <label>{field.label}</label>
        <div className={styles.radioGroup}>
          {options.map((option) => (
            <label key={option.value} className={styles.radioOption}>
              <input
                type="radio"
                name={field.key}
                value={option.value}
                checked={String(value || '1') === option.value}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'select' && lookupName) {
    const options = lookups?.[lookupName] ?? [];
    return (
      <div className={`${styles.field} ${isWide ? styles.fieldWide : ''}`}>
        <label htmlFor={field.key}>{field.label}</label>
        <CardSelect
          value={value || ''}
          options={options}
          placeholder="----Select From List----"
          disabled={readOnly}
          ariaLabel={field.label}
          onChange={(nextValue) => onChange(field.key, nextValue)}
        />
      </div>
    );
  }

  if (TEXTAREA_KEYS.has(field.key)) {
    return (
      <div className={`${styles.field} ${styles.fieldFull}`}>
        <label htmlFor={field.key}>{field.label}</label>
        <textarea
          id={field.key}
          className={styles.textarea}
          value={value || ''}
          rows={4}
          readOnly={readOnly}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      </div>
    );
  }

  return (
    <div className={`${styles.field} ${isWide ? styles.fieldWide : ''}`}>
      <label htmlFor={field.key}>{field.label}</label>
      <input
        id={field.key}
        className={styles.input}
        type={field.type === 'date' ? 'text' : 'text'}
        value={value || ''}
        placeholder={field.type === 'date' ? 'dd-mm-yyyy' : ''}
        readOnly={readOnly}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    </div>
  );
}

function FormSection({ title, fields, values, lookups, onChange }) {
  if (!fields?.length) return null;
  return (
    <section className={styles.section}>
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
      <table className={styles.table}>
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
                <CardSelect
                  value={row.certificateId || ''}
                  options={certificateOptions}
                  placeholder="----Select From List----"
                  onChange={(value) => onChange(index, { certificateId: value })}
                />
              </td>
              <td>
                <input
                  className={styles.input}
                  value={row.dateIssue || ''}
                  placeholder="dd-mm-yyyy"
                  onChange={(event) => onChange(index, { dateIssue: event.target.value })}
                />
              </td>
              <td>
                <input
                  className={styles.input}
                  value={row.dateLastAnnual || ''}
                  placeholder="dd-mm-yyyy"
                  onChange={(event) => onChange(index, { dateLastAnnual: event.target.value })}
                />
              </td>
              <td>
                <input
                  className={styles.input}
                  value={row.dateExpiry || ''}
                  placeholder="dd-mm-yyyy"
                  onChange={(event) => onChange(index, { dateExpiry: event.target.value })}
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
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => onRemove(index)}
                    aria-label="Remove certificate row"
                  >
                    ×
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.tableActions}>
        <Button variant="outline" label="Add Certificate" onClick={onAdd} />
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
        <Button variant="outline" label="Back" to={fleetPath} />
        <div className={styles.toolbarActions}>
          <Button variant="outline" label="Cancel" to={fleetPath} />
          <Button label="Save" onClick={handleSubmit} disabled={loading || saving} />
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

      <div className={styles.tabs}>
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
            <section className={styles.section}>
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
