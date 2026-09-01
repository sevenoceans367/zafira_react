import { appPath } from '@bainbridge/shared-routing';
import {
  USER_GUIDES_MODULE_IDS,
  USER_GUIDES_MODULE_LABELS,
  parseUserGuidesModuleFromPath,
  userGuidesAppPath,
} from './userGuidesModule.js';
import { getUserGuideById } from './userGuides.js';
import { SOPF_ENTRY_ROUTE } from './sopfSidebarMenu.js';

const HOME = { label: 'Home', href: appPath('/') };

function moduleBreadcrumb(module) {
  if (module === 'sopf') {
    return { label: USER_GUIDES_MODULE_LABELS.sopf, href: appPath(SOPF_ENTRY_ROUTE) };
  }
  if (module === 'tc') {
    return { label: USER_GUIDES_MODULE_LABELS.tc, href: appPath('/internal-user/tc') };
  }
  return { label: USER_GUIDES_MODULE_LABELS.vc, href: appPath('/internal-user/vc') };
}

export function resolveUserGuidesHeader(pathname) {
  const module = parseUserGuidesModuleFromPath(pathname);
  if (!USER_GUIDES_MODULE_IDS.includes(module)) return null;
  if (!pathname.includes('/user-guides')) return null;

  const listHref = userGuidesAppPath(module);
  const viewMatch = pathname.match(/\/user-guides\/([^/]+)/);
  const guideId = viewMatch?.[1];
  const guide = guideId ? getUserGuideById(guideId) : null;

  if (guide) {
    return {
      title: 'Guides',
      currentPage: guide.title,
      breadcrumbs: [
        HOME,
        moduleBreadcrumb(module),
        { label: 'Guides', href: listHref },
        { label: guide.title },
      ],
    };
  }

  return {
    title: 'Guides',
    currentPage: 'Guides',
    breadcrumbs: [
      HOME,
      moduleBreadcrumb(module),
      { label: 'Guides' },
    ],
  };
}
