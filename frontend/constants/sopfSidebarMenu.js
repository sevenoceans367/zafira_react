/**
 * SOPF module sidebar — keep in sync with App.jsx routes and sopfPageHeaders.jsx.
 */
import { fleetAppPath } from './fleetModule.js';
import { periodContractAppPath } from './periodContractModule.js';
import { userGuidesAppPath } from './userGuidesModule.js';
import spotIcon from '../assets/icons/spot-icon.svg';
import fleetIcon from '../assets/vessel.png';
import vesselPositionIcon from '../assets/vesselPosition.svg';
import coaIcon from '../assets/COA.svg';

/** Links under the SOPF section (above Chartering Desk). */
export const SOPF_TOP_SIDEBAR_ITEMS = [
  {
    id: 'vessel_position',
    href: '/internal-user/sopf/vessel_position',
    label: 'Vessels on Water',
    iconSrc: vesselPositionIcon,
    iconAlt: 'Vessels on Water',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/vessel_position'),
  },
  {
    id: 'operated_vessels',
    href: fleetAppPath('sopf'),
    label: 'Operated Vessels',
    iconSrc: fleetIcon,
    iconAlt: 'Operated Vessels',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/fleet'),
  },
];

/** Links under CHARTERING DESK. */
export const SOPF_CHARTERING_SIDEBAR_ITEMS = [
  {
    id: 'spot',
    href: '/internal-user/sopf/estimate_list',
    label: 'Spot',
    iconSrc: spotIcon,
    iconAlt: 'Spot',
    isActive: (pathname) =>
      pathname.includes('/internal-user/sopf/estimate_list')
      || pathname.includes('/internal-user/sopf/updateestimate')
      || pathname.includes('/internal-user/sopf/viewestimate')
      || pathname.includes('/internal-user/sopf/addestimate'),
  },
  {
    id: 'time_charter',
    href: '/internal-user/sopf/time-charter',
    label: 'Time Charter',
    icon: 'bi-clock-history',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/time-charter'),
  },
  {
    id: 'period',
    href: periodContractAppPath('sopf'),
    label: 'Period',
    icon: 'bi-journal-text',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/period-contracts'),
  },
  {
    id: 'coas',
    href: '/internal-user/sopf/coas',
    label: 'COAs',
    iconSrc: coaIcon,
    iconAlt: 'COAs',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/coas'),
  },
  {
    id: 'pools',
    href: '/internal-user/sopf/pools',
    label: 'Pools',
    icon: 'bi-people',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/pools'),
  },
  {
    id: 'user_guides',
    href: userGuidesAppPath('sopf'),
    label: 'User Guides',
    icon: 'bi-camera-video',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/user-guides'),
  },
];

/** @deprecated Prefer SOPF_TOP_SIDEBAR_ITEMS + SOPF_CHARTERING_SIDEBAR_ITEMS */
export const SOPF_SIDEBAR_ITEMS = [
  ...SOPF_TOP_SIDEBAR_ITEMS,
  ...SOPF_CHARTERING_SIDEBAR_ITEMS,
];

export const SOPF_ENTRY_ROUTE = '/internal-user/sopf/estimate_list?selBType=2&estimatetype=2';
