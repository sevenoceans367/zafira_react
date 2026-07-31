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
  const path = String(pathname || '');
  if (!path.includes(GENERIC_FINANCES_SEGMENT)) return null;

  if (path.includes(`/${GENERIC_FINANCES_SEGMENT}/add`)) {
    return {
      title: 'ADD GENERIC INVOICE',
      currentPage: 'ADD INVOICE',
      breadcrumbs: [
        SOC,
        { label: 'GENERIC FINANCES', href: genericFinancesAppPath() },
      ],
    };
  }

  return {
    title: 'GENERIC FINANCES',
    currentPage: 'GENERIC FINANCES',
    breadcrumbs: [SOC],
  };
}
