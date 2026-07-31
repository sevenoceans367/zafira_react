import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  CardSelect,
  Field,
  LoadingOverlay,
  TextInput,
  Textarea,
  useConfirm,
} from '@bainbridge/shared-ui';
import { fetchVesselPrimary, updateVesselPrimary } from '../../../services/fleet.js';
import { useFleetModule } from '../../../hooks/useFleetModule.js';
import styles from './UpdateVesselPage.module.css';

const EMPTY_FORM = {
  businessTypeId: '2',
  vesselTypeId: '',
  imoNo: '',
  vesselName: '',
  vesselCode: '',
  yearBuilt: '',
  flagId: '',
  dwt: '',
  draftM: '',
  loa: '',
  extBreadth: '',
  grtNrt: '',
  nrt: '',
  grain: '',
  bale: '',
  noh: '',
  noha: '',
  hatchSize: '',
  cargoGear: '',
  craneSize: '',
  grabSize: '',
  gasCargoTanks: '',
  gasTankCapacity: '',
  gasCargoPumps: '',
  gasMainCargoPumps: '',
  sizeOfManifolds: '',
  gasSbtCapacity: '',
  tankerCapacity: '',
  noOfGrade: '',
  tankerCargoPump: '',
  tankerSbtCapacity: '',
  tankerPumpMainCap: '',
  piVendorId: '',
  classSocId: '',
  ownerVendorId: '',
  remarks: '',
};

const BUSINESS_TYPE_OPTIONS = [
  { id: '1', name: 'Gas' },
  { id: '2', name: 'Tankers' },
  { id: '3', name: 'Dry' },
];

function toFormState(vessel = {}) {
  return {
    ...EMPTY_FORM,
    businessTypeId: vessel.businessTypeId ?? '2',
    vesselTypeId: vessel.vesselTypeId ?? '',
    imoNo: vessel.imoNo ?? '',
    vesselName: vessel.vesselName ?? '',
    vesselCode: vessel.vesselCode ?? '',
    yearBuilt: vessel.yearBuilt ?? '',
    flagId: vessel.flagId ?? '',
    dwt: vessel.dwt ?? '',
    draftM: vessel.draftM ?? '',
    loa: vessel.loa ?? '',
    extBreadth: vessel.extBreadth ?? '',
    grtNrt: vessel.grtNrt ?? '',
    nrt: vessel.nrt ?? '',
    grain: vessel.grain ?? '',
    bale: vessel.bale ?? '',
    noh: vessel.noh ?? '',
    noha: vessel.noha ?? '',
    hatchSize: vessel.hatchSize ?? '',
    cargoGear: vessel.cargoGear ?? '',
    craneSize: vessel.craneSize ?? '',
    grabSize: vessel.grabSize ?? '',
    gasCargoTanks: vessel.gasCargoTanks ?? '',
    gasTankCapacity: vessel.gasTankCapacity ?? '',
    gasCargoPumps: vessel.gasCargoPumps ?? '',
    gasMainCargoPumps: vessel.gasMainCargoPumps ?? '',
    sizeOfManifolds: vessel.sizeOfManifolds ?? '',
    gasSbtCapacity: vessel.gasSbtCapacity ?? '',
    tankerCapacity: vessel.tankerCapacity ?? '',
    noOfGrade: vessel.noOfGrade ?? '',
    tankerCargoPump: vessel.tankerCargoPump ?? '',
    tankerSbtCapacity: vessel.tankerSbtCapacity ?? '',
    tankerPumpMainCap: vessel.tankerPumpMainCap ?? '',
    piVendorId: vessel.piVendorId ?? '',
    classSocId: vessel.classSocId ?? '',
    ownerVendorId: vessel.ownerVendorId ?? '',
    remarks: vessel.remarks ?? '',
  };
}

function VesselField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  as = 'input',
  options = [],
  className = '',
}) {
  const labelText = required ? `${label} *` : label;

  if (as === 'select') {
    return (
      <Field id={id} label={labelText} className={className}>
        <div className={styles.cardSelect}>
          <CardSelect
            value={value || ''}
            options={options}
            placeholder="----Select From List----"
            ariaLabel={label}
            align="start"
            onChange={onChange}
          />
        </div>
      </Field>
    );
  }

  if (as === 'textarea') {
    return (
      <Field id={id} label={labelText} className={className || styles.span2}>
        <Textarea
          id={id}
          value={value}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
    );
  }

  return (
    <Field id={id} label={labelText} className={className}>
      <TextInput
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        autoComplete="off"
      />
    </Field>
  );
}

function Section({ title, children }) {
  return (
    <section className={`zafira-card ${styles.section}`}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>
        <div className={styles.grid4}>{children}</div>
      </div>
    </section>
  );
}

