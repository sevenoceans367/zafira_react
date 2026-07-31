import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button, CardSelect, useAlert } from '@bainbridge/shared-ui';
import { fetchPortDistance } from '../../../services/estimateDetail.js';
import {
  NAVIGATION_METHOD_OPTIONS,
  PASSAGE_AREA_OPTIONS,
  PIRACY_ZONE_OPTIONS,
  defaultAllowedPassages,
  groupPassagesByRegion,
} from './distanceFetch.constants.js';
import styles from './DistanceFetchModal.module.css';

function rangeOptions(max, suffix = '') {
  const opts = [];
  for (let i = 0; i <= max; i += 1) {
    opts.push({ id: String(i), name: `${i}${suffix}` });
  }
  return opts;
}

function splitPortDisplay(name, fallbackId) {
  const raw = String(name || '').trim();
  if (!raw) {
    return { primary: fallbackId || '—', secondary: '' };
  }
  const [primary, ...rest] = raw.split(' / ');
  return {
    primary: primary.trim() || raw,
    secondary: rest.join(' / ').trim(),
  };
}

const INTERVAL_OPTIONS = rangeOptions(500, ' n.m.');
const PERCENT_OPTIONS = rangeOptions(100, '%');
const NAV_METHOD_OPTIONS = NAVIGATION_METHOD_OPTIONS.map((o) => ({
  id: o.value,
  name: o.label,
}));
const PIRACY_OPTIONS = PIRACY_ZONE_OPTIONS.map((o) => ({
  id: o.value,
  name: o.label,
}));

