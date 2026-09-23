import React, { useMemo } from 'react';
import { MAP_STYLES } from './liveVesselMap.constants.js';
import styles from './LiveVesselMapPage.module.css';

export default function LiveVesselMapControls({
  mapStyle,
  onMapStyleChange,
}) {
  const styleEntries = useMemo(() => Object.values(MAP_STYLES), []);

  return (
    <div className={styles.mapStyleBar}>
      <span className={styles.mapStyleLabel}>Map Style</span>
      <div className={styles.segToggle} role="group" aria-label="Map style">
        {styleEntries.map((style) => (
          <button
            key={style.id}
            type="button"
            className={`${styles.segBtn}${mapStyle === style.id ? ` ${styles.segBtnActive}` : ''}`}
            onClick={() => onMapStyleChange(style.id)}
          >
            {style.label}
          </button>
        ))}
      </div>
    </div>
  );
}
