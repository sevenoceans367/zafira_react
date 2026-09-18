import { appPath } from '@bainbridge/shared-routing';

export function resolveAgentHeader(pathname, search = '') {
  if (!pathname.startsWith('/agent')) return null;

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const filter = params.get('filter') || '';
  const mode = String(params.get('mode') || '').toLowerCase();

  if (pathname.startsWith('/agent/port-cost')) {
    const title = mode === 'fda' ? 'FDA' : 'Initial PDA';
    return {
      title,
      currentPage: title,
      breadcrumbs: [
        { label: 'Agent', href: appPath('/agent/') },
        { label: 'Port Costs' },
      ],
    };
  }

  if (pathname.startsWith('/agent/sof')) {
    return {
      title: 'Statement of Facts',
      currentPage: 'SOF',
      breadcrumbs: [
        { label: 'Agent', href: appPath('/agent/') },
      ],
    };
  }

  let title = 'Dashboard';
  if (filter === 'open-initial') title = 'Open Initial PDA';
  if (filter === 'working-fda') title = 'Working FDA';

  return {
    title,
    currentPage: title,
    breadcrumbs: [{ label: 'Agent Portal' }],
  };
}
