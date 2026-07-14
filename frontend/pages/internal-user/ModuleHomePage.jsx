import React from 'react';
import { Button } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { getUser } from '@bainbridge/shared-auth';
import { getVisibleModules } from '../../constants/internalUserModules.js';
import styles from './ModuleHomePage.module.css';

export default function ModuleHomePage() {
  const user = getUser();
  const modules = getVisibleModules(user);

  return (
    <div className={`zafira-page ${styles.page}`}>
      <p className={styles.intro}>Select a module to continue.</p>
      <div className={styles.grid}>
        {modules.map((module) => (
          <article key={module.id} className={styles.card}>
            {module.iconSrc ? (
              <img
                src={module.iconSrc}
                alt={module.iconAlt || module.subtitle || ''}
                className={styles.iconImg}
              />
            ) : (
              <i className={`bi ${module.icon} ${styles.icon}`} aria-hidden />
            )}
            <p className={styles.label}>{module.title}</p>
            <h2 className={styles.subtitle}>{module.subtitle}</h2>
            <p className={styles.description}>{module.description}</p>
            <div className={styles.footer}>
              <Button
                variant="primary"
                label="Get in"
                icon="arrow-right-circle"
                to={appPath(module.href)}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
