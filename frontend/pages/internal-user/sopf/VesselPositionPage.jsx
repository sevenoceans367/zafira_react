import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { fetchVesselsWithinRange } from '../../../services/vesselPositions.js';
import VesselSearchModal from './VesselSearchModal.jsx';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAP_ATTRIBUTION,
  MAP_TILE_URL,
  RESULT_MAP_ZOOM,
  VESSEL_POPUP_FIELDS,
} from './vesselPosition.constants.js';
import styles from './VesselPositionPage.module.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function buildPopupHtml(vessel) {
  const rows = VESSEL_POPUP_FIELDS.map(({ key, label }) => `
    <tr>
      <th style="padding:3px 5px;">${label}</th>
      <td style="padding:3px 5px;">${vessel[key] ?? ''}</td>
    </tr>
  `).join('');

  return `
    <table class="table table-bordered table-striped table-sm" style="border-collapse:collapse;margin:0;">
      <tbody>${rows}</tbody>
    </table>
  `;
}

export default function VesselPositionPage() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const clickMarkerRef = useRef(null);
  const searchLockedRef = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('');
  const [navStatus, setNavStatus] = useState([]);

  const clearMarkers = useCallback(() => {
    markerLayerRef.current?.clearLayers();
    if (clickMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(clickMarkerRef.current);
      clickMarkerRef.current = null;
    }
  }, []);

  const renderVessels = useCallback((vessels) => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    clearMarkers();
    const bounds = [];

    vessels.forEach((vessel) => {
      const lat = Number(vessel.Latitude);
      const lng = Number(vessel.Longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const marker = L.marker([lat, lng]).addTo(layer);
      marker.bindPopup(buildPopupHtml(vessel), { direction: 'top' });
      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout', () => marker.closePopup());
      bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds);
      map.setZoom(RESULT_MAP_ZOOM);
    }
  }, [clearMarkers]);

  const handleReset = useCallback(() => {
    searchLockedRef.current = false;
    setShowReset(false);
    setModalOpen(false);
    setLatitude('');
    setLongitude('');
    setRadius('');
    setNavStatus([]);
    clearMarkers();

    const map = mapRef.current;
    if (map) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    }
  }, [clearMarkers]);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setModalOpen(false);

    try {
      const data = await fetchVesselsWithinRange({
        lat: latitude,
        lng: longitude,
        radius,
        navstatus: navStatus,
      });

      if (data.resultCode !== 200) {
        window.alert('Something went wrong!');
        handleReset();
        return;
      }

      if (!data.vessels?.length) {
        window.alert('No vessels found!');
        handleReset();
        return;
      }

      searchLockedRef.current = true;
      setShowReset(true);
      renderVessels(data.vessels);
    } catch (error) {
      window.alert(error.message || 'Something went wrong!');
      handleReset();
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, radius, navStatus, renderVessels, handleReset]);

  const handleMapClick = useCallback((event) => {
    if (searchLockedRef.current) return;

    const { lat, lng } = event.latlng;
    const map = mapRef.current;
    if (!map) return;

    if (clickMarkerRef.current) {
      map.removeLayer(clickMarkerRef.current);
    }

    clickMarkerRef.current = L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`Lat: ${lat.toFixed(5)}<br>Lng: ${lng.toFixed(5)}`)
      .openPopup();

    setLatitude(lat.toFixed(5));
    setLongitude(lng.toFixed(5));
    setRadius('');
    setNavStatus([]);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    if (clickMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(clickMarkerRef.current);
      clickMarkerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    const map = L.map(mapContainerRef.current).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    map.attributionControl.setPrefix(MAP_ATTRIBUTION);
    L.tileLayer(MAP_TILE_URL).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    map.on('click', handleMapClick);
    mapRef.current = map;

    return () => {
      map.off('click', handleMapClick);
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, [handleMapClick]);

  return (
    <div className={`zafira-page ${styles.page}`}>
      <LoadingOverlay show={loading} />

      <div className={styles.headerRow}>
        <div className={styles.headerCopy}>
          <h2 className={styles.title}>Fleet</h2>
          <p className={styles.subtitle}>
            Click anywhere on the map to find vessels within the chosen radius
          </p>
        </div>
        {showReset ? (
          <Button variant="primary" label="Reset" onClick={handleReset} />
        ) : null}
      </div>

      <div ref={mapContainerRef} className={styles.map} aria-label="Vessel positions map" />

      <VesselSearchModal
        open={modalOpen}
        latitude={latitude}
        longitude={longitude}
        radius={radius}
        navStatus={navStatus}
        onRadiusChange={setRadius}
        onNavStatusChange={setNavStatus}
        onClose={handleModalClose}
        onSubmit={handleSearch}
        submitting={loading}
      />
    </div>
  );
}
