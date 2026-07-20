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
  if (pathname.includes(`/${COMBINED_SOA_PAYABLE_TC_SEGMENT}`)) {
    return {
      title: 'Combined SOA Payable TC',
      currentPage: 'Combined SOA Payable TC',
      breadcrumbs: [
        { label: 'Home', href: appPath('/') },
        { label: 'Combined SOA Payable TC' },
      ],
    };
  }

  if (
    pathname === `/internal-user/vc/${COMBINED_SOA_PAYABLE_SEGMENT}`
    || pathname.endsWith(`/${COMBINED_SOA_PAYABLE_SEGMENT}`)
  ) {
    return {
      title: 'Combined SOA Payable',
      currentPage: 'Combined SOA Payable',
      breadcrumbs: [
        { label: 'Home', href: appPath('/') },
        { label: 'Combined SOA Payable' },
      ],
    };
  }

  return null;
}
