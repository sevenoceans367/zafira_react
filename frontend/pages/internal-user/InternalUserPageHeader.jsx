import React from 'react';
import { useLocation } from 'react-router-dom';
import { BusinessPageHeader } from '@bainbridge/shared-ui';
import { resolveInternalUserHeader } from '../../constants/internalUserPageHeaders.jsx';
import { usePageHeaderState } from './PageHeaderContext.jsx';

export default function InternalUserPageHeader() {
  const { pathname, search } = useLocation();
  const { actions } = usePageHeaderState();
  const config = resolveInternalUserHeader(pathname, search);

  return (
    <BusinessPageHeader
      title={config.title}
      breadcrumbs={config.breadcrumbs}
      currentPage={config.currentPage}
      actions={actions}
    />
  );
}
