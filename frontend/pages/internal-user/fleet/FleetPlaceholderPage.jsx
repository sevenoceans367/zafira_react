import React from 'react';
import { Button } from '@bainbridge/shared-ui';
import { useFleetModule } from '../../../hooks/useFleetModule.js';
import styles from '../ModulePlaceholderPage.module.css';

export default function FleetPlaceholderPage({ title, description }) {
  const { fleetPath } = useFleetModule();

  return (
    <div className={`zafira-page ${styles.page}`}>
      <div className={styles.card}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.text}>{description}</p>
        <Button variant="outline" label="Back to Fleet" to={fleetPath} />
      </div>
    </div>
  );
}
