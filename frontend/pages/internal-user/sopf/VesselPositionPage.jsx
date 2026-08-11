import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Button, LoadingOverlay, useAlert } from '@bainbridge/shared-ui';
import { fetchVesselsWithinRange } from '../../../services/vesselPositions.js';
import VesselSearchModal from './VesselSearchModal.jsx';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAP_ATTRIBUTION,
  MAP_TILE_URL,
  RESULT_MAP_ZOOM,
  vesselDisplayName,
  vesselField,
} from './vesselPosition.constants.js';
import styles from './VesselPositionPage.module.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SHIP_SVG = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 11.5L3.2 6.5h9.6L14 11.5H2zm1.3-6.2L4.5 3h7l1.2 2.3H3.3zM7.2 12.2h1.6v1.6H7.2z"/></svg>`;

const EYE_OPEN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

const EYE_CLOSED = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M3 3l18 18M10.5 6.2A9.6 9.6 0 0112 6c6.5 0 10 6 10 6a16.4 16.4 0 01-3.1 3.6M7 7.8A16 16 0 002 12s3.5 6 10 6c1.3 0 2.5-.3 3.6-.7" />
    <path d="M9.9 9.9A2.5 2.5 0 0014 14" />
  </svg>
);

function createVesselIcon(name, active) {
  const pinClass = active
    ? `${styles.vesselPin} ${styles.vesselPinActive}`
    : styles.vesselPin;
  const label = String(name || 'Vessel').slice(0, 22);

  return L.divIcon({
    className: styles.pinIconRoot,
    html: `
      <div class="${pinClass}">
        <div class="${styles.pinIcon}">${SHIP_SVG}</div>
        <div class="${styles.pinLabel}">${escapeHtml(label)}</div>
      </div>
    `,
    iconSize: [140, 52],
    iconAnchor: [70, 40],
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function vesselKey(vessel) {
  return String(vessel?.ImoNumber || vessel?.MmsiNumber || vessel?.ShipName || '');
}

function DetailBlock({ themeClass, title, hidden, onToggle, children }) {
  return (
    <div className={`${styles.pblock} ${themeClass}${hidden ? ` ${styles.pblockHidden}` : ''}`}>
      <div className={styles.pblockLabel}>
        <span className={styles.pblockDot} aria-hidden="true" />
        {title}
        <button
          type="button"
          className={styles.eyeToggle}
          onClick={onToggle}
          aria-label={hidden ? `Show ${title}` : `Hide ${title}`}
          title={hidden ? 'Show' : 'Hide'}
        >
          {hidden ? EYE_CLOSED : EYE_OPEN}
        </button>
      </div>
      <div className={styles.pblockBody}>{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  const display = value || '—';
  return (
    <div className={styles.prow}>
      <span className={styles.pk}>{label}</span>
      <span className={styles.pv}>{display}</span>
    </div>
  );
}

export default function VesselPositionPage() {
  const alert = useAlert();
  const mapContainerRef = useRef(null);
  const mapWrapRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const clickMarkerRef = useRef(null);
  const vesselMarkersRef = useRef(new Map());
  const searchLockedRef = useRef(false);
  const selectedVesselRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('');
  const [navStatus, setNavStatus] = useState([]);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bubblePos, setBubblePos] = useState(null);
  const [hiddenBlocks, setHiddenBlocks] = useState({
    voyage: false,
    position: false,
    ship: false,
  });

  const updateBubblePosition = useCallback((vessel) => {
    const map = mapRef.current;
    const wrap = mapWrapRef.current;
    if (!map || !wrap || !vessel) {
      setBubblePos(null);
      return;
    }
    const lat = Number(vessel.Latitude);
    const lng = Number(vessel.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setBubblePos(null);
      return;
    }
    const point = map.latLngToContainerPoint([lat, lng]);
    setBubblePos({ left: point.x, top: point.y });
  }, []);

  const selectVessel = useCallback((vessel) => {
    selectedVesselRef.current = vessel;
    setSelectedVessel(vessel);
    setPanelOpen(false);
    updateBubblePosition(vessel);

    vesselMarkersRef.current.forEach((marker, key) => {
      const active = key === vesselKey(vessel);
      marker.setIcon(createVesselIcon(vesselDisplayName(marker.vesselData || vessel), active));
    });
  }, [updateBubblePosition]);

  const clearSelection = useCallback(() => {
    selectedVesselRef.current = null;
    setSelectedVessel(null);
    setPanelOpen(false);
    setBubblePos(null);
    vesselMarkersRef.current.forEach((marker) => {
      marker.setIcon(createVesselIcon(vesselDisplayName(marker.vesselData), false));
    });
  }, []);

  const clearMarkers = useCallback(() => {
    markerLayerRef.current?.clearLayers();
    vesselMarkersRef.current.clear();
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
    clearSelection();
    const bounds = [];

    vessels.forEach((vessel) => {
      const lat = Number(vessel.Latitude);
      const lng = Number(vessel.Longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const name = vesselDisplayName(vessel);
      const marker = L.marker([lat, lng], {
        icon: createVesselIcon(name, false),
        riseOnHover: true,
      }).addTo(layer);

      marker.vesselData = vessel;
      vesselMarkersRef.current.set(vesselKey(vessel), marker);

      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        selectVessel(vessel);
      });

      bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
      map.setZoom(RESULT_MAP_ZOOM);
    }
  }, [clearMarkers, clearSelection, selectVessel]);

  const handleReset = useCallback(() => {
    searchLockedRef.current = false;
    setShowReset(false);
    setModalOpen(false);
    setLatitude('');
    setLongitude('');
    setRadius('');
    setNavStatus([]);
    clearSelection();
    clearMarkers();

    const map = mapRef.current;
    if (map) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    }
  }, [clearMarkers, clearSelection]);

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
        await alert({
          title: 'Error',
          message: 'Something went wrong!',
          confirmLabel: 'OK',
        });
        handleReset();
        return;
      }

      if (!data.vessels?.length) {
        await alert({
          title: 'Notice',
          message: 'No vessels found!',
          confirmLabel: 'OK',
        });
        handleReset();
        return;
      }

      searchLockedRef.current = true;
      setShowReset(true);
      renderVessels(data.vessels);
    } catch (error) {
      await alert({
        title: 'Error',
        message: error.message || 'Something went wrong!',
        confirmLabel: 'OK',
      });
      handleReset();
    } finally {
      setLoading(false);
    }
  }, [alert, latitude, longitude, radius, navStatus, renderVessels, handleReset]);

  const handleMapClick = useCallback((event) => {
    if (searchLockedRef.current) {
      clearSelection();
      return;
    }

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
  }, [clearSelection]);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    if (clickMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(clickMarkerRef.current);
      clickMarkerRef.current = null;
    }
  }, []);

  const toggleBlock = useCallback((key) => {
    setHiddenBlocks((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
    }).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    map.attributionControl.setPrefix(false);
    L.tileLayer(MAP_TILE_URL, { attribution: MAP_ATTRIBUTION }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    map.on('click', handleMapClick);

    const syncBubble = () => {
      if (selectedVesselRef.current) {
        updateBubblePosition(selectedVesselRef.current);
      }
    };
    map.on('move', syncBubble);
    map.on('zoom', syncBubble);
    map.on('moveend', syncBubble);
    map.on('zoomend', syncBubble);

    mapRef.current = map;

    return () => {
      map.off('click', handleMapClick);
      map.off('move', syncBubble);
      map.off('zoom', syncBubble);
      map.off('moveend', syncBubble);
      map.off('zoomend', syncBubble);
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, [handleMapClick, updateBubblePosition]);

  const origin = vesselField(selectedVessel, 'OriginDeclared');
  const dest = vesselField(selectedVessel, 'DestDeclared');
  const eta = vesselField(selectedVessel, 'EtaDeclared');
  const imo = vesselField(selectedVessel, 'ImoNumber');
  const mmsi = vesselField(selectedVessel, 'MmsiNumber');
  const lastPos = vesselField(selectedVessel, 'PositionLastUpdated');
  const flag = vesselField(selectedVessel, 'ShipFlag');
  const draught = vesselField(selectedVessel, 'DraughtDeclared');
  const latStr = vesselField(selectedVessel, 'Latitude');
  const lngStr = vesselField(selectedVessel, 'Longitude');

  return (
    <div className={`zafira-page ${styles.page}`}>
      <LoadingOverlay show={loading} />

      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>Vessels on Water</h2>
              <span className={styles.liveBadge}>
                <span className={styles.liveDot} aria-hidden="true" />
                Live
                <span className={styles.liveSrc}>AIS + synced with SOPF &amp; SOC</span>
              </span>
            </div>
            <p className={styles.subheader}>
              Click anywhere on the map to find vessels within the chosen radius. Select a pin for
              voyage details.
            </p>
          </div>
          {showReset ? (
            <Button variant="primary" label="Reset" onClick={handleReset} />
          ) : null}
        </div>
      </header>

      <div ref={mapWrapRef} className={styles.mapWrap}>
        <div ref={mapContainerRef} className={styles.map} aria-label="Vessel positions map" />

        {selectedVessel && bubblePos && !panelOpen ? (
          <div
            className={styles.bubble}
            style={{ left: bubblePos.left, top: bubblePos.top }}
            role="dialog"
            aria-label={`${vesselDisplayName(selectedVessel)} summary`}
          >
            <div className={styles.bubbleTop}>
              <div className={styles.bubbleVessel}>{vesselDisplayName(selectedVessel)}</div>
            </div>

            {(origin || dest) ? (
              <>
                <p className={styles.bubbleLegLabel}>Current leg</p>
                <div className={styles.bubbleLeg}>
                  {origin ? <span className={`${styles.tag} ${styles.tagFrom}`}>{origin}</span> : null}
                  {origin && dest ? <span className={styles.bubbleArrow}>→</span> : null}
                  {dest ? <span className={`${styles.tag} ${styles.tagTo}`}>{dest}</span> : null}
                </div>
              </>
            ) : null}

            <div className={styles.bubbleMeta}>
              {eta ? (
                <div className={styles.bubbleMetaRow}>
                  <span>ETA</span>
                  <span>{eta}</span>
                </div>
              ) : null}
              {imo ? (
                <div className={styles.bubbleMetaRow}>
                  <span>IMO</span>
                  <span>{imo}</span>
                </div>
              ) : null}
              {lastPos ? (
                <div className={styles.bubbleMetaRow}>
                  <span>Last pos</span>
                  <span>{lastPos}</span>
                </div>
              ) : null}
              {!eta && !imo && !lastPos ? (
                <div className={styles.bubbleMetaRow}>
                  <span>Position</span>
                  <span>
                    {latStr || '—'}, {lngStr || '—'}
                  </span>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={styles.btnDetails}
              onClick={() => setPanelOpen(true)}
            >
              View Full Details
            </button>
          </div>
        ) : null}
      </div>

      {panelOpen && selectedVessel ? (
        <>
          <div
            className={styles.scrim}
            onClick={() => setPanelOpen(false)}
            aria-hidden="true"
          />
          <aside className={styles.sidePanel} role="dialog" aria-label="Vessel details">
            <div className={styles.panelHead}>
              <div className={styles.panelHeadTop}>
                <div>
                  <h3 className={styles.panelVesselName}>{vesselDisplayName(selectedVessel)}</h3>
                  <p className={styles.panelVesselMeta}>
                    {[imo && `IMO ${imo}`, mmsi && `MMSI ${mmsi}`, flag].filter(Boolean).join(' · ')
                      || 'AIS position'}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.panelClose}
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close details"
                >
                  ✕
                </button>
              </div>

              {(origin || dest) ? (
                <div className={styles.panelLeg}>
                  {origin ? <span className={`${styles.tag} ${styles.tagFrom}`}>{origin}</span> : null}
                  {origin && dest ? <span className={styles.bubbleArrow}>→</span> : null}
                  {dest ? <span className={`${styles.tag} ${styles.tagTo}`}>{dest}</span> : null}
                </div>
              ) : null}
            </div>

            <div className={styles.panelBody}>
              <DetailBlock
                themeClass={styles.themeNavy}
                title="Voyage"
                hidden={hiddenBlocks.voyage}
                onToggle={() => toggleBlock('voyage')}
              >
                <DetailRow label="Origin" value={origin} />
                <DetailRow label="Destination" value={dest} />
                <DetailRow label="ETA" value={eta} />
                <DetailRow label="IMO" value={imo} />
                <DetailRow label="MMSI" value={mmsi} />
              </DetailBlock>

              <DetailBlock
                themeClass={styles.themeOrange}
                title="Position"
                hidden={hiddenBlocks.position}
                onToggle={() => toggleBlock('position')}
              >
                <DetailRow label="Last updated" value={lastPos} />
                <DetailRow label="Latitude" value={latStr} />
                <DetailRow label="Longitude" value={lngStr} />
              </DetailBlock>

              <DetailBlock
                themeClass={styles.themePurple}
                title="Ship"
                hidden={hiddenBlocks.ship}
                onToggle={() => toggleBlock('ship')}
              >
                <DetailRow label="Flag" value={flag} />
                <DetailRow label="Draught" value={draught} />
              </DetailBlock>
            </div>
          </aside>
        </>
      ) : null}

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
