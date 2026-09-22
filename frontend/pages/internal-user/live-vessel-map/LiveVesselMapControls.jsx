import React, { useMemo } from 'react';
import { MAP_STYLES } from './liveVesselMap.constants.js';
import styles from './LiveVesselMapPage.module.css';

export default function LiveVesselMapControls({
  mapStyle,
  onMapStyleChange,
}) {
  const styleEntries = useMemo(() => Object.values(MAP_STYLES), []);

  return (
    <div className={styles.controls}>
      <div className={styles.controlsRow}>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Basemap</span>
          <div className={styles.segmented} role="group" aria-label="Basemap style">
            {styleEntries.map((style) => (
              <button
                key={style.id}
                type="button"
                className={`${styles.segmentBtn}${mapStyle === style.id ? ` ${styles.segmentBtnActive}` : ''}`}
                onClick={() => onMapStyleChange(style.id)}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
