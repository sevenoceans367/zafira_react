/**
 * SOPF module sidebar — keep in sync with App.jsx routes and sopfPageHeaders.jsx.
 */
import { fleetAppPath } from './fleetModule.js';
import { periodContractAppPath } from './periodContractModule.js';
import { userGuidesAppPath } from './userGuidesModule.js';
import spotIcon from '../assets/010-pie-chart.png';
import fleetIcon from '../assets/vessel.png';
import vesselsOnWaterIcon from '../assets/VesselsonWater.png';
import timeCharterIcon from '../assets/TIME CHARTER.png';
import periodContractIcon from '../assets/Period contact.svg';
import poolsIcon from '../assets/pools.svg';
import userGuidesIcon from '../assets/user-guides.svg';

/** Links under the SOPF section (above Chartering). */
export const SOPF_TOP_SIDEBAR_ITEMS = [
  {
    id: 'vessel_position',
    href: '/internal-user/sopf/vessel_position',
    label: 'Vessels on Water',
    iconSrc: vesselsOnWaterIcon,
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

/** Links under Chartering. */
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
    iconSrc: timeCharterIcon,
    iconAlt: 'Time Charter',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/time-charter'),
  },
  {
    id: 'period',
    href: periodContractAppPath('sopf'),
    label: 'Period',
    iconSrc: periodContractIcon,
    iconAlt: 'Period',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/period-contracts'),
  },
  // COAs: shared global tree (same as SOC) — rendered via CoasSidebarTree in InternalUserSidebar
  {
    id: 'pools',
    href: '/internal-user/sopf/pools',
    label: 'Pools',
    iconSrc: poolsIcon,
    iconAlt: 'Pools',
    disabled: true,
    isActive: (pathname) => pathname.includes('/internal-user/sopf/pools'),
  },
  {
    id: 'user_guides',
    href: userGuidesAppPath('sopf'),
    label: 'Guides',
    iconSrc: userGuidesIcon,
    iconAlt: 'Guides',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/user-guides'),
  },
];

/** @deprecated Prefer SOPF_TOP_SIDEBAR_ITEMS + SOPF_CHARTERING_SIDEBAR_ITEMS */
export const SOPF_SIDEBAR_ITEMS = [
  ...SOPF_TOP_SIDEBAR_ITEMS,
  ...SOPF_CHARTERING_SIDEBAR_ITEMS,
];

export const SOPF_ENTRY_ROUTE = '/internal-user/sopf/estimate_list?selBType=2&estimatetype=2';
