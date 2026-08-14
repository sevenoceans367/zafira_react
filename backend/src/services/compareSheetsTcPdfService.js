import { getCompareSheetsTc } from './compareSheetsTcService.js';
import { renderCompareSheetsPdf, safeFilename, value } from './compareSheetsPdfLayout.js';

export async function generateCompareSheetsTcPdf(comId) {
  const data = await getCompareSheetsTc(comId);
  const h = data.header || {};
  const stamp = new Date().toISOString().slice(0, 10);
  return renderCompareSheetsPdf(data, {
    title: 'Time Charter — Compare Sheets',
    filename: `${safeFilename(h.tcNo || `COM-${comId}`)}-Compare-Sheets-${stamp}.pdf`,
    headerFields: [
      { label: 'Vessel Name', value: value(h.vesselName) },
      { label: 'Vessel Type', value: value(h.vesselType) },
      { label: 'DWT Summer', value: value(h.dwtSummer) },
      { label: 'Fixture Date', value: value(h.fixtureDate) },
      { label: 'CP Date', value: value(h.cpDate) },
      { label: 'TC No', value: value(h.tcNo) },
    ],
  });
}