export default function DistanceFetchModal({
  open,
  leg,
  onClose,
  onConfirm,
}) {
  const alert = useAlert();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);

  const [navMethod, setNavMethod] = useState('');
  const [greatCircleInterval, setGreatCircleInterval] = useState('0');
  const [secaAvoidance, setSecaAvoidance] = useState('0');
  const [aslCompliance, setAslCompliance] = useState('0');
  const [piracyZone, setPiracyZone] = useState('');
  const [allowedPassages, setAllowedPassages] = useState(defaultAllowedPassages);
  const [passageQuery, setPassageQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open || !leg) return;
    setNavMethod('');
    setGreatCircleInterval('0');
    setSecaAvoidance('0');
    setAslCompliance('0');
    setPiracyZone('');
    setAllowedPassages(defaultAllowedPassages());
    setPassageQuery('');
    setLoading(false);
    setError('');
    setResult(null);
  }, [open, leg?.id]);

  // Auto-fetch on open (matches PHP getShowModel → getdistancemap)
  useEffect(() => {
    if (!open || !leg?.fromPortId || !leg?.toPortId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchPortDistance({
          startPortId: leg.fromPortId,
          endPortId: leg.toPortId,
          greatCircleInterval: 0,
          secaAvoidance: 0,
          aslCompliance: 0,
          allowedAreas: defaultAllowedPassages(),
        });
        if (cancelled) return;
        if (Number(data.resultCode) !== 1) {
          throw new Error(data.resultText || 'Distance lookup failed.');
        }
        if (!data.waypoints?.length) {
          throw new Error(data.resultText || 'No route waypoints returned.');
        }
        setResult(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to fetch distance.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, leg?.id, leg?.fromPortId, leg?.toPortId]);

  useEffect(() => {
    if (!open) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerRef.current = null;
      }
      return undefined;
    }

    const timer = setTimeout(() => {
      if (!mapRef.current || mapInstanceRef.current) return;
      const map = L.map(mapRef.current, { zoomSnap: 0.25 }).setView([20, 0], 2);
      // Show only "Seven Oceans" — hide default "Leaflet |" prefix.
      map.attributionControl.setPrefix(false);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 10,
        attribution: 'Seven Oceans',
      }).addTo(map);
      mapInstanceRef.current = map;
      map.invalidateSize();
    }, 50);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !result?.waypoints?.length) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    let edition = 0;
    let prevLon = null;
    const points = result.waypoints.map((wp) => {
      let lon = wp.lng;
      if (prevLon != null) {
        const diff = prevLon - wp.lng;
        if (diff > 180) edition = 360;
        if (diff < -180) edition = -360;
      }
      lon = wp.lng + edition;
      prevLon = wp.lng;
      return [wp.lat, lon];
    });

    const layer = L.polyline(points, { color: '#F4652C', weight: 3 }).addTo(map);
    layerRef.current = layer;
    map.fitBounds(layer.getBounds(), { padding: [24, 24] });
    map.invalidateSize();
  }, [result]);

  const filteredPassages = useMemo(() => {
    const q = passageQuery.trim().toLowerCase();
    if (!q) return PASSAGE_AREA_OPTIONS;
    return PASSAGE_AREA_OPTIONS.filter((p) => p.label.toLowerCase().includes(q));
  }, [passageQuery]);

  const passageGroups = useMemo(
    () => groupPassagesByRegion(filteredPassages),
    [filteredPassages],
  );

  const fromPort = splitPortDisplay(leg?.fromPortName, leg?.fromPortId);
  const toPort = splitPortDisplay(leg?.toPortName, leg?.toPortId);

  const togglePassage = (id) => {
    setAllowedPassages((current) => (
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    ));
  };

  const clearAllPassages = () => {
    setAllowedPassages([]);
  };

  const handleGetDistance = async () => {
    if (!leg?.fromPortId || !leg?.toPortId) {
      await alert({
        title: 'Missing Information',
        message: 'Please select From Port and To Port',
        confirmLabel: 'OK',
      });
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const allowedAreas = [...allowedPassages];
      if (piracyZone) allowedAreas.push(Number(piracyZone));
      const data = await fetchPortDistance({
        startPortId: leg.fromPortId,
        endPortId: leg.toPortId,
        greatCircleInterval: navMethod === '1' ? greatCircleInterval : 0,
        secaAvoidance,
        aslCompliance,
        allowedAreas,
      });
      if (Number(data.resultCode) !== 1) {
        throw new Error(data.resultText || 'Distance lookup failed.');
      }
      if (!data.waypoints?.length) {
        throw new Error(data.resultText || 'No route waypoints returned.');
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch distance.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!result || !leg) return;
    const totalDistance = Number(result.totalDistance) || 0;
    const secaDistance = Number(result.secaDistance) || 0;
    onConfirm?.(leg.id, {
      distance: String(totalDistance),
      secaDistance: String(secaDistance),
      navMethod: navMethod || undefined,
      canals: result.canals || { turkish: false, suez: false, panama: false },
    });
    onClose?.();
  };

  if (!open || !leg) return null;

  return createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="distance-fetch-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h4 id="distance-fetch-title" className={styles.title}>
            Route
          </h4>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Route</p>
            <div className={`${styles.formGrid} ${styles.routeRow}${navMethod === '1' ? ` ${styles.routeRowWithInterval}` : ''}`}>
              <div>
                <div className={styles.fieldLabel}>From Port</div>
                <div className={styles.portBox}>
                  <div className={styles.portPrimary}>{fromPort.primary}</div>
                  {fromPort.secondary ? (
                    <div className={styles.portSecondary}>{fromPort.secondary}</div>
                  ) : null}
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>To Port</div>
                <div className={styles.portBox}>
                  <div className={styles.portPrimary}>{toPort.primary}</div>
                  {toPort.secondary ? (
                    <div className={styles.portSecondary}>{toPort.secondary}</div>
                  ) : null}
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>Navigation Method</div>
                <div className={styles.cardSelect}>
                  <CardSelect
                    options={NAV_METHOD_OPTIONS}
                    value={navMethod}
                    onChange={setNavMethod}
                    placeholder="Navigation Method"
                    ariaLabel="Navigation Method"
                    align="start"
                  />
                </div>
              </div>
              {navMethod === '1' ? (
                <div>
                  <div className={styles.fieldLabel}>Great Circle Interval (n.m.)</div>
                  <div className={styles.cardSelect}>
                    <CardSelect
                      options={INTERVAL_OPTIONS}
                      value={greatCircleInterval}
                      onChange={setGreatCircleInterval}
                      placeholder="Interval"
                      ariaLabel="Great Circle Interval"
                      align="start"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Avoidance Settings</p>
            <div className={styles.formGrid}>
              <div>
                <div className={styles.fieldLabel}>SECA Area Avoidance (%)</div>
                <div className={styles.cardSelect}>
                  <CardSelect
                    options={PERCENT_OPTIONS}
                    value={secaAvoidance}
                    onChange={setSecaAvoidance}
                    placeholder="SECA Avoidance"
                    ariaLabel="SECA Area Avoidance"
                    align="start"
                  />
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>ASL Compliance (%)</div>
                <div className={styles.cardSelect}>
                  <CardSelect
                    options={PERCENT_OPTIONS}
                    value={aslCompliance}
                    onChange={setAslCompliance}
                    placeholder="ASL Compliance"
                    ariaLabel="ASL Compliance"
                    align="start"
                  />
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>Piracy Avoidance Settings</div>
                <div className={styles.cardSelect}>
                  <CardSelect
                    options={PIRACY_OPTIONS}
                    value={piracyZone}
                    onChange={setPiracyZone}
                    placeholder="Piracy Avoidance"
                    ariaLabel="Piracy Avoidance Settings"
                    align="start"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.workRow}>
            <div className={styles.mapCard}>
              {loading ? (
                <div className={styles.mapLoading}>Fetching route…</div>
              ) : null}
              <div ref={mapRef} className={styles.map} />
            </div>

            <div className={styles.passageCard}>
              <div className={styles.passageHead}>
                <div className={styles.passageHeadRow}>
                  <span className={styles.passageTitle}>Passage Names</span>
                  <button
                    type="button"
                    className={styles.clearAll}
                    onClick={clearAllPassages}
                  >
                    Clear all
                  </button>
                </div>
                <div className={styles.passageSearch}>
                  <input
                    className={styles.passageSearchInput}
                    type="search"
                    placeholder="Search passages"
                    value={passageQuery}
                    onChange={(e) => setPassageQuery(e.target.value)}
                    aria-label="Search passages"
                  />
                </div>
              </div>
              <ul className={styles.passageList}>
                {passageGroups.length === 0 ? (
                  <li className={styles.passageEmpty}>No passages match</li>
                ) : (
                  passageGroups.map(([region, passages]) => (
                    <React.Fragment key={region}>
                      <li className={styles.passageGroup}>{region}</li>
                      {passages.map((p) => (
                        <li key={p.id}>
                          <label className={styles.passageItem}>
                            <input
                              type="checkbox"
                              checked={allowedPassages.includes(p.id)}
                              onChange={() => togglePassage(p.id)}
                            />
                            <span>{p.label}</span>
                          </label>
                        </li>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </ul>
            </div>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.resultsRow}>
            <div className={`${styles.statCard} ${styles.statCardPrimary}`}>
              <div className={styles.statLabel}>Total Distance</div>
              <div className={styles.statValue}>
                {result ? Number(result.totalDistance).toFixed(2) : '0.00'}
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.statCardSecondary}`}>
              <div className={styles.statLabel}>Total SECA Distance</div>
              <div className={styles.statValue}>
                {result ? Number(result.secaDistance).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button type="button" variant="close" label="Close" onClick={onClose} />
          <div className={styles.footerActions}>
            <Button
              type="button"
              variant="danger"
              label={loading ? 'Calculating…' : 'Calculate'}
              onClick={handleGetDistance}
              disabled={loading}
            />
            <Button
              type="button"
              variant="primary"
              label="Confirm Route"
              onClick={handleConfirm}
              disabled={!result || loading}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
