import { appPath } from '@bainbridge/shared-routing';

export const TODO_LIST_SEGMENT = 'todo-list';

export function todoListAppPath(module = 'vc') {
  return appPath(`/internal-user/${module}/${TODO_LIST_SEGMENT}`);
}

export function resolveTodoListHeader(pathname) {
  if (!pathname.includes('/todo-list')) return null;

  return {
    title: 'Financial Transactions',
    currentPage: 'Financial Transactions',
    // Middle crumbs only — AppHeader appends currentPage → SOC / Financial Transactions
    breadcrumbs: [
      { label: 'SOC', href: appPath('/internal-user/vc') },
    ],
  };
}
