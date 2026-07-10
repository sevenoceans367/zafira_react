import AgencyFeeRecordsPage from './agency-fee/AgencyFeeRecordsPage.jsx';
import BalticDryIndexPage from './baltic-dry-index/BalticDryIndexPage.jsx';
import BunkerGradePage from './bunker-grade/BunkerGradePage.jsx';
import ChartererCostPage from './charterer-cost/ChartererCostPage.jsx';
import CoaRoutePage from './coa-route/CoaRoutePage.jsx';
import ContractTypePage from './contract-type/ContractTypePage.jsx';
import ElibraryCategoryPage from './elibrary-category/ElibraryCategoryPage.jsx';
import ElibraryReferenceTypePage from './elibrary-reference-type/ElibraryReferenceTypePage.jsx';
import ExpenseTypePage from './expense-type/ExpenseTypePage.jsx';
import InvoiceStatusPage from './invoice-status/InvoiceStatusPage.jsx';
import LawArbitrationPage from './law-arbitration/LawArbitrationPage.jsx';
import LoadOptionsPage from './load-options/LoadOptionsPage.jsx';
import MaterialPage from './material/MaterialPage.jsx';
import MsdsPage from './msds/MsdsPage.jsx';
import EstimatedRatioPage from './pc-ums-dwt-ratio/EstimatedRatioPage.jsx';
import MasterPlaceholderPage from './MasterPlaceholderPage.jsx';

/**
 * Map master module ids to list pages.
 * New masters should use MastersHeaderActions (search + variant="add" label="Add").
 */
export const MASTER_PAGES = {
  'agency-fee-records': AgencyFeeRecordsPage,
  'baltic-dry-index': BalticDryIndexPage,
  'bunker-grade': BunkerGradePage,
  'charterer-cost': ChartererCostPage,
  'coa-route': CoaRoutePage,
  'contract-type': ContractTypePage,
  'expense-type': ExpenseTypePage,
  'elibrary-category': ElibraryCategoryPage,
  'elibrary-reference-type': ElibraryReferenceTypePage,
  'invoice-status-list': InvoiceStatusPage,
  'pc-ums-dwt-ratio': EstimatedRatioPage,
  'law-arbitration-list': LawArbitrationPage,
  'load-options': LoadOptionsPage,
  material: MaterialPage,
  'material-safety-data-sheets': MsdsPage,
};

export function resolveMasterPage(masterId) {
  return MASTER_PAGES[masterId] ?? MasterPlaceholderPage;
}
