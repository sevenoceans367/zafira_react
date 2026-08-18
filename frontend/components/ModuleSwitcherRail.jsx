import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import { getUser } from '@bainbridge/shared-auth';
import {
  getActiveModuleId,
  getVisibleModules,
} from '../constants/internalUserModules.js';
import ModuleTintIcon from './ModuleTintIcon.jsx';
import tintStyles from './ModuleTintIcon.module.css';
import styles from './ModuleSwitcherRail.module.css';

function ModuleRailButton({
  to,
  icon,
  iconSrc,
  iconAlt,
  label,
  shortLabel,
  active,
  title,
}) {
  return (
    <Link
      to={to}
      className={`${styles.item} ${active ? styles.itemActive : ''}`}
      title={title}
      aria-current={active ? 'page' : undefined}
    >
      <span className={styles.iconWrap}>
        {iconSrc ? (
          <ModuleTintIcon
            src={iconSrc}
            alt={iconAlt}
            className={`${tintStyles.icon} ${styles.iconTint}`}
          />
        ) : (
          <i className={`bi ${icon}`} aria-hidden />
        )}
      </span>
      <span className={styles.label}>{shortLabel || label}</span>
    </Link>
  );
}

export default function ModuleSwitcherRail() {
  const { pathname } = useLocation();
  const user = getUser();
  const modules = getVisibleModules(user);
  const activeModuleId = getActiveModuleId(pathname);
  const homeActive = pathname === '/' || pathname === '';

  return (
    <aside className={styles.rail} aria-label="Module switcher">
      <div className={styles.items}>
        <ModuleRailButton
          to={appPath('/')}
          icon="bi-house-door"
          label="Home"
          shortLabel="Home"
          active={homeActive}
          title="Home"
        />

        <div className={styles.divider} aria-hidden />

        {modules.map((module) => (
          <ModuleRailButton
            key={module.id}
            to={appPath(module.href)}
            icon={module.icon}
            iconSrc={module.iconSrc}
            iconAlt={module.iconAlt}
            label={module.title}
            shortLabel={module.subtitle}
            active={activeModuleId === module.id}
            title={module.title}
          />
        ))}
      </div>
    </aside>
  );
}
