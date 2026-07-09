/**
 * SOPF module sidebar — keep in sync with App.jsx routes and sopfPageHeaders.jsx.
 */
import { fleetAppPath } from './fleetModule.js';

export const SOPF_SIDEBAR_ITEMS = [
  {
    id: 'estimate_list',
    href: '/internal-user/sopf/estimate_list',
    label: 'SPOT',
    icon: 'bi-leaf',
    isActive: (pathname) =>
      pathname.includes('/internal-user/sopf/estimate_list')
      || pathname.includes('/internal-user/sopf/updateestimate')
      || pathname.includes('/internal-user/sopf/viewestimate')
      || pathname.includes('/internal-user/sopf/addestimate'),
  },
  {
    id: 'fleet',
    href: fleetAppPath('sopf'),
    label: 'Fleet',
    icon: 'bi-anchor',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/fleet'),
  },
  {
    id: 'vessel_position',
    href: '/internal-user/sopf/vessel_position',
    label: 'Vessel Positions',
    icon: 'bi-geo-alt',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/vessel_position'),
  },
  {
    id: 'support_ticket',
    href: '/internal-user/sopf/support_ticket',
    label: 'Help Desk',
    icon: 'bi-life-preserver',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/support_ticket'),
  },
];

export const SOPF_ENTRY_ROUTE = '/internal-user/sopf/estimate_list?selBType=2&estimatetype=2';
