/**
 * Live report ids for ReportModulePage.
 */
import {
  LIVE_REPORT_IDS,
  getReportDefinition,
} from './reportsDefinitions.js';

export function hasRegisteredReportPage(reportId) {
  return LIVE_REPORT_IDS.includes(reportId);
}

export function resolveReportPageType(reportId) {
  return getReportDefinition(reportId)?.pageType || 'configurable';
}
