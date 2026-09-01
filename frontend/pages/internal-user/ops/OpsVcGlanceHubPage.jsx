import React from 'react';
import { useSearchParams } from 'react-router-dom';
import OpsVcHistoryPage from './OpsVcHistoryPage.jsx';
import OpsVcInOpsGlancePage from './OpsVcInOpsGlancePage.jsx';
import OpsVcPostOpsPage from './OpsVcPostOpsPage.jsx';
import { parseOpsVcTab } from './OpsVcStatusTabs.jsx';

export default function OpsVcGlanceHubPage() {
  const [searchParams] = useSearchParams();
  const tab = parseOpsVcTab(searchParams.get('tab'));
  if (tab === 'post-ops') return <OpsVcPostOpsPage />;
  if (tab === 'history') return <OpsVcHistoryPage />;
  return <OpsVcInOpsGlancePage />;
}
