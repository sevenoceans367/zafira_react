import React, { useMemo } from 'react';
import { CardSelect } from '@bainbridge/shared-ui';
import {
  MAP_STYLES,
  NAVIGATION_STATUSES,
} from './liveVesselMap.constants.js';
import styles from './LiveVesselMapPage.module.css';

export default function LiveVesselMapControls({
  mapStyle,
  onMapStyleChange,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  searching,
  filters,
  onFiltersChange,
  flagOptions = [],
  showRoutes,
  onShowRoutesChange,
  showAis,
  onShowAisChange,
  showFleet,
  onShowFleetChange,
  aisCount = 0,
  fleetCount = 0,
  visibleCount = 0,
}) {
  const styleEntries = useMemo(() => Object.values(MAP_STYLES), []);

  const flagSelectOptions = useMemo(
    () => [
      { id: '', name: 'All flags' },
      ...flagOptions.map((flag) => ({ id: flag, name: flag })),
    ],
    [flagOptions],
  );

  const patchFilters = (patch) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const toggleNavStatus = (status) => {
    const current = filters.navStatuses || [];
    const next = current.includes(status)
      ? current.filter((item) => item !== status)
      : [...current, status];
    patchFilters({ navStatuses: next });
  };

  const clearFilters = () => {
    onFiltersChange({
      navStatuses: [],
      flag: '',
      draughtMin: '',
      draughtMax: '',
      speedMin: '',
      speedMax: '',
    });
  };

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

        <form
          className={styles.searchForm}
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <label className={styles.controlLabel} htmlFor="live-vessel-search">Search vessel</label>
          <div className={styles.searchRow}>
            <input
              id="live-vessel-search"
              type="search"
              className={styles.searchInput}
              placeholder="IMO, MMSI, or name"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
            <button type="submit" className={styles.searchBtn} disabled={searching || !searchQuery.trim()}>
              {searching ? 'Searching…' : 'Find'}
            </button>
          </div>
        </form>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Layers</span>
          <div className={styles.layerToggles}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={showAis} onChange={(e) => onShowAisChange(e.target.checked)} />
              Open market
              <span className={styles.countChip}>{aisCount}</span>
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={showFleet} onChange={(e) => onShowFleetChange(e.target.checked)} />
              Our fleet
              <span className={`${styles.countChip} ${styles.countChipFleet}`}>{fleetCount}</span>
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={showRoutes} onChange={(e) => onShowRoutesChange(e.target.checked)} />
              Routes
            </label>
          </div>
        </div>
      </div>

      <div className={styles.controlsRow}>
        <div className={styles.controlGroupGrow}>
          <span className={styles.controlLabel}>Navigation status</span>
          <div className={styles.navStatusRow}>
            {NAVIGATION_STATUSES.map((status) => {
              const active = (filters.navStatuses || []).includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  className={`${styles.filterChip}${active ? ` ${styles.filterChipActive}` : ''}`}
                  onClick={() => toggleNavStatus(status)}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.filterControls}>
        <div className={styles.filterField}>
          <span className={styles.filterFieldLabel}>Flag</span>
          <CardSelect
            options={flagSelectOptions}
            value={filters.flag || ''}
            onChange={(id) => patchFilters({ flag: id })}
            placeholder="All flags"
            ariaLabel="Flag"
            align="start"
            tone="muted"
          />
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterFieldLabel} htmlFor="live-draught-min">Draught min (m)</label>
          <input
            id="live-draught-min"
            type="number"
            min="0"
            step="0.1"
            className={styles.filterInput}
            value={filters.draughtMin}
            onChange={(e) => patchFilters({ draughtMin: e.target.value })}
            placeholder="—"
          />
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterFieldLabel} htmlFor="live-draught-max">Draught max (m)</label>
          <input
            id="live-draught-max"
            type="number"
            min="0"
            step="0.1"
            className={styles.filterInput}
            value={filters.draughtMax}
            onChange={(e) => patchFilters({ draughtMax: e.target.value })}
            placeholder="—"
          />
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterFieldLabel} htmlFor="live-speed-min">Speed min (kn)</label>
          <input
            id="live-speed-min"
            type="number"
            min="0"
            step="0.1"
            className={styles.filterInput}
            value={filters.speedMin}
            onChange={(e) => patchFilters({ speedMin: e.target.value })}
            placeholder="—"
          />
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterFieldLabel} htmlFor="live-speed-max">Speed max (kn)</label>
          <input
            id="live-speed-max"
            type="number"
            min="0"
            step="0.1"
            className={styles.filterInput}
            value={filters.speedMax}
            onChange={(e) => patchFilters({ speedMax: e.target.value })}
            placeholder="—"
          />
        </div>

        <div className={styles.controlsEnd}>
          <button type="button" className={styles.clearBtn} onClick={clearFilters}>
            Clear filters
          </button>
          <span className={styles.visibleMeta}>{visibleCount} visible</span>
        </div>
      </div>

      <div className={styles.legendRow} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendAis}`} />
          Open-market AIS
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendFleet}`} />
          Our performing fleet
        </span>
      </div>
    </div>
  );
}
