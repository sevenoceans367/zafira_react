import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import { fetchCompareSheetsTc, downloadCompareSheetsTcPdf } from '../../../services/opsTc.js';
import CompareSheetsDialog from './CompareSheetsDialog.jsx';
import styles from './CompareSheetsDialog.module.css';

export default function OpsTcCompareSheetsModal({ open, comId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    if (!open || !comId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setData(null);
      try {
        const result = await fetchCompareSheetsTc(comId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load compare sheets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, comId]);

  const handleGeneratePdf = async () => {
    if (!comId || pdfLoading) return;
    setPdfLoading(true);
    setPdfError('');
    try {
      await downloadCompareSheetsTcPdf(comId);
    } catch (err) {
      setPdfError(err.message || 'Failed to generate Compare Sheet PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const header = data?.header || {};

  return (
    <CompareSheetsDialog
      open={open}
      loading={loading}
      error={error || pdfError}
      data={data}
      onClose={onClose}
      title="Compare Working Sheets"
      headerFields={[
        { label: 'Vessel Name', value: header.vesselName },
        { label: 'Vessel Type', value: header.vesselType },
        { label: 'DWT Summer', value: header.dwtSummer },
        { label: 'Fixture Date', value: header.fixtureDate },
        { label: 'CP Date', value: header.cpDate },
        { label: 'TC No', value: header.tcNo },
      ]}
      onDownloadPdf={handleGeneratePdf}
      pdfLoading={pdfLoading}
      renderLabel={(row) => (
        row.label === 'Other expenses(USD)' ? (
          <Link
            className={styles.labelLink}
            to={appPath(`/internal-user/vc/ops-tc/payment-grid?comid=${encodeURIComponent(comId)}&page=1`)}
          >
            {row.label}
          </Link>
        ) : row.label
      )}
    />
  );
}
