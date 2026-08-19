import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfirmProvider } from '@bainbridge/shared-ui';
import {
  installBasePathGlobals,
  installLinkInterceptor,
} from '@bainbridge/shared-routing';
import RequireAuth from '../components/RequireAuth.jsx';
import InternalUserLayout from '../components/Layout/InternalUserLayout.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import ModuleHomePage from '../pages/internal-user/ModuleHomePage.jsx';
import ReportsPage from '../pages/internal-user/ReportsPage.jsx';
import ReportModulePage from '../pages/internal-user/reports/ReportModulePage.jsx';
import { getDefaultReportPath } from '../constants/reportsMenu.js';
import VcDashboardPage from '../pages/internal-user/vc/VcDashboardPage.jsx';
import RunningCoasListPage from '../pages/internal-user/coa/RunningCoasListPage.jsx';
import CoaFormPage from '../pages/internal-user/coa/CoaFormPage.jsx';
import CargoReletListPage from '../pages/internal-user/coa/CargoReletListPage.jsx';
import CargoReletFormPage from '../pages/internal-user/coa/CargoReletFormPage.jsx';
import CoaInOpsPage from '../pages/internal-user/coa/CoaInOpsPage.jsx';
import CoaPostOpsPage from '../pages/internal-user/coa/CoaPostOpsPage.jsx';
import OpsVcInOpsGlancePage from '../pages/internal-user/ops/OpsVcInOpsGlancePage.jsx';
import OpsVcPostOpsPage from '../pages/internal-user/ops/OpsVcPostOpsPage.jsx';
import OpsVcHistoryPage from '../pages/internal-user/ops/OpsVcHistoryPage.jsx';
import OpsVcYearUpdationPage from '../pages/internal-user/ops/OpsVcYearUpdationPage.jsx';
import OpsVcVoyageReportPage from '../pages/internal-user/ops/OpsVcVoyageReportPage.jsx';
import OpsVcAgencyLetterPage from '../pages/internal-user/ops/OpsVcAgencyLetterPage.jsx';
import OpsVcPdaFdaPage from '../pages/internal-user/ops/OpsVcPdaFdaPage.jsx';
import OpsVcDocumentsPage from '../pages/internal-user/ops/OpsVcDocumentsPage.jsx';
import OpsVcPaymentGridPage from '../pages/internal-user/ops/OpsVcPaymentGridPage.jsx';
import OpsVcFreightInvoicePage from '../pages/internal-user/ops/OpsVcFreightInvoicePage.jsx';
import OpsVcRequestPortCostPage from '../pages/internal-user/ops/OpsVcRequestPortCostPage.jsx';
import OpsVcOtherInvoicePage from '../pages/internal-user/ops/OpsVcOtherInvoicePage.jsx';
import OpsVcHireStatementPage from '../pages/internal-user/ops/OpsVcHireStatementPage.jsx';
import OpsVcClubbedInvoicePage from '../pages/internal-user/ops/OpsVcClubbedInvoicePage.jsx';
import OpsVcClubbedHirePage from '../pages/internal-user/ops/OpsVcClubbedHirePage.jsx';
import OpsVcSofPage from '../pages/internal-user/ops/OpsVcSofPage.jsx';
import OpsVcLaytimePage from '../pages/internal-user/ops/OpsVcLaytimePage.jsx';
import OpsVcBunkerPage from '../pages/internal-user/ops/OpsVcBunkerPage.jsx';
import OpsVcSoaReportPage from '../pages/internal-user/ops/OpsVcSoaReportPage.jsx';
import OpsVcCostSheetPage from '../pages/internal-user/ops/OpsVcCostSheetPage.jsx';
import OpsVcChecklistPage from '../pages/internal-user/ops/OpsVcChecklistPage.jsx';
import OpsTcFinalisedFixturesPage from '../pages/internal-user/ops/OpsTcFinalisedFixturesPage.jsx';
import OpsTcInOpsGlancePage from '../pages/internal-user/ops/OpsTcInOpsGlancePage.jsx';
import OpsTcChecklistPage from '../pages/internal-user/ops/OpsTcChecklistPage.jsx';
import OpsTcFixtureNotePage from '../pages/internal-user/ops/OpsTcFixtureNotePage.jsx';
import OpsTcCostSheetPage from '../pages/internal-user/ops/OpsTcCostSheetPage.jsx';
import OpsTcAgencyLetterPage from '../pages/internal-user/ops/OpsTcAgencyLetterPage.jsx';
import OpsTcDocumentsPage from '../pages/internal-user/ops/OpsTcDocumentsPage.jsx';
import OpsTcPaymentGridPage from '../pages/internal-user/ops/OpsTcPaymentGridPage.jsx';
import OpsTcPostOpsPage from '../pages/internal-user/ops/OpsTcPostOpsPage.jsx';
import OpsTcHistoryPage from '../pages/internal-user/ops/OpsTcHistoryPage.jsx';
import OpsTcYearUpdationPage from '../pages/internal-user/ops/OpsTcYearUpdationPage.jsx';
import CombinedSoaPayablePage from '../pages/internal-user/combined-soa-payable/CombinedSoaPayablePage.jsx';
import CombinedSoaPayableTcPage from '../pages/internal-user/combined-soa-payable/CombinedSoaPayableTcPage.jsx';
import GenericFinancesPage from '../pages/internal-user/generic-finances/GenericFinancesPage.jsx';
import AddGenericInvoicePage from '../pages/internal-user/generic-finances/AddGenericInvoicePage.jsx';
import FleetPage from '../pages/internal-user/fleet/FleetPage.jsx';
import AddVesselPage from '../pages/internal-user/fleet/AddVesselPage.jsx';
import UpdateVesselPage from '../pages/internal-user/fleet/UpdateVesselPage.jsx';
import ViewVesselTankersPage from '../pages/internal-user/fleet/ViewVesselTankersPage.jsx';
import UpdateVesselTankersPage from '../pages/internal-user/fleet/UpdateVesselTankersPage.jsx';
import CommercialParametersPage from '../pages/internal-user/fleet/CommercialParametersPage.jsx';
import PeriodContractListPage from '../pages/internal-user/period-contract/PeriodContractListPage.jsx';
import AddPeriodContractPage from '../pages/internal-user/period-contract/AddPeriodContractPage.jsx';
import ElibraryPage from '../pages/internal-user/elibrary/ElibraryPage.jsx';
import ElibraryFormPage from '../pages/internal-user/elibrary/ElibraryFormPage.jsx';
import UserGuidesPage from '../pages/internal-user/user-guides/UserGuidesPage.jsx';
import UserGuideViewerPage from '../pages/internal-user/user-guides/UserGuideViewerPage.jsx';
import ToDoListPage from '../pages/internal-user/todo-list/ToDoListPage.jsx';
import MasterModulePage from '../pages/internal-user/masters/MasterModulePage.jsx';
import TcModulePage from '../pages/internal-user/tc/TcModulePage.jsx';
import TcOutEstimatesListPage from '../pages/internal-user/tc/TcOutEstimatesListPage.jsx';
import TcFixtureFormPage from '../pages/internal-user/tc/TcFixtureFormPage.jsx';
import TcCalculatePage from '../pages/internal-user/tc/TcCalculatePage.jsx';
import TcViewPage from '../pages/internal-user/tc/TcViewPage.jsx';
import TcDecisionChartsListPage from '../pages/internal-user/tc/TcDecisionChartsListPage.jsx';
import EstimateListPage from '../pages/internal-user/sopf/EstimateListPage.jsx';
import UpdateEstimatePage from '../pages/internal-user/sopf/UpdateEstimatePage.jsx';
import AddEstimatePage from '../pages/internal-user/sopf/AddEstimatePage.jsx';
import ViewEstimatePage from '../pages/internal-user/sopf/ViewEstimatePage.jsx';
import VesselPositionPage from '../pages/internal-user/sopf/VesselPositionPage.jsx';
import SupportTicketPage from '../pages/internal-user/sopf/SupportTicketPage.jsx';
import LiveVesselMapPage from '../pages/internal-user/live-vessel-map/LiveVesselMapPage.jsx';
import {
  LIVE_VESSEL_MAP_ENABLED,
  LIVE_VESSEL_MAP_PATH,
} from '../pages/internal-user/live-vessel-map/liveVesselMap.feature.js';
import SopfComingSoonPage from '../pages/internal-user/sopf/SopfComingSoonPage.jsx';

