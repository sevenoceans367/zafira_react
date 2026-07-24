import { appPath } from '@bainbridge/shared-routing';

export const TODO_LIST_SEGMENT = 'todo-list';

export function todoListAppPath(module = 'vc') {
  return appPath(`/internal-user/${module}/${TODO_LIST_SEGMENT}`);
}

export function resolveTodoListHeader(pathname) {
  if (!pathname.includes('/todo-list')) return null;

  const moduleMatch = pathname.match(/\/internal-user\/(sopf|vc|tc)\//);
  const module = moduleMatch?.[1] ?? 'vc';
  const moduleLabel = module === 'sopf' ? 'SOPF' : 'SOC';
  const moduleHref = appPath(
    module === 'sopf' ? '/internal-user/sopf/estimate_list' : '/internal-user/vc',
  );

  return {
    title: 'To - Do List',
    currentPage: 'To - Do List',
    // Middle crumbs only — AppHeader adds Home + currentPage
    breadcrumbs: [
      { label: moduleLabel, href: moduleHref },
    ],
  };
}
