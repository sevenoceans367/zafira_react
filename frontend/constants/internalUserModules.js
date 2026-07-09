/**
 * Internal-user home module launcher cards.
 * Mirrors php/index.php module tiles with Zafira global styling.
 */
export const INTERNAL_USER_MODULES = [
  {
    id: 'sopf',
    title: "Seven Oceans' Pre-Fixture",
    subtitle: 'SOPF',
    description: 'Spot business estimates, fleet, and help desk.',
    href: '/internal-user/sopf/estimate_list?selBType=2&estimatetype=2',
    icon: 'bi-folder2-open',
    visibleFor: ({ user }) => user?.sopfUser !== false,
  },
  {
    id: 'vc',
    title: "Seven Oceans' Commercials",
    subtitle: 'VC Out',
    description: 'VC/TC dashboard, COAs, periods, and commercial planning.',
    href: '/internal-user/vc',
    icon: 'bi-compass',
    visibleFor: ({ user }) =>
      ['internal_user', 'mgmt_user'].includes(user?.userType),
  },
  {
    id: 'tc',
    title: "Seven Oceans' Commercials",
    subtitle: 'TC Out',
    description: 'Time charter estimates, fixtures, and hire management.',
    href: '/internal-user/tc',
    icon: 'bi-clock-history',
    visibleFor: ({ user }) =>
      ['internal_user', 'mgmt_user'].includes(user?.userType),
  },
];

export const SOPF_DEFAULT_ROUTE = '/internal-user/sopf/estimate_list?selBType=2&estimatetype=2';

export function getVisibleModules(user) {
  return INTERNAL_USER_MODULES.filter((module) =>
    module.visibleFor ? module.visibleFor({ user }) : true,
  );
}
