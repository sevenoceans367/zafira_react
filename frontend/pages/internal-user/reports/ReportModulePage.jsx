import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { findReport, getDefaultReportPath } from '../../../constants/reportsMenu.js';
import { getReportDefinition } from '../../../constants/reportsDefinitions.js';
import { hasRegisteredReportPage } from '../../../constants/reportsPageRegistry.js';
import ConfigurableReportPage from './ConfigurableReportPage.jsx';
import ComparisonReportPage from './ComparisonReportPage.jsx';
import DualPlReportPage from './DualPlReportPage.jsx';
import CargoTonnageReportPage from './CargoTonnageReportPage.jsx';
import EditableTrackerPage from './EditableTrackerPage.jsx';
import VesselYearlyPerformancePage from './VesselYearlyPerformancePage.jsx';
import styles from './ReportPlaceholderPage.module.css';

function ReportPlaceholder({ section, item }) {
  return (
    <div className={`zafira-page ${styles.page}`}>
      <div className={`zafira-card ${styles.card}`}>
        <p className={styles.eyebrow}>{section.label}</p>
        <h2 className={styles.title}>{item.label}</h2>
        <p className={styles.note}>
          Placeholder page — paste the report implementation when ready.
        </p>
      </div>
    </div>
  );
}

function LiveReportPage({ reportId }) {
  const definition = getReportDefinition(reportId);
  if (definition?.pageType === 'comparison') {
    return <ComparisonReportPage key={reportId} reportId={reportId} />;
  }
  if (definition?.pageType === 'dualPl') {
    return <DualPlReportPage key={reportId} reportId={reportId} />;
  }
  if (definition?.pageType === 'cargoTonnage') {
    return <CargoTonnageReportPage key={reportId} reportId={reportId} />;
  }
  if (definition?.pageType === 'editableTracker') {
    return <EditableTrackerPage key={reportId} reportId={reportId} />;
  }
  if (definition?.pageType === 'vesselYearly') {
    return <VesselYearlyPerformancePage key={reportId} reportId={reportId} />;
  }
  return <ConfigurableReportPage key={reportId} reportId={reportId} />;
}

export default function ReportModulePage() {
  const { sectionId, reportId } = useParams();
  const found = findReport(sectionId, reportId);

  if (!found) {
    return <Navigate to={getDefaultReportPath()} replace />;
  }

  return hasRegisteredReportPage(reportId) ? (
    <LiveReportPage reportId={reportId} />
  ) : (
    <ReportPlaceholder section={found.section} item={found.item} />
  );
}
