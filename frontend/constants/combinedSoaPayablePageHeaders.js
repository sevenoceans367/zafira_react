import { appPath } from '@bainbridge/shared-routing';

export const COMBINED_SOA_PAYABLE_SEGMENT = 'combined-soa-payable';
export const COMBINED_SOA_PAYABLE_TC_SEGMENT = 'combined-soa-payable-tc';

export function combinedSoaPayableAppPath() {
  return appPath(`/internal-user/vc/${COMBINED_SOA_PAYABLE_SEGMENT}`);
}

export function combinedSoaPayableTcAppPath() {
  return appPath(`/internal-user/vc/${COMBINED_SOA_PAYABLE_TC_SEGMENT}`);
}

export function resolveCombinedSoaPayableHeader(pathname) {
  const soc = { label: 'SOC', href: appPath('/internal-user/vc') };

  if (pathname.includes(`/${COMBINED_SOA_PAYABLE_TC_SEGMENT}`)) {
    return {
      title: 'Combined SOA Payable TC',
      currentPage: 'Combined SOA Payable TC',
      // Middle crumbs only — AppHeader adds Home + currentPage
      breadcrumbs: [soc],
    };
  }

  if (
    pathname === `/internal-user/vc/${COMBINED_SOA_PAYABLE_SEGMENT}`
    || pathname.endsWith(`/${COMBINED_SOA_PAYABLE_SEGMENT}`)
    || pathname.includes(`/${COMBINED_SOA_PAYABLE_SEGMENT}`)
  ) {
    return {
      title: 'Combined SOA Payable',
      currentPage: 'Combined SOA Payable',
      breadcrumbs: [soc],
    };
  }

  return null;
}
