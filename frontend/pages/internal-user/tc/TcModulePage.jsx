import React from 'react';
import { Button } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import styles from '../ModulePlaceholderPage.module.css';

export default function TcModulePage() {
  return (
    <div className={`zafira-page ${styles.page}`}>
      <div className={styles.card}>
        <h2 className={styles.title}>TC — Time Charter</h2>
        <p className={styles.text}>
          Time charter estimates and hire workflows will be ported here.
        </p>
        <Button variant="outline" label="Back to Home" href={appPath('/')} />
      </div>
    </div>
  );
}
