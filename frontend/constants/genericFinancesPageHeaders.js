import { appPath } from '@bainbridge/shared-routing';

export const GENERIC_FINANCES_SEGMENT = 'generic-finances';

const SOC = { label: 'SOC', href: appPath('/internal-user/vc') };

export function genericFinancesAppPath() {
  return appPath(`/internal-user/vc/${GENERIC_FINANCES_SEGMENT}`);
}

/**
 * Global layout header for GENERIC FINANCES.
 * AppHeader always prefixes Home and appends `currentPage`, so
 * `breadcrumbs` are middle segments only → Home / SOC / GENERIC FINANCES.
 */
export function resolveGenericFinancesHeader(pathname = '') {
  if (!String(pathname || '').includes(GENERIC_FINANCES_SEGMENT)) return null;

  return {
    title: 'GENERIC FINANCES',
    currentPage: 'GENERIC FINANCES',
    breadcrumbs: [SOC],
  };
}
