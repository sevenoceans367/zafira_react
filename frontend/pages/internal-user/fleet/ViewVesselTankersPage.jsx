import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { fetchTankerParticulars, downloadTankerParticularsPdf } from '../../../services/vesselTankerParticulars.js';
import { useFleetModule } from '../../../hooks/useFleetModule.js';
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

function CertificatesTable({ certificates }) {
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
          ) : certificates.map((row) => (
            <tr key={row.id}>
              <td>{row.certificateName || '—'}</td>
              <td>{row.dateIssue || '—'}</td>
              <td>{row.dateLastAnnual || '—'}</td>
              <td>{row.dateExpiry || '—'}</td>
              <td>
                {row.attachments?.length
                  ? row.attachments.map((file) => (
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
                  ))
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ViewVesselTankersPage() {
  const { fleetPath } = useFleetModule();
  const { id: vesselId } = useParams();
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
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
      setData(response);
    } catch (err) {
      setError(err.message || 'Failed to load vessel particulars.');
    } finally {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    loadParticulars();
  }, [loadParticulars]);

  const handleGeneratePdf = useCallback(async () => {
    if (!vesselId || !data) return;
    setPdfLoading(true);
    setError('');
    try {
      await downloadTankerParticularsPdf(vesselId);
    } catch (err) {
      setError(err.message || 'Failed to generate vessel particulars PDF.');
    } finally {
      setPdfLoading(false);
    }
  }, [data, vesselId]);

  const values = data?.fields ?? {};
  const lookups = data?.lookups ?? {};
  const vesselName = data?.vessel?.name || 'Vessel';

  const activeTabConfig = useMemo(
    () => TANKER_PARTICULARS_LAYOUT.tabs.find((tab) => tab.id === activeTab),
    [activeTab],
  );

  return (
    <div className={`zafira-page ${styles.page}`}>
      {loading ? <LoadingOverlay active label="Loading vessel particulars…" /> : null}

      <div className={styles.toolbar}>
        <Button variant="outline" label="Back" to={fleetPath} />
        <div className={styles.toolbarActions}>
          <Button
            variant="outline"
            label={pdfLoading ? 'Generating PDF…' : 'Generate PDF'}
            onClick={handleGeneratePdf}
            disabled={!data || pdfLoading || loading}
          />
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <h2 className={styles.subtitle}>
        Vessel Particulars ({vesselName.toUpperCase()})
      </h2>

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
          {activeTabConfig?.certificates ? (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Certification</h3>
              <div className={styles.sectionBody}>
                <CertificatesTable certificates={data?.certificates ?? []} />
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
    </div>
  );
}
