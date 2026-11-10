import React, { useMemo, useState } from 'react';
import { updateTankerParticulars } from '../../../services/vesselTankerParticulars.js';
import { TANKER_PARTICULARS_LAYOUT } from './tankerParticularsLayout.js';
import styles from './ViewVesselTankersPage.module.css';

const VESSEL_DESCRIPTION_FIELDS = [
  { key: 'txtVName', label: "Vessel's name", type: 'text' },
  { key: 'txtIMONumber', label: 'IMO number', type: 'text' },
  { key: 'txtVPName', label: "Vessel's Previous Name(S)", type: 'text' },
  { key: 'txtDOC', label: 'Date (S) Of Change', type: 'text' },
  { key: 'txtDateDelivered', label: 'Date delivered', type: 'text' },
  { key: 'txtBuilder', label: 'Builder (where built)', type: 'text' },
  { key: 'selFlag', label: 'Flag', type: 'select', lookup: 'countries' },
  { key: 'selRegistryPort', label: 'Port Of Registry', type: 'select', lookup: 'ports' },
  { key: 'txtCallSign', label: 'Call sign', type: 'text' },
  { key: 'txtPhoneNo', label: "Vessel's satcom phone number", type: 'text' },
  { key: 'txtFaxNo', label: "Vessel's fax number", type: 'text' },
  { key: 'txtTelexNo', label: "Vessel's telex number", type: 'text' },
  { key: 'txtEmailAddress', label: "Vessel's email address", type: 'text' },
  { key: 'txtTypeOfVessel', label: 'Type of vessel', type: 'text' },
  { key: 'txtHullType', label: 'Type of hull', type: 'text' },
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

function lookupLabel(lookups, lookupName, value) {
  if (!value) return '—';
  const options = lookups?.[lookupName] ?? [];
  return options.find((option) => option.id === String(value))?.name || value;
}

function formatFieldValue(field, value, lookups) {
  if (field.type === 'radio') {
    if (value === '1') return 'Yes';
    if (value === '2') return 'No';
    return value || '—';
  }
  const lookupName = field.lookup || SELECT_LOOKUPS[field.key];
  if (lookupName) {
    return lookupLabel(lookups, lookupName, value) || '—';
  }
  return value || '—';
}

function ReadOnlyField({ field, value, lookups }) {
  const display = formatFieldValue(field, value, lookups);
  const isWide = TEXTAREA_KEYS.has(field.key) || field.label.length > 80;
  return (
    <div className={`${styles.field} ${isWide ? styles.fieldWide : ''}`}>
      <label>{field.label}</label>
      <div className={styles.fieldValue}>{display}</div>
    </div>
  );
}

function FormSection({ title, fields, values, lookups }) {
  if (!fields?.length) return null;
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>
        <div className={styles.fieldGrid}>
          {fields.map((field) => (
            <ReadOnlyField
              key={field.key}
              field={field}
              value={values[field.key]}
              lookups={lookups}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function mapCertificatesForSave(certificates = [], uploadIndex = -1, newFiles = []) {
  return certificates.map((cert, index) => ({
    certificateId: cert.certificateId || '',
    dateIssue: cert.dateIssue || '',
    dateLastAnnual: cert.dateLastAnnual || '',
    dateExpiry: cert.dateExpiry || '',
    existingFiles: (cert.attachments || []).map((file) => file.file).join(','),
    existingNames: (cert.attachments || []).map((file) => file.name).join(','),
    newFiles: index === uploadIndex ? newFiles : [],
  }));
}

function CertificatesTable({
  certificates,
  vesselId,
  fields,
  canUpload,
  uploadingIndex,
  onUpload,
}) {
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
          </tr>
        </thead>
        <tbody>
          {certificates.length === 0 ? (
            <tr>
              <td colSpan={5}>No certificates recorded.</td>
            </tr>
          ) : certificates.map((row, index) => (
            <tr key={row.id || `${row.certificateId}-${index}`}>
              <td>{row.certificateName || '—'}</td>
              <td>{row.dateIssue || '—'}</td>
              <td>{row.dateLastAnnual || '—'}</td>
              <td>{row.dateExpiry || '—'}</td>
              <td>
                <div className={styles.uploadCell}>
                  {row.attachments?.length ? (
                    <div className={styles.attachmentList}>
                      {row.attachments.map((file) => (
                        <a
                          key={file.file}
                          href={file.url}
                          className={styles.attachmentLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <i className="bi bi-paperclip" aria-hidden />
                          {file.name}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <label
                    className={styles.uploadBtn}
                    title={canUpload && vesselId
                      ? 'Upload certificate file'
                      : 'Upload unavailable'}
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 16V4" />
                      <path d="M7 9l5-5 5 5" />
                      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                    </svg>
                    {uploadingIndex === index ? 'Uploading…' : 'Upload'}
                    <input
                      type="file"
                      multiple
                      className={styles.uploadBtnInput}
                      disabled={!canUpload || !vesselId || uploadingIndex != null}
                      onChange={(event) => {
                        const files = Array.from(event.target.files || []);
                        event.target.value = '';
                        if (!files.length) return;
                        onUpload?.(index, files, fields, certificates);
                      }}
                    />
                  </label>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Same Operated Vessels particulars sections (read-only) for page + TC popup. */
export default function VesselParticularsReadonlyContent({
  data,
  vesselId,
  canUpload = false,
  onRefresh,
}) {
  const [activeTab, setActiveTab] = useState(TANKER_PARTICULARS_LAYOUT.tabs[0]?.id ?? 'certification');
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const values = data?.fields ?? {};
  const lookups = data?.lookups ?? {};
  const activeTabConfig = useMemo(
    () => TANKER_PARTICULARS_LAYOUT.tabs.find((tab) => tab.id === activeTab),
    [activeTab],
  );

  const handleUpload = async (index, files, fields, certificates) => {
    if (!vesselId || !canUpload) return;
    setUploadingIndex(index);
    setUploadError('');
    try {
      await updateTankerParticulars(vesselId, {
        fields: fields || {},
        certificates: mapCertificatesForSave(certificates, index, files),
      });
      if (onRefresh) await onRefresh();
    } catch (err) {
      setUploadError(err.message || 'Failed to upload certificate.');
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <>
      <FormSection
        title="Vessel Description"
        fields={VESSEL_DESCRIPTION_FIELDS}
        values={values}
        lookups={lookups}
      />

      {TANKER_PARTICULARS_LAYOUT.mainSections.map((section) => (
        <FormSection
          key={section.title}
          title={section.title}
          fields={section.fields}
          values={values}
          lookups={lookups}
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
          {uploadError ? <div className={styles.error}>{uploadError}</div> : null}
          {activeTabConfig?.certificates ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Certification</h3>
              <div className={styles.sectionBody}>
                <CertificatesTable
                  certificates={data?.certificates ?? []}
                  vesselId={vesselId}
                  fields={values}
                  canUpload={canUpload}
                  uploadingIndex={uploadingIndex}
                  onUpload={handleUpload}
                />
              </div>
            </section>
          ) : null}

          {activeTabConfig?.sections?.map((section) => (
            <FormSection
              key={`${activeTab}-${section.title}`}
              title={section.title}
              fields={section.fields}
              values={values}
              lookups={lookups}
            />
          ))}
        </div>
      </div>
    </>
  );
}
