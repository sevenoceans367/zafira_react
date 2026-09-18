import { appPath } from '@bainbridge/shared-routing';
import { REPORTS_BASE, findReport } from './reportsMenu.js';
import { getReportDefinition } from './reportsDefinitions.js';

const HOME = { label: 'Home', href: appPath('/') };
const SOC = { label: 'SOC', href: appPath('/internal-user/vc') };

export function resolveReportsHeader(pathname) {
  if (!pathname.startsWith(REPORTS_BASE) && pathname !== '/reports') {
    return null;
  }

  const match = pathname.match(
    /^\/internal-user\/vc\/reports\/([^/]+)\/([^/]+)/,
  );
  if (match) {
    const found = findReport(match[1], match[2]);
    if (found) {
      const definition = getReportDefinition(match[2]);
      const title = definition?.title || found.item.label;
      return {
        title,
        currentPage: title,
        breadcrumbs: [
          HOME,
          SOC,
          { label: found.section.label },
        ],
      };
    }
  }

  return {
    title: 'Reports',
    currentPage: 'Reports',
    breadcrumbs: [HOME, SOC, { label: 'Reports' }],
  };
}
