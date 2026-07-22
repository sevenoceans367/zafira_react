import React from 'react';
import { Navigate } from 'react-router-dom';
import { getDefaultReportPath } from '../../constants/reportsMenu.js';

/** Legacy `/reports` entry — send users into the Reports menu. */
export default function ReportsPage() {
  return <Navigate to={getDefaultReportPath()} replace />;
}
