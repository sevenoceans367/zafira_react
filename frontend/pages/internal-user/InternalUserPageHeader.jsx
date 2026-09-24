import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BusinessPageHeader } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { resolveInternalUserHeader } from '../../constants/internalUserPageHeaders.jsx';
import { usePageHeaderState } from './PageHeaderContext.jsx';

/** Sync AppHeader breadcrumbs without rendering the page title bar. */
function HomeBreadcrumbSync({ breadcrumbs, currentPage }) {
  const breadcrumbKey = (breadcrumbs || [])
    .map((crumb) => `${crumb.label}:${crumb.href ?? ''}`)
    .join('|');

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('app-page-header-change', {
        detail: {
          homeHref: appPath('/'),
          breadcrumbs: breadcrumbs || [],
          currentPage,
        },
      }),
    );
  }, [breadcrumbKey, currentPage, breadcrumbs]);

  return null;
}

export default function InternalUserPageHeader() {
  const { pathname, search } = useLocation();
  const { actions, heading } = usePageHeaderState();
  const config = resolveInternalUserHeader(pathname, search);

  // Platform home owns its own hero; skip the title bar but keep header crumbs.
  if (pathname === '/') {
    return (
      <HomeBreadcrumbSync
        breadcrumbs={config.breadcrumbs}
        currentPage={config.currentPage}
      />
    );
  }

  return (
    <BusinessPageHeader
      title={heading?.title ?? config.title}
      icon={heading?.icon ?? null}
      titleExtra={heading?.titleExtra ?? null}
      stacked={Boolean(heading?.stacked)}
      breadcrumbs={config.breadcrumbs}
      currentPage={config.currentPage}
      actions={actions}
    />
  );
}
