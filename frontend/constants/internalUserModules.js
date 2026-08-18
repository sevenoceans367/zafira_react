import sopfIcon from '../assets/SOPF Icon 1.png';
import socIcon from '../assets/SOC Product Icon.png';
import vesselPositionIcon from '../assets/vesselPosition.svg';
import {
  LIVE_VESSEL_MAP_ENABLED,
  LIVE_VESSEL_MAP_PATH,
  LIVE_VESSEL_MAP_TITLE,
} from '../pages/internal-user/live-vessel-map/liveVesselMap.feature.js';

/**
 * Internal-user home module launcher cards / module switcher rail.
 * SOPF + SOC (Seven Ocean Commercial) — VC/TC are one commercial module.
 */
export const INTERNAL_USER_MODULES = [
  {
    id: 'sopf',
    title: "Seven Oceans' Pre-Fixture",
    subtitle: 'SOPF',
    description: 'Spot business estimates, fleet, and help desk.',
    href: '/internal-user/sopf/estimate_list?selBType=2&estimatetype=2',
    iconSrc: sopfIcon,
    iconAlt: 'SOPF',
    visibleFor: ({ user }) => user?.sopfUser !== false,
  },
  {
    id: 'soc',
    title: 'Seven Ocean Commercial',
    subtitle: 'SOC',
    description: 'VC/TC dashboard, COAs, periods, fleet, and commercial planning.',
    href: '/internal-user/vc',
    iconSrc: socIcon,
    iconAlt: 'SOC',
    visibleFor: ({ user }) =>
      ['internal_user', 'mgmt_user'].includes(user?.userType),
  },
  {
    id: 'live-vessels',
    title: LIVE_VESSEL_MAP_TITLE,
    subtitle: 'MAP',
    description: 'Standalone live AIS map. Separate from SOPF and SOC screens.',
    href: LIVE_VESSEL_MAP_PATH,
    iconSrc: vesselPositionIcon,
    iconAlt: LIVE_VESSEL_MAP_TITLE,
    visibleFor: () => LIVE_VESSEL_MAP_ENABLED,
  },
];

export const SOPF_DEFAULT_ROUTE = '/internal-user/sopf/estimate_list?selBType=2&estimatetype=2';
export const SOC_DEFAULT_ROUTE = '/internal-user/vc';

export function getVisibleModules(user) {
  return INTERNAL_USER_MODULES.filter((module) =>
    module.visibleFor ? module.visibleFor({ user }) : true,
  );
}

export function getActiveModuleId(pathname) {
  if (pathname.startsWith(LIVE_VESSEL_MAP_PATH)) return 'live-vessels';
  if (pathname.startsWith('/internal-user/sopf')) return 'sopf';
  // VC and TC live under one SOC commercial module
  if (pathname.startsWith('/internal-user/vc') || pathname.startsWith('/internal-user/tc')) {
    return 'soc';
  }
  return null;
}
