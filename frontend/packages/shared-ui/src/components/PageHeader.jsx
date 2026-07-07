import React, { useState, useEffect } from 'react';
import { appPath } from '@bainbridge/shared-routing';
import styles from './PageHeader.module.css';

const formatDateTime = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return `${day} ${month} ${year} ${time}`;
};

/**
 * Orange page title bar with live clock and breadcrumb trail.
 *
 * @param {string} title - Primary heading (H1)
 * @param {string} [currentPage] - Last breadcrumb segment when different from title (e.g. master name while H1 is "Masters")
 * @param {string} [icon] - Bootstrap Icons name without the `bi-` prefix
 * @param {React.ReactNode} [iconElement] - Custom icon element (overrides `icon`)
 * @param {string} [homeHref] - Home breadcrumb link (defaults to appPath('/'))
 * @param {{ label: string, href?: string }[]} [breadcrumbs] - Segments between Home and the current page
 * @param {boolean} [showTime=true] - Show live clock next to the title
 */
const PageHeader = ({
  title,
  currentPage,
  icon,
  iconElement,
  homeHref,
  breadcrumbs = [],
  showTime = true,
}) => {
  const [currentTime, setCurrentTime] = useState(formatDateTime(new Date()));
  const resolvedHomeHref = homeHref ?? appPath('/');
  const leafLabel = currentPage ?? title;
  const trail = Array.isArray(breadcrumbs) ? breadcrumbs : [];
  const breadcrumbKey = trail.map((crumb) => `${crumb.label}:${crumb.href ?? ''}`).join('|');

  useEffect(() => {
    if (!showTime) return undefined;
    const timer = setInterval(() => setCurrentTime(formatDateTime(new Date())), 1000);
    return () => clearInterval(timer);
  }, [showTime]);

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
    <section className={styles.headerSection}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>
          {iconElement ? (
            <span className={styles.titleIcon}>{iconElement}</span>
          ) : (
            icon ? <i className={`bi bi-${icon} ${styles.titleIcon}`}></i> : null
          )}
          {title}
          {showTime && (
            <small className={styles.time}>{`(${currentTime})`}</small>
          )}
        </h1>
      </div>
    </section>
  );
};

export default PageHeader;
