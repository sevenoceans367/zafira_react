import React, { useEffect, useState } from 'react';
import { fetchCompareSheetsVc, downloadCompareSheetsVcPdf } from '../../../services/opsVc.js';
import CompareSheetsDialog from './CompareSheetsDialog.jsx';

/** PHP options.php?id=131 getCompareSheetData — VC Voyage Financials compare. */
export default function OpsVcCompareSheetsModal({ open, comId, onClose }) {
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
        const result = await fetchCompareSheetsVc(comId);
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
      await downloadCompareSheetsVcPdf(comId);
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
        { label: 'Flag', value: header.flag },
        { label: 'Fixture Date', value: header.fixtureDate },
        { label: 'Voyage No. / COA / Spot', value: header.voyageNo },
        { label: 'Voyage Financials Name', value: header.voyageName },
        { label: 'DWT (Summer)', value: header.dwtSummer },
        { label: 'DWT (Tropical)', value: header.dwtTropical },
      ]}
      onDownloadPdf={handleGeneratePdf}
      pdfLoading={pdfLoading}
    />
  );
}
