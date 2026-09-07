import React from 'react';
import { useLocation } from 'react-router-dom';
import { BusinessPageHeader } from '@bainbridge/shared-ui';
import { resolveInternalUserHeader } from '../../constants/internalUserPageHeaders.jsx';
import { usePageHeaderState } from './PageHeaderContext.jsx';

export default function InternalUserPageHeader() {
  const { pathname, search } = useLocation();
  const { actions, heading } = usePageHeaderState();
  const config = resolveInternalUserHeader(pathname, search);

  // Platform home owns its own hero; skip the duplicate "Dashboard" title bar.
  if (pathname === '/') return null;

  return (
    <BusinessPageHeader
      title={heading?.title ?? config.title}
      icon={heading?.icon ?? null}
      titleExtra={heading?.titleExtra ?? null}
      breadcrumbs={config.breadcrumbs}
      currentPage={config.currentPage}
      actions={actions}
    />
  );
}
