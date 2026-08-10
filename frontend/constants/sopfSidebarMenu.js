/**
 * SOPF module sidebar — keep in sync with App.jsx routes and sopfPageHeaders.jsx.
 */
import { fleetAppPath } from './fleetModule.js';
import { periodContractAppPath } from './periodContractModule.js';
import { elibraryAppPath } from './elibraryModule.js';
import { userGuidesAppPath } from './userGuidesModule.js';
import spotIcon from '../assets/icons/spot-icon.svg';
import fleetIcon from '../assets/vessel.png';
import vesselPositionIcon from '../assets/vesselPosition.svg';
import elibraryIcon from '../assets/elibrary.svg';

export const SOPF_SIDEBAR_ITEMS = [
  {
    id: 'estimate_list',
    href: '/internal-user/sopf/estimate_list',
    label: 'SPOT',
    iconSrc: spotIcon,
    iconAlt: 'SPOT',
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
    iconSrc: fleetIcon,
    iconAlt: 'Fleet',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/fleet'),
  },
  {
    id: 'period_contracts',
    href: periodContractAppPath('sopf'),
    label: 'Period Contract',
    icon: 'bi-journal-text',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/period-contracts'),
  },
  {
    id: 'elibrary',
    href: elibraryAppPath('sopf'),
    label: 'E-Library',
    iconSrc: elibraryIcon,
    iconAlt: 'E-Library',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/elibrary'),
  },
  {
    id: 'user_guides',
    href: userGuidesAppPath('sopf'),
    label: 'User Guides',
    icon: 'bi-camera-video',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/user-guides'),
  },
  {
    id: 'vessel_position',
    href: '/internal-user/sopf/vessel_position',
    label: 'Vessel Positions',
    iconSrc: vesselPositionIcon,
    iconAlt: 'Vessel Positions',
    isActive: (pathname) => pathname.includes('/internal-user/sopf/vessel_position'),
  },
];

export const SOPF_ENTRY_ROUTE = '/internal-user/sopf/estimate_list?selBType=2&estimatetype=2';
