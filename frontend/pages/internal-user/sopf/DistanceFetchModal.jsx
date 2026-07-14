import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@bainbridge/shared-ui';
import { fetchPortDistance } from '../../../services/estimateDetail.js';
import {
  NAVIGATION_METHOD_OPTIONS,
  PASSAGE_AREA_OPTIONS,
  PIRACY_ZONE_OPTIONS,
  defaultAllowedPassages,
} from './distanceFetch.constants.js';
import styles from './DistanceFetchModal.module.css';

function rangeOptions(max, suffix = '') {
  const opts = [];
  for (let i = 0; i <= max; i += 1) {
    opts.push({ value: String(i), label: `${i}${suffix}` });
  }
  return opts;
}

const INTERVAL_OPTIONS = rangeOptions(500, ' n.m.');
const PERCENT_OPTIONS = rangeOptions(100, ' %');

export default function DistanceFetchModal({
  open,
  leg,
  onClose,
  onConfirm,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);

  const [navMethod, setNavMethod] = useState('');
  const [greatCircleInterval, setGreatCircleInterval] = useState('0');
  const [secaAvoidance, setSecaAvoidance] = useState('0');
  const [aslCompliance, setAslCompliance] = useState('0');
  const [piracyZone, setPiracyZone] = useState('');
  const [allowedPassages, setAllowedPassages] = useState(defaultAllowedPassages);
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

    const layer = L.polyline(points, { color: '#c62828', weight: 3 }).addTo(map);
    layerRef.current = layer;
    map.fitBounds(layer.getBounds(), { padding: [24, 24] });
    map.invalidateSize();
  }, [result]);

  const togglePassage = (id) => {
    setAllowedPassages((current) => (
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    ));
  };

  const handleGetDistance = async () => {
    if (!leg?.fromPortId || !leg?.toPortId) {
      setError('Please select From Port and To Port');
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
          <h4 id="distance-fetch-title">Port to Port Distance</h4>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.optionsGrid}>
            <div>
              <div className={styles.label}>From Port</div>
              <div className={styles.value}>{leg.fromPortName || leg.fromPortId || '—'}</div>
            </div>
            <div>
              <div className={styles.label}>To Port</div>
              <div className={styles.value}>{leg.toPortName || leg.toPortId || '—'}</div>
            </div>
            <div>
              <div className={styles.label}>Navigation Method</div>
              <select value={navMethod} onChange={(e) => setNavMethod(e.target.value)}>
                {NAVIGATION_METHOD_OPTIONS.map((o) => (
                  <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {navMethod === '1' ? (
              <div>
                <div className={styles.label}>Great Circle Interval (n.m.)</div>
                <select
                  value={greatCircleInterval}
                  onChange={(e) => setGreatCircleInterval(e.target.value)}
                >
                  {INTERVAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <div className={styles.label}>SECA Area Avoidance (%)</div>
              <select value={secaAvoidance} onChange={(e) => setSecaAvoidance(e.target.value)}>
                {PERCENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div className={styles.label}>ASL Compliance (%)</div>
              <select value={aslCompliance} onChange={(e) => setAslCompliance(e.target.value)}>
                {PERCENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.span2}>
              <div className={styles.label}>Piracy Avoidance Settings</div>
              <select value={piracyZone} onChange={(e) => setPiracyZone(e.target.value)}>
                {PIRACY_ZONE_OPTIONS.map((o) => (
                  <option key={o.value || 'z1'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.mapRow}>
            <div className={styles.mapWrap}>
              {loading ? (
                <div className={styles.mapLoading}>Fetching route…</div>
              ) : null}
              <div ref={mapRef} className={styles.map} />
            </div>
            <div className={styles.passages}>
              <div className={styles.label}>Passage Names</div>
              <ul className={styles.passageList}>
                {PASSAGE_AREA_OPTIONS.map((p) => (
                  <li key={p.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={allowedPassages.includes(p.id)}
                        onChange={() => togglePassage(p.id)}
                      />
                      <span>{p.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.totals}>
            <div>
              <div className={styles.label}>Total Distance</div>
              <div className={styles.totalValue}>
                {result ? Number(result.totalDistance).toFixed(2) : '0.00'}
              </div>
            </div>
            <div>
              <div className={styles.label}>Total SECA Distance</div>
              <div className={styles.totalValue}>
                {result ? Number(result.secaDistance).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button
            type="button"
            variant="primary"
            label={loading ? 'Getting Distance…' : 'Get Distance'}
            onClick={handleGetDistance}
            disabled={loading}
          />
          <Button
            type="button"
            variant="danger"
            label="Confirm Route"
            onClick={handleConfirm}
            disabled={!result || loading}
          />
          <Button type="button" variant="outline" label="Close" onClick={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