installBasePathGlobals();
installLinkInterceptor();

export default function App() {
  const base = import.meta.env.VITE_APP_BASE || undefined;

  return (
    <ConfirmProvider>
      <BrowserRouter basename={base}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={(
              <RequireAuth>
                <InternalUserLayout />
              </RequireAuth>
            )}
          >
            <Route path="/" element={<ModuleHomePage />} />
            {LIVE_VESSEL_MAP_ENABLED ? (
              <Route path={LIVE_VESSEL_MAP_PATH} element={<LiveVesselMapPage />} />
            ) : null}
            <Route path="/reports" element={<ReportsPage />} />
            <Route
              path="/internal-user/vc/reports"
              element={<Navigate to={getDefaultReportPath()} replace />}
            />
            <Route
              path="/internal-user/vc/reports/:sectionId/:reportId"
              element={<ReportModulePage />}
            />
            <Route path="/internal-user/vc" element={<VcDashboardPage />} />
            <Route path="/internal-user/vc/ops/in-ops-glance" element={<OpsVcInOpsGlancePage />} />
            <Route path="/internal-user/vc/ops/cost-sheet" element={<OpsVcCostSheetPage />} />
            <Route path="/internal-user/vc/ops/voyage-report" element={<OpsVcVoyageReportPage />} />
            <Route path="/internal-user/vc/ops/agency-letter" element={<OpsVcAgencyLetterPage />} />
            <Route path="/internal-user/vc/ops/pda-fda" element={<OpsVcPdaFdaPage />} />
            <Route path="/internal-user/vc/ops/documents" element={<OpsVcDocumentsPage />} />
            <Route path="/internal-user/vc/ops/payment-grid" element={<OpsVcPaymentGridPage />} />
            <Route path="/internal-user/vc/ops/freight-invoice" element={<OpsVcFreightInvoicePage />} />
            <Route path="/internal-user/vc/ops/request-port-cost" element={<OpsVcRequestPortCostPage />} />
            <Route path="/internal-user/vc/ops/other-invoice" element={<OpsVcOtherInvoicePage />} />
            <Route path="/internal-user/vc/ops/hire-statement" element={<OpsVcHireStatementPage />} />
            <Route path="/internal-user/vc/ops/clubbed-invoice" element={<OpsVcClubbedInvoicePage />} />
            <Route path="/internal-user/vc/ops/clubbed-hire" element={<OpsVcClubbedHirePage />} />
            <Route path="/internal-user/vc/ops/sof" element={<OpsVcSofPage />} />
            <Route path="/internal-user/vc/ops/checklist" element={<OpsVcChecklistPage />} />
            <Route path="/internal-user/vc/ops/laytime" element={<OpsVcLaytimePage />} />
            <Route path="/internal-user/vc/ops/bunker" element={<OpsVcBunkerPage />} />
            <Route path="/internal-user/vc/ops/soa-report" element={<OpsVcSoaReportPage />} />
            <Route path="/internal-user/vc/ops/post-ops" element={<OpsVcPostOpsPage />} />
            <Route path="/internal-user/vc/ops/history" element={<OpsVcHistoryPage />} />
            <Route path="/internal-user/vc/ops/year-updation" element={<OpsVcYearUpdationPage />} />
            <Route
              path="/internal-user/vc/ops-tc/finalised-fixtures"
              element={<OpsTcFinalisedFixturesPage />}
            />
            <Route
              path="/internal-user/vc/ops-tc/in-ops-glance"
              element={<OpsTcInOpsGlancePage />}
            />
            <Route
              path="/internal-user/vc/ops-tc/checklist"
              element={<OpsTcChecklistPage />}
            />
            <Route
              path="/internal-user/vc/ops-tc/fixture-note"
              element={<OpsTcFixtureNotePage />}
            />
            <Route
              path="/internal-user/vc/ops-tc/cost-sheet"
              element={<OpsTcCostSheetPage />}
            />
            <Route
              path="/internal-user/vc/ops-tc/agency-letter"
              element={<OpsTcAgencyLetterPage />}
            />
            <Route
              path="/internal-user/vc/ops-tc/documents"
              element={<OpsTcDocumentsPage />}
            />
            <Route
              path="/internal-user/vc/ops-tc/payment-grid"
              element={<OpsTcPaymentGridPage />}
            />
            <Route
              path="/internal-user/vc/ops-tc/post-ops"
              element={<OpsTcPostOpsPage />}
            />
            <Route
              path="/internal-user/vc/ops-tc/history"
              element={<OpsTcHistoryPage />}
            />
            <Route
              path="/internal-user/vc/ops-tc/year-updation"
              element={<OpsTcYearUpdationPage />}
            />
            <Route
              path="/internal-user/vc/combined-soa-payable"
              element={<CombinedSoaPayablePage />}
            />
            <Route
              path="/internal-user/vc/combined-soa-payable-tc"
              element={<CombinedSoaPayableTcPage />}
            />
            <Route
              path="/internal-user/vc/generic-finances"
              element={<GenericFinancesPage />}
            />
            <Route
              path="/internal-user/vc/generic-finances/add"
              element={<AddGenericInvoicePage />}
            />
            <Route
              path="/internal-user/vc/generic-finances/:invoiceId/edit"
              element={<AddGenericInvoicePage />}
            />
            <Route path="/internal-user/vc/decision-chart-tc" element={<TcDecisionChartsListPage />} />
            <Route path="/internal-user/vc/tc" element={<TcOutEstimatesListPage />} />
            <Route path="/internal-user/vc/tc/add" element={<TcFixtureFormPage mode="add" />} />
            <Route
              path="/internal-user/vc/tc/decision-charts"
              element={<Navigate to="/internal-user/vc/decision-chart-tc" replace />}
            />
            <Route path="/internal-user/vc/tc/:tcOutId/edit" element={<TcFixtureFormPage mode="edit" />} />
            <Route path="/internal-user/vc/tc/:tcOutId/calculate" element={<TcCalculatePage />} />
            <Route path="/internal-user/vc/tc/:tcOutId/view" element={<TcViewPage />} />
            <Route path="/internal-user/tc" element={<TcModulePage />} />

            <Route path="/internal-user/:module/coas/running/add" element={<CoaFormPage mode="add" />} />
            <Route path="/internal-user/:module/coas/running/:coaId" element={<CoaFormPage mode="edit" />} />
            <Route path="/internal-user/:module/coas/running" element={<RunningCoasListPage />} />
            <Route path="/internal-user/:module/coas/cargo-relet/add" element={<CargoReletFormPage mode="add" />} />
            <Route path="/internal-user/:module/coas/cargo-relet/:fcaId" element={<CargoReletFormPage mode="edit" />} />
            <Route path="/internal-user/:module/coas/cargo-relet" element={<CargoReletListPage />} />
            <Route path="/internal-user/:module/coas/in-ops" element={<CoaInOpsPage />} />
            <Route path="/internal-user/:module/coas/post-ops" element={<CoaPostOpsPage />} />
            <Route path="/internal-user/:module/fleet" element={<FleetPage />} />
            <Route path="/internal-user/:module/fleet/add" element={<AddVesselPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/primary" element={<UpdateVesselPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/particulars" element={<ViewVesselTankersPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/particulars-tanker" element={<ViewVesselTankersPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/particulars-tanker/edit" element={<UpdateVesselTankersPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/particulars/edit" element={<UpdateVesselTankersPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/commercial" element={<CommercialParametersPage />} />
            <Route path="/internal-user/:module/period-contracts/add" element={<AddPeriodContractPage />} />
            <Route path="/internal-user/:module/period-contracts/edit/:id" element={<AddPeriodContractPage />} />
            <Route path="/internal-user/:module/period-contracts" element={<PeriodContractListPage />} />
            <Route path="/internal-user/:module/elibrary/add" element={<ElibraryFormPage />} />
            <Route path="/internal-user/:module/elibrary/edit/:id" element={<ElibraryFormPage />} />
            <Route path="/internal-user/:module/elibrary" element={<ElibraryPage />} />
            <Route path="/internal-user/:module/user-guides/:guideId" element={<UserGuideViewerPage />} />
            <Route path="/internal-user/:module/user-guides" element={<UserGuidesPage />} />
            <Route path="/internal-user/:module/todo-list" element={<ToDoListPage />} />
            <Route path="/internal-user/:module/masters/:masterId" element={<MasterModulePage />} />

            <Route path="/internal-user/sopf/estimate_list" element={<EstimateListPage />} />
            <Route path="/internal-user/sopf/addestimate" element={<AddEstimatePage />} />
            <Route path="/internal-user/sopf/updateestimate" element={<UpdateEstimatePage />} />
            <Route path="/internal-user/sopf/viewestimate" element={<ViewEstimatePage />} />
            <Route path="/internal-user/sopf/vessel_position" element={<VesselPositionPage />} />
            <Route path="/internal-user/sopf/support_ticket" element={<SupportTicketPage />} />
            <Route
              path="/internal-user/sopf/pools"
              element={(
                <SopfComingSoonPage
                  title="Pools"
                  description="Pools chartering desk screens will appear here."
                />
              )}
            />
            <Route path="/internal-user/sopf/time-charter/add" element={<TcFixtureFormPage mode="add" />} />
            <Route path="/internal-user/sopf/time-charter/decision-charts" element={<TcDecisionChartsListPage />} />
            <Route path="/internal-user/sopf/time-charter/:tcOutId/edit" element={<TcFixtureFormPage mode="edit" />} />
            <Route path="/internal-user/sopf/time-charter/:tcOutId/calculate" element={<TcCalculatePage />} />
            <Route path="/internal-user/sopf/time-charter/:tcOutId/view" element={<TcViewPage />} />
            <Route path="/internal-user/sopf/time-charter" element={<TcOutEstimatesListPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfirmProvider>
  );
}
