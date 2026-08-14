import { getCompareSheetsVc } from './compareSheetsVcService.js';
import { renderCompareSheetsPdf, safeFilename, value } from './compareSheetsPdfLayout.js';

export async function generateCompareSheetsVcPdf(comId) {
  const data = await getCompareSheetsVc(comId);
  const h = data.header || {};
  const stamp = new Date().toISOString().slice(0, 10);
  return renderCompareSheetsPdf(data, {
    title: 'Voyage Financials — Compare Sheets',
    filename: `${safeFilename(h.voyageNo || `COM-${comId}`)}-Compare-Sheets-${stamp}.pdf`,
    headerFields: [
      { label: 'Vessel Name', value: value(h.vesselName) },
      { label: 'Vessel Type', value: value(h.vesselType) },
      { label: 'Flag', value: value(h.flag) },
      { label: 'Fixture Date', value: value(h.fixtureDate) },
      { label: 'Voyage No.', value: value(h.voyageNo) },
      { label: 'Voyage Financials Name', value: value(h.voyageName) },
      { label: 'DWT Summer', value: value(h.dwtSummer) },
      { label: 'DWT Tropical', value: value(h.dwtTropical) },
    ],
  });
}
