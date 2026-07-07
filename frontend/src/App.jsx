import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfirmProvider } from '@bainbridge/shared-ui';
import {
  installBasePathGlobals,
  installLinkInterceptor,
} from '@bainbridge/shared-routing';
import InternalUserLayout from '../components/Layout/InternalUserLayout.jsx';
import DashboardPage from '../pages/internal-user/DashboardPage.jsx';
import ReportsPage from '../pages/internal-user/ReportsPage.jsx';
import EstimateListPage from '../pages/internal-user/sopf/EstimateListPage.jsx';
import UpdateEstimatePage from '../pages/internal-user/sopf/UpdateEstimatePage.jsx';
import ViewEstimatePage from '../pages/internal-user/sopf/ViewEstimatePage.jsx';

installBasePathGlobals();
installLinkInterceptor();

export default function App() {
  const base = import.meta.env.VITE_APP_BASE || undefined;

  return (
    <ConfirmProvider>
      <BrowserRouter basename={base}>
        <Routes>
          <Route element={<InternalUserLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/internal-user/sopf/estimate_list" element={<EstimateListPage />} />
            <Route path="/internal-user/sopf/updateestimate" element={<UpdateEstimatePage />} />
            <Route path="/internal-user/sopf/viewestimate" element={<ViewEstimatePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfirmProvider>
  );
}
