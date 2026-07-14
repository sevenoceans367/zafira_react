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
import NecessaryApprovalPage from './necessary-approval/NecessaryApprovalPage.jsx';
import OtherMiscCostPage from './other-miscellaneous-cost/OtherMiscCostPage.jsx';
import OtherShippingCostPage from './other-shipping-cost/OtherShippingCostPage.jsx';
import OwnerRelatedCostPage from './owner-related-cost/OwnerRelatedCostPage.jsx';
import EstimatedRatioPage from './pc-ums-dwt-ratio/EstimatedRatioPage.jsx';
import PcctfPage from './panama-canal-capacity-tariff/PcctfPage.jsx';
import PcftfPage from './panama-canal-fixed-transit/PcftfPage.jsx';
import PortCostTypePage from './port-cost-type/PortCostTypePage.jsx';
import PortDataPage from './port-data/PortDataPage.jsx';
import PortInformationPage from './port-information/PortInformationPage.jsx';
import RateNetTonPage from './rate-net-ton/RateNetTonPage.jsx';
import ScntPage from './scnt/ScntPage.jsx';
import SdrRatesPage from './sdr-rates/SdrRatesPage.jsx';
import TcDeductionsPage from './tc-deductions/TcDeductionsPage.jsx';
import TerminalPage from './terminal/TerminalPage.jsx';
import VendorPage from './vendor/VendorPage.jsx';
import VcDeductionsPage from './vc-deductions/VcDeductionsPage.jsx';
import VesselTypePage from './vessel-type/VesselTypePage.jsx';
import VesselCategoryPage from './vessel-category/VesselCategoryPage.jsx';
import AccountingGroupPage from './accounting-group/AccountingGroupPage.jsx';
import AccountingLedgerPage from './accounting-ledger/AccountingLedgerPage.jsx';
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
  'necessary-approval': NecessaryApprovalPage,
  'other-miscellaneous-cost': OtherMiscCostPage,
  'other-shipping-cost': OtherShippingCostPage,
  'owner-related-cost': OwnerRelatedCostPage,
  'panama-canal-capacity-tariff': PcctfPage,
  'panama-canal-fixed-transit': PcftfPage,
  'pc-ums-dwt-ratio': EstimatedRatioPage,
  'port-cost-type': PortCostTypePage,
  'port-data': PortDataPage,
  'port-information': PortInformationPage,
  'rate-net-ton': RateNetTonPage,
  scnt: ScntPage,
  'sdr-rates': SdrRatesPage,
  'tc-deductions': TcDeductionsPage,
  terminal: TerminalPage,
  vendor: VendorPage,
  'vc-deductions': VcDeductionsPage,
  'vessel-type': VesselTypePage,
  'vessel-category': VesselCategoryPage,
  'accounting-group': AccountingGroupPage,
  'accounting-ledger': AccountingLedgerPage,
  'law-arbitration-list': LawArbitrationPage,
  'load-options': LoadOptionsPage,
  material: MaterialPage,
  'material-safety-data-sheets': MsdsPage,
};

export function resolveMasterPage(masterId) {
  return MASTER_PAGES[masterId] ?? MasterPlaceholderPage;
}
