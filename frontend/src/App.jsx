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
import VcDashboardPage from '../pages/internal-user/vc/VcDashboardPage.jsx';
import RunningCoasListPage from '../pages/internal-user/coa/RunningCoasListPage.jsx';
import CoaFormPage from '../pages/internal-user/coa/CoaFormPage.jsx';
import CargoReletListPage from '../pages/internal-user/coa/CargoReletListPage.jsx';
import CargoReletFormPage from '../pages/internal-user/coa/CargoReletFormPage.jsx';
import CoaInOpsPage from '../pages/internal-user/coa/CoaInOpsPage.jsx';
import CoaPostOpsPage from '../pages/internal-user/coa/CoaPostOpsPage.jsx';
import FleetPage from '../pages/internal-user/fleet/FleetPage.jsx';
import AddVesselPage from '../pages/internal-user/fleet/AddVesselPage.jsx';
import UpdateVesselPage from '../pages/internal-user/fleet/UpdateVesselPage.jsx';
import ViewVesselTankersPage from '../pages/internal-user/fleet/ViewVesselTankersPage.jsx';
import UpdateVesselTankersPage from '../pages/internal-user/fleet/UpdateVesselTankersPage.jsx';
import CommercialParametersPage from '../pages/internal-user/fleet/CommercialParametersPage.jsx';
import PeriodContractListPage from '../pages/internal-user/period-contract/PeriodContractListPage.jsx';
import AddPeriodContractPage from '../pages/internal-user/period-contract/AddPeriodContractPage.jsx';
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
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/internal-user/vc" element={<VcDashboardPage />} />
            <Route path="/internal-user/vc/coas/running" element={<RunningCoasListPage />} />
            <Route path="/internal-user/vc/coas/running/add" element={<CoaFormPage mode="add" />} />
            <Route path="/internal-user/vc/coas/running/:coaId" element={<CoaFormPage mode="edit" />} />
            <Route path="/internal-user/vc/coas/cargo-relet" element={<CargoReletListPage />} />
            <Route path="/internal-user/vc/coas/cargo-relet/add" element={<CargoReletFormPage mode="add" />} />
            <Route path="/internal-user/vc/coas/cargo-relet/:fcaId" element={<CargoReletFormPage mode="edit" />} />
            <Route path="/internal-user/vc/coas/in-ops" element={<CoaInOpsPage />} />
            <Route path="/internal-user/vc/coas/post-ops" element={<CoaPostOpsPage />} />
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

            <Route path="/internal-user/:module/fleet" element={<FleetPage />} />
            <Route path="/internal-user/:module/fleet/add" element={<AddVesselPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/primary" element={<UpdateVesselPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/particulars" element={<ViewVesselTankersPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/particulars-tanker" element={<ViewVesselTankersPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/particulars-tanker/edit" element={<UpdateVesselTankersPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/particulars/edit" element={<UpdateVesselTankersPage />} />
            <Route path="/internal-user/:module/fleet/vessel/:id/commercial" element={<CommercialParametersPage />} />
            <Route path="/internal-user/:module/period-contracts/add" element={<AddPeriodContractPage />} />
            <Route path="/internal-user/:module/period-contracts" element={<PeriodContractListPage />} />
            <Route path="/internal-user/:module/todo-list" element={<ToDoListPage />} />
            <Route path="/internal-user/:module/masters/:masterId" element={<MasterModulePage />} />

            <Route path="/internal-user/sopf/estimate_list" element={<EstimateListPage />} />
            <Route path="/internal-user/sopf/addestimate" element={<AddEstimatePage />} />
            <Route path="/internal-user/sopf/updateestimate" element={<UpdateEstimatePage />} />
            <Route path="/internal-user/sopf/viewestimate" element={<ViewEstimatePage />} />
            <Route path="/internal-user/sopf/vessel_position" element={<VesselPositionPage />} />
            <Route path="/internal-user/sopf/support_ticket" element={<SupportTicketPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfirmProvider>
  );
}
