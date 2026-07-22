import { appPath } from '@bainbridge/shared-routing';
import { REPORTS_BASE, findReport } from './reportsMenu.js';

const HOME = { label: 'Home', href: appPath('/') };
const SOC = { label: 'SOC', href: appPath('/internal-user/vc') };
const REPORTS = { label: 'Reports', href: appPath(REPORTS_BASE) };

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
      return {
        title: 'Reports',
        currentPage: found.item.label,
        breadcrumbs: [
          HOME,
          SOC,
          REPORTS,
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
