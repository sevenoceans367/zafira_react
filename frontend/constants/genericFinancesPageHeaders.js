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
      title: 'Add Generic Invoice',
      currentPage: 'ADD INVOICE',
      breadcrumbs: [
        SOC,
        { label: 'Generic Finances', href: genericFinancesAppPath() },
      ],
    };
  }

  if (/\/generic-finances\/[^/]+\/edit/.test(path)) {
    return {
      title: 'Update Generic Invoice',
      currentPage: 'EDIT INVOICE',
      breadcrumbs: [
        SOC,
        { label: 'Generic Finances', href: genericFinancesAppPath() },
      ],
    };
  }

  return {
    title: 'Generic Finances',
    currentPage: 'Generic Finances',
    breadcrumbs: [SOC],
  };
}