export default function UpdateVesselPage() {
  const { id: vesselId } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookups, setLookups] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [attachments, setAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  const { fleetPath } = useFleetModule();

  const loadVessel = useCallback(async () => {
    if (!vesselId) {
      setError('Missing vessel id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await fetchVesselPrimary(vesselId);
      setLookups(data.lookups);
      setForm(toFormState(data.vessel));
      setAttachments(data.vessel?.attachments ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load vessel.');
    } finally {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    loadVessel();
  }, [loadVessel]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const businessType = form.businessTypeId;
  const showDry = businessType === '3';
  const showGas = businessType === '1';
  const showTanker = businessType === '2';

  const vesselTypeOptions = useMemo(() => {
    if (!lookups?.vesselTypesByBusiness) return [];
    return lookups.vesselTypesByBusiness[businessType] ?? [];
  }, [lookups, businessType]);

  const handleBusinessTypeChange = (value) => {
    setForm((current) => ({
      ...current,
      businessTypeId: value,
      vesselTypeId: '',
    }));
  };

  const removeAttachment = async (file) => {
    const ok = await confirm({
      title: 'Remove attachment',
      message: 'Are you sure you want to remove this attachment permanently?',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    setAttachments((current) => current.filter((item) => item.file !== file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!vesselTypeOptions.find((option) => option.id === form.vesselTypeId)) {
      setError('Vessel type is required.');
      return;
    }

    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you have checked each entry?',
      confirmLabel: 'Submit',
      cancelLabel: 'Cancel',
      confirmVariant: 'accent',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, value ?? '');
      });
      payload.append(
        'existingFiles',
        attachments.map((item) => item.file).join(','),
      );
      payload.append(
        'existingNames',
        attachments.map((item) => item.name).join(','),
      );
      newFiles.forEach((file) => payload.append('attach_file', file));

      await updateVesselPrimary(vesselId, payload);
      navigate(`${fleetPath}?msg=0`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to update vessel.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? (
        <LoadingOverlay active label={saving ? 'Saving vessel…' : 'Loading vessel…'} />
      ) : null}

      <div className={styles.toolbar}>
        <Button variant="outline" label="Back" href={fleetPath} />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <h2 className={styles.subtitle}>UPDATE VESSEL</h2>

      <form onSubmit={handleSubmit}>
        <Section title="Primary Data">
          <VesselField
            id="businessTypeId"
            label="Business Type"
            as="select"
            value={form.businessTypeId}
            onChange={handleBusinessTypeChange}
            options={BUSINESS_TYPE_OPTIONS}
          />
          <VesselField
            id="vesselTypeId"
            label="Vessel Type"
            as="select"
            value={form.vesselTypeId}
            onChange={(value) => updateField('vesselTypeId', value)}
            options={vesselTypeOptions}
            required
          />
          <VesselField id="imoNo" label="IMO number" value={form.imoNo} onChange={(value) => updateField('imoNo', value)} />
          <VesselField id="vesselName" label="Vessel Name" value={form.vesselName} onChange={(value) => updateField('vesselName', value)} />
          <VesselField id="vesselCode" label="Vessel Code" value={form.vesselCode} onChange={(value) => updateField('vesselCode', value)} />
          <VesselField id="yearBuilt" label="Year Built" value={form.yearBuilt} onChange={(value) => updateField('yearBuilt', value)} required />
          <VesselField
            id="flagId"
            label="Flag"
            as="select"
            value={form.flagId}
            onChange={(value) => updateField('flagId', value)}
            options={lookups?.countries ?? []}
            required
          />
          <VesselField id="dwt" label="Summer DWT (MT)" value={form.dwt} onChange={(value) => updateField('dwt', value)} required />
          <VesselField id="draftM" label="Summer Draft (M)" value={form.draftM} onChange={(value) => updateField('draftM', value)} />
          <VesselField id="loa" label="Loa (M)" value={form.loa} onChange={(value) => updateField('loa', value)} />
          <VesselField id="extBreadth" label="Extreme Breadth(M)" value={form.extBreadth} onChange={(value) => updateField('extBreadth', value)} />
          <VesselField id="grtNrt" label="GRT" value={form.grtNrt} onChange={(value) => updateField('grtNrt', value)} />
          <VesselField id="nrt" label="NRT" value={form.nrt} onChange={(value) => updateField('nrt', value)} />
        </Section>

        {showDry ? (
          <Section title="Dry Particulars">
            <VesselField id="grain" label="Grain(M³)" value={form.grain} onChange={(value) => updateField('grain', value)} />
            <VesselField id="bale" label="Bale(M³)" value={form.bale} onChange={(value) => updateField('bale', value)} />
            <VesselField id="noh" label="No. Of Holds" value={form.noh} onChange={(value) => updateField('noh', value)} />
            <VesselField id="noha" label="No. Of Hatches" value={form.noha} onChange={(value) => updateField('noha', value)} />
            <VesselField id="hatchSize" label="Hatch Sizes (Meters)" value={form.hatchSize} onChange={(value) => updateField('hatchSize', value)} />
            <VesselField id="cargoGear" label="Cargo Gear" value={form.cargoGear} onChange={(value) => updateField('cargoGear', value)} />
            <VesselField id="craneSize" label="Crane Size" value={form.craneSize} onChange={(value) => updateField('craneSize', value)} />
            <VesselField id="grabSize" label="Grab Size" value={form.grabSize} onChange={(value) => updateField('grabSize', value)} />
          </Section>
        ) : null}

        {showGas ? (
          <Section title="Gas Particulars">
            <VesselField id="gasCargoTanks" label="No. Of Cargo Tanks" value={form.gasCargoTanks} onChange={(value) => updateField('gasCargoTanks', value)} />
            <VesselField id="gasTankCapacity" label="Cargo Tank Capacity 98%(CBM)" value={form.gasTankCapacity} onChange={(value) => updateField('gasTankCapacity', value)} />
            <VesselField id="gasCargoPumps" label="No. Of Cargo Pump(Main)" value={form.gasCargoPumps} onChange={(value) => updateField('gasCargoPumps', value)} />
            <VesselField id="gasMainCargoPumps" label="Cargo Pumps Main Cap(CBM/Hr)" value={form.gasMainCargoPumps} onChange={(value) => updateField('gasMainCargoPumps', value)} />
            <VesselField id="sizeOfManifolds" label="No. and Size of Manilfolds" value={form.sizeOfManifolds} onChange={(value) => updateField('sizeOfManifolds', value)} />
            <VesselField id="gasSbtCapacity" label="Total SBT Capacity(CBM)" value={form.gasSbtCapacity} onChange={(value) => updateField('gasSbtCapacity', value)} />
          </Section>
        ) : null}

        {showTanker ? (
          <Section title="Tanker Particulars">
            <VesselField id="tankerCapacity" label="Cargo Tank Capacity (CBM)" value={form.tankerCapacity} onChange={(value) => updateField('tankerCapacity', value)} />
            <VesselField id="noOfGrade" label="No. of Grades(Double V/V Seg)" value={form.noOfGrade} onChange={(value) => updateField('noOfGrade', value)} />
            <VesselField id="tankerCargoPump" label="No. Of Cargo Pump(Main)" value={form.tankerCargoPump} onChange={(value) => updateField('tankerCargoPump', value)} />
            <VesselField id="tankerSbtCapacity" label="Total SBT Capacity(CBM)" value={form.tankerSbtCapacity} onChange={(value) => updateField('tankerSbtCapacity', value)} />
            <VesselField id="tankerPumpMainCap" label="Cargo Pump Main Cap(CBM/Hr)" value={form.tankerPumpMainCap} onChange={(value) => updateField('tankerPumpMainCap', value)} />
          </Section>
        ) : null}

        <Section title="Ownership & Attachments">
          <VesselField
            id="piVendorId"
            label="Owners P & I"
            as="select"
            value={form.piVendorId}
            onChange={(value) => updateField('piVendorId', value)}
            options={lookups?.piVendors ?? []}
          />
          <VesselField
            id="classSocId"
            label="Classification Society"
            as="select"
            value={form.classSocId}
            onChange={(value) => updateField('classSocId', value)}
            options={lookups?.classSocieties ?? []}
          />
          <VesselField
            id="ownerVendorId"
            label="Current Owner/Operator"
            as="select"
            value={form.ownerVendorId}
            onChange={(value) => updateField('ownerVendorId', value)}
            options={lookups?.owners ?? []}
          />
          <VesselField
            id="remarks"
            label="Remarks"
            as="textarea"
            value={form.remarks}
            onChange={(value) => updateField('remarks', value)}
          />
          <Field id="attach_file" label="Attachment" className={styles.span2}>
            <TextInput
              id="attach_file"
              type="file"
              multiple
              onChange={(event) => setNewFiles(Array.from(event.target.files ?? []))}
            />
            {attachments.length ? (
              <ul className={styles.attachmentList}>
                {attachments.map((item) => (
                  <li key={item.file}>
                    <a href={item.url} target="_blank" rel="noreferrer">{item.name}</a>
                    <button type="button" onClick={() => removeAttachment(item.file)} aria-label={`Remove ${item.name}`}>
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Field>
        </Section>

        <div className={styles.footer}>
          <Button variant="primary" label="Submit" type="submit" disabled={saving} />
        </div>
      </form>
    </div>
  );
}
