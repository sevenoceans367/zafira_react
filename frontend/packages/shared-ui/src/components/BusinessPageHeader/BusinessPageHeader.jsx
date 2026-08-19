import React, { useEffect } from 'react';
import { appPath } from '@bainbridge/shared-routing';
import styles from './BusinessPageHeader.module.css';

/**
 * White page title bar rendered below AppHeader.
 * Breadcrumbs are shown in AppHeader via `app-page-header-change`.
 */
const BusinessPageHeader = ({
  title,
  currentPage,
  homeHref,
  breadcrumbs = [],
  actions = null,
  icon = null,
}) => {
  const resolvedHomeHref = homeHref ?? appPath('/');
  const trail = Array.isArray(breadcrumbs) ? breadcrumbs : [];
  const leafLabel = currentPage ?? title;
  const breadcrumbKey = trail.map((crumb) => `${crumb.label}:${crumb.href ?? ''}`).join('|');

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('app-page-header-change', {
        detail: {
          homeHref: resolvedHomeHref,
          breadcrumbs: trail,
          currentPage: leafLabel,
        },
      }),
    );
  }, [resolvedHomeHref, breadcrumbKey, leafLabel]);

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        {icon ? <span className={styles.titleIcon}>{icon}</span> : null}
        {title}
      </h1>
      <div className={styles.actions} data-page-header-actions>
        {actions}
      </div>
    </header>
  );
};

export default BusinessPageHeader;
