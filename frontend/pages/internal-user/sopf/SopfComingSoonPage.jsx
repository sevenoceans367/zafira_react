import React from 'react';
import { Button } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import styles from './SopfComingSoonPage.module.css';

export default function SopfComingSoonPage({ title, description }) {
  return (
    <div className={`zafira-page ${styles.page}`}>
      <div className={styles.card}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.text}>{description}</p>
        <p className={styles.note}>
          PHP reference not wired yet — share the legacy page when ready and this screen will be ported.
        </p>
        <Button
          variant="outline"
          label="Back to Spot Business"
          href={appPath('/internal-user/sopf/estimate_list?selBType=2&estimatetype=2')}
        />
      </div>
    </div>
  );
}
