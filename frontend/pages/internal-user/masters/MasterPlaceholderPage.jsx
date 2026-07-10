import React from 'react';
import { useParams } from 'react-router-dom';
import { getMasterModule } from '../../../constants/mastersModules.js';
import styles from './MasterPlaceholderPage.module.css';

export default function MasterPlaceholderPage() {
  const { masterId } = useParams();
  const master = getMasterModule(masterId);

  return (
    <div className={`zafira-page ${styles.page}`}>
      <h2 className={styles.title}>{master?.label || 'Master'}</h2>
      <p className={styles.lead}>
        This master screen will be implemented here.
      </p>
      {master?.legacyPhp ? (
        <p className={styles.meta}>
          Legacy reference: <code>{master.legacyPhp}</code>
        </p>
      ) : null}
    </div>
  );
}
