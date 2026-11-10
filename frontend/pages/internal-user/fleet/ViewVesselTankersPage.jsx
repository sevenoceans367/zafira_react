import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { fetchTankerParticulars, downloadTankerParticularsPdf } from '../../../services/vesselTankerParticulars.js';
import { useFleetModule } from '../../../hooks/useFleetModule.js';
import VesselParticularsReadonlyContent from './VesselParticularsReadonlyContent.jsx';
import styles from './ViewVesselTankersPage.module.css';

export default function ViewVesselTankersPage() {
  const { fleetPath } = useFleetModule();
  const { id: vesselId } = useParams();
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

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

  const vesselName = data?.vessel?.name || 'Vessel';

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

      {data ? (
        <VesselParticularsReadonlyContent
          data={data}
          vesselId={vesselId}
          canUpload
          onRefresh={loadParticulars}
        />
      ) : null}
    </div>
  );
}
