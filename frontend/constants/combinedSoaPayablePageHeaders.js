import { appPath } from '@bainbridge/shared-routing';

export const GROUP_PAYMENTS_SEGMENT = 'group-payments';
/** @deprecated Prefer GROUP_PAYMENTS_SEGMENT — kept for redirects */
export const COMBINED_SOA_PAYABLE_SEGMENT = 'combined-soa-payable';
/** @deprecated Prefer GROUP_PAYMENTS_SEGMENT — kept for redirects */
export const COMBINED_SOA_PAYABLE_TC_SEGMENT = 'combined-soa-payable-tc';

export function groupPaymentsAppPath() {
  return appPath(`/internal-user/vc/${GROUP_PAYMENTS_SEGMENT}`);
}

export function groupPaymentsAddAppPath(query = {}) {
  const base = appPath(`/internal-user/vc/${GROUP_PAYMENTS_SEGMENT}/add`);
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '' || value === 'all') return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export function groupPaymentsAddTcAppPath(query = {}) {
  return groupPaymentsAddAppPath({ ...query, contractType: 'tc' });
}

/** @deprecated Use groupPaymentsAppPath */
export function combinedSoaPayableAppPath() {
  return groupPaymentsAppPath();
}

/** @deprecated Use groupPaymentsAppPath */
export function combinedSoaPayableTcAppPath() {
  return groupPaymentsAppPath();
}

export function resolveCombinedSoaPayableHeader(pathname) {
  const path = String(pathname || '');
  const isGroupPayments = path.includes(`/${GROUP_PAYMENTS_SEGMENT}`)
    || path.includes(`/${COMBINED_SOA_PAYABLE_SEGMENT}`)
    || path.includes(`/${COMBINED_SOA_PAYABLE_TC_SEGMENT}`);

  if (!isGroupPayments) return null;

  const isAdd = path.includes(`/${GROUP_PAYMENTS_SEGMENT}/add`)
    || path.includes(`/${GROUP_PAYMENTS_SEGMENT}/add-tc`);
  const isAddTc = path.includes('add-tc')
    || (isAdd && path.includes('contractType=tc'));

  return {
    title: isAddTc ? 'Add Payment (TC)' : (isAdd ? 'Add Payment' : 'Group Payments'),
    currentPage: isAddTc ? 'Add Payment (TC)' : (isAdd ? 'Add Payment' : 'Group Payments'),
    // Middle crumbs only — AppHeader appends currentPage
    breadcrumbs: isAdd
      ? [
          { label: 'SOC', href: appPath('/internal-user/vc') },
          { label: 'Group Payments', href: groupPaymentsAppPath() },
        ]
      : [
          { label: 'SOC', href: appPath('/internal-user/vc') },
        ],
  };
}
