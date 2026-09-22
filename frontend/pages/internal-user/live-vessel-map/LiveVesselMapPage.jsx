import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { EditIconButton, LoadingOverlay, useAlert } from '@bainbridge/shared-ui';
import { usePageHeaderActions, usePageHeaderHeading } from '../PageHeaderContext.jsx';
import refreshIconSrc from '../../../assets/refresh.png';
import LiveVesselMapControls from './LiveVesselMapControls.jsx';
import {
  fetchFleetOverlay,
  fetchFleetRoutes,
  fetchLiveVesselFleet,
  fetchVesselLastPosition,
} from './liveVesselMapApi.js';
import {
  agentInitials,
  formatMoney,
  metricTone,
  rateRowLabel,
  resolveCommercial,
  workingVfHref,
} from './liveVesselCommercial.js';
import {
  AUTO_LOAD_MAX_ZOOM,
  collectFlags,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_STYLE,
  DEFAULT_MAP_ZOOM,
  MAP_ATTRIBUTION,
  MAP_STYLES,
  MAX_AUTO_ROUTES,
  ROUTE_COLORS,
  SEARCH_MAP_ZOOM,
  vesselDisplayName,
  vesselField,
  vesselMatchesFilters,
  vesselVoyageLeg,
} from './liveVesselMap.constants.js';
import styles from './LiveVesselMapPage.module.css';
import {
  LIVE_VESSEL_MAP_BADGE,
  LIVE_VESSEL_MAP_HINT,
  LIVE_VESSEL_MAP_TITLE,
} from './liveVesselMap.feature.js';

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

const EMPTY_FILTERS = {
  navStatuses: [],
  flag: '',
  draughtMin: '',
  draughtMax: '',
  speedMin: '',
  speedMax: '',
};

function createVesselIcon(name, active, { fleet = false } = {}) {
  const classes = [styles.vesselPin];
  if (fleet) classes.push(styles.vesselPinFleet);
  if (active) classes.push(styles.vesselPinActive);
  const label = String(name || 'Vessel').slice(0, 22);

  return L.divIcon({
    className: styles.pinIconRoot,
    html: `
      <div class="${classes.join(' ')}">
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
  return String(
    `${vessel?.isFleet ? 'fleet' : 'ais'}|${vessel?.ImoNumber || vessel?.MmsiNumber || vessel?.ShipName || ''}|${vessel?.Latitude}|${vessel?.Longitude}`,
  );
}

const VF_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M14 3h7v7" />
    <path d="M10 14L21 3" />
    <path d="M21 14v7h-7" />
    <path d="M3 10V3h7" />
    <path d="M3 10l7-7" />
    <path d="M3 14v7h7" />
    <path d="M14 21l7-7" />
  </svg>
);

function contractChipClass(contract) {
  if (contract === 'tc') return styles.contractChipTc;
  if (contract === 'period') return styles.contractChipPeriod;
  if (contract === 'spot') return styles.contractChipSpot;
  return styles.contractChipAis;
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

function TermsRow({ value, onChange }) {
  return (
    <div className={styles.prow}>
      <span className={styles.pk}>Terms</span>
      <input
        className={styles.termsInput}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Terms"
      />
    </div>
  );
}

export default function LiveVesselMapPage() {
  const alert = useAlert();
  const setHeading = usePageHeaderHeading();
  const { setActions, clearActions } = usePageHeaderActions();
  const headerOwnerIdRef = useRef(`live-vessel-map-${Math.random().toString(36).slice(2)}`);
  const mapContainerRef = useRef(null);
  const mapWrapRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerLayerRef = useRef(null);
  const routesLayerRef = useRef(null);
  const routeLayersRef = useRef(new Map());
  const routesCacheRef = useRef(new Map());
  const vesselMarkersRef = useRef(new Map());
  const selectedVesselRef = useRef(null);
  const selectedLegKeyRef = useRef(null);
  const loadFleetRef = useRef(async () => {});
  const filtersRef = useRef(EMPTY_FILTERS);
  const showAisRef = useRef(true);
  const showFleetRef = useRef(true);
  const showRoutesRef = useRef(true);
  const aisVesselsRef = useRef([]);
  const fleetVesselsRef = useRef([]);

  const [loading, setLoading] = useState(true);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bubblePos, setBubblePos] = useState(null);
  const [hiddenBlocks, setHiddenBlocks] = useState({
    voyage: false,
    commercial: false,
    financials: false,
    agents: false,
  });
  const [termsDraft, setTermsDraft] = useState('');
  const [mapStyle, setMapStyle] = useState(DEFAULT_MAP_STYLE);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showAis, setShowAis] = useState(true);
  const [showFleet, setShowFleet] = useState(true);
  const [aisVessels, setAisVessels] = useState([]);
  const [fleetVessels, setFleetVessels] = useState([]);

  filtersRef.current = filters;
  showAisRef.current = showAis;
  showFleetRef.current = showFleet;
  showRoutesRef.current = showRoutes;
  aisVesselsRef.current = aisVessels;
  fleetVesselsRef.current = fleetVessels;

  const flagOptions = useMemo(
    () => collectFlags([...aisVessels, ...fleetVessels]),
    [aisVessels, fleetVessels],
  );

  const visibleVessels = useMemo(() => {
    const ais = showAis
      ? aisVessels.filter((vessel) => vesselMatchesFilters(vessel, filters))
      : [];
    const fleet = showFleet
      ? fleetVessels.filter((vessel) => vesselMatchesFilters(vessel, filters))
      : [];
    return [...ais, ...fleet];
  }, [aisVessels, fleetVessels, filters, showAis, showFleet]);

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
    setTermsDraft(vessel?.commercial?.terms || '');
    updateBubblePosition(vessel);

    const leg = vesselVoyageLeg(vessel);
    selectedLegKeyRef.current = leg?.key || null;
    setRouteInfo(leg ? routesCacheRef.current.get(leg.key) || null : null);

    vesselMarkersRef.current.forEach((marker, key) => {
      const active = key === vesselKey(vessel);
      marker.setIcon(createVesselIcon(
        vesselDisplayName(marker.vesselData || vessel),
        active,
        { fleet: Boolean(marker.vesselData?.isFleet) },
      ));
    });

    routeLayersRef.current.forEach((entry, legKey) => {
      const active = legKey === selectedLegKeyRef.current;
      entry.polyline.setStyle({
        color: active ? '#f4652c' : entry.color,
        weight: active ? 4 : 2,
        opacity: active ? 0.95 : 0.5,
      });
    });
  }, [updateBubblePosition]);

  const clearAllRoutes = useCallback(() => {
    const map = mapRef.current;
    if (routesLayerRef.current && map) {
      map.removeLayer(routesLayerRef.current);
    }
    routesLayerRef.current = null;
    routeLayersRef.current.clear();
    routesCacheRef.current.clear();
    selectedLegKeyRef.current = null;
    setRouteInfo(null);
  }, []);

  const drawFleetRoutes = useCallback((routes) => {
    const map = mapRef.current;
    if (!map || !routes?.length) return;

    clearAllRoutes();
    if (!showRoutesRef.current) {
      routes.forEach((route) => {
        if (route?.legKey) routesCacheRef.current.set(route.legKey, route);
      });
      return;
    }

    const layer = L.layerGroup();
    routes.forEach((route, index) => {
      if (!route?.waypoints?.length || !route.legKey) return;

      const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
      const latlngs = route.waypoints.map((wp) => [wp.lat, wp.lng]);
      const polyline = L.polyline(latlngs, {
        color,
        weight: 2,
        opacity: 0.5,
      }).addTo(layer);

      routeLayersRef.current.set(route.legKey, { polyline, color });
      routesCacheRef.current.set(route.legKey, route);
    });

    layer.addTo(map);
    routesLayerRef.current = layer;
  }, [clearAllRoutes]);

  const loadFleetRoutes = useCallback(async (vessels) => {
    setRoutesLoading(true);
    try {
      const routes = await fetchFleetRoutes(vessels, { maxLegs: MAX_AUTO_ROUTES });
      drawFleetRoutes(routes);
    } catch {
      clearAllRoutes();
    } finally {
      setRoutesLoading(false);
    }
  }, [clearAllRoutes, drawFleetRoutes]);

  const clearSelection = useCallback(() => {
    selectedVesselRef.current = null;
    selectedLegKeyRef.current = null;
    setSelectedVessel(null);
    setRouteInfo(null);
    setPanelOpen(false);
    setBubblePos(null);
    vesselMarkersRef.current.forEach((marker) => {
      marker.setIcon(createVesselIcon(
        vesselDisplayName(marker.vesselData),
        false,
        { fleet: Boolean(marker.vesselData?.isFleet) },
      ));
    });
    routeLayersRef.current.forEach((entry) => {
      entry.polyline.setStyle({
        color: entry.color,
        weight: 2,
        opacity: 0.5,
      });
    });
  }, []);

  const clearMarkers = useCallback(() => {
    markerLayerRef.current?.clearLayers();
    vesselMarkersRef.current.clear();
  }, []);

  const renderVisibleMarkers = useCallback((vessels, { fit = false } = {}) => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    clearMarkers();
    const bounds = [];

    vessels.forEach((vessel) => {
      const lat = Number(vessel.Latitude);
      const lng = Number(vessel.Longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const name = vesselDisplayName(vessel);
      const marker = L.marker([lat, lng], {
        icon: createVesselIcon(name, false, { fleet: Boolean(vessel.isFleet) }),
        riseOnHover: true,
        zIndexOffset: vessel.isFleet ? 200 : 0,
      }).addTo(layer);

      marker.vesselData = vessel;
      vesselMarkersRef.current.set(vesselKey(vessel), marker);

      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        selectVessel(vessel);
      });

      bounds.push([lat, lng]);
    });

    if (fit && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: AUTO_LOAD_MAX_ZOOM });
    } else if (fit) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    }

    if (selectedVesselRef.current) {
      const stillVisible = vessels.find((vessel) => vesselKey(vessel) === vesselKey(selectedVesselRef.current));
      if (stillVisible) selectVessel(stillVisible);
      else clearSelection();
    }
  }, [clearMarkers, clearSelection, selectVessel]);

  const applyVisibility = useCallback(({ fit = false } = {}) => {
    const ais = showAisRef.current
      ? aisVesselsRef.current.filter((vessel) => vesselMatchesFilters(vessel, filtersRef.current))
      : [];
    const fleet = showFleetRef.current
      ? fleetVesselsRef.current.filter((vessel) => vesselMatchesFilters(vessel, filtersRef.current))
      : [];
    renderVisibleMarkers([...ais, ...fleet], { fit });

    if (!showRoutesRef.current) {
      if (routesLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(routesLayerRef.current);
        routesLayerRef.current = null;
        routeLayersRef.current.clear();
      }
    } else if (!routesLayerRef.current && routesCacheRef.current.size) {
      drawFleetRoutes([...routesCacheRef.current.values()]);
    }
  }, [drawFleetRoutes, renderVisibleMarkers]);

  const loadFleet = useCallback(async () => {
    setLoading(true);
    clearSelection();

    try {
      const [aisData, fleetData] = await Promise.all([
        fetchLiveVesselFleet(),
        fetchFleetOverlay().catch(() => ({ resultCode: 200, vessels: [] })),
      ]);

      if (aisData.resultCode !== 200) {
        await alert({
          title: 'Error',
          message: 'Something went wrong!',
          confirmLabel: 'OK',
        });
        setAisVessels([]);
        setFleetVessels([]);
        clearMarkers();
        clearAllRoutes();
        return;
      }

      const ais = aisData.vessels || [];
      const fleet = (fleetData.vessels || []).map((vessel) => ({ ...vessel, isFleet: true }));
      setAisVessels(ais);
      setFleetVessels(fleet);
      aisVesselsRef.current = ais;
      fleetVesselsRef.current = fleet;

      if (!ais.length && !fleet.length) {
        await alert({
          title: 'Notice',
          message: 'No vessels found!',
          confirmLabel: 'OK',
        });
        clearMarkers();
        clearAllRoutes();
        return;
      }

      applyVisibility({ fit: true });
      loadFleetRoutes([...ais, ...fleet.filter((v) => v.OriginDeclared && v.DestDeclared)]);
    } catch (error) {
      await alert({
        title: 'Error',
        message: error.message || 'Something went wrong!',
        confirmLabel: 'OK',
      });
      clearMarkers();
      clearAllRoutes();
    } finally {
      setLoading(false);
    }
  }, [alert, applyVisibility, clearAllRoutes, clearMarkers, clearSelection, loadFleetRoutes]);

  loadFleetRef.current = loadFleet;

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const data = await fetchVesselLastPosition(q);
      const vessel = data.vessel || data.vessels?.[0];
      if (!vessel) {
        await alert({
          title: 'Notice',
          message: 'No vessel matched that search.',
          confirmLabel: 'OK',
        });
        return;
      }

      const lat = Number(vessel.Latitude);
      const lng = Number(vessel.Longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        await alert({
          title: 'Notice',
          message: 'Vessel found but position is unavailable.',
          confirmLabel: 'OK',
        });
        return;
      }

      const imo = String(vessel.ImoNumber || '').trim();
      const existingFleet = fleetVesselsRef.current.find(
        (row) => String(row.ImoNumber || '').trim() === imo,
      );
      const merged = {
        ...vessel,
        isFleet: Boolean(existingFleet || vessel.isFleet),
        fleetVoyageNo: existingFleet?.fleetVoyageNo || vessel.fleetVoyageNo,
        fleetKind: existingFleet?.fleetKind || vessel.fleetKind,
        fleetComId: existingFleet?.fleetComId || vessel.fleetComId,
        commercial: existingFleet?.commercial || vessel.commercial,
      };

      if (merged.isFleet) {
        const nextFleet = [
          merged,
          ...fleetVesselsRef.current.filter((row) => String(row.ImoNumber || '').trim() !== imo),
        ];
        setFleetVessels(nextFleet);
        fleetVesselsRef.current = nextFleet;
      } else {
        const nextAis = [
          merged,
          ...aisVesselsRef.current.filter((row) => String(row.ImoNumber || '').trim() !== imo),
        ];
        setAisVessels(nextAis);
        aisVesselsRef.current = nextAis;
      }

      applyVisibility();
      mapRef.current?.setView([lat, lng], SEARCH_MAP_ZOOM);
      selectVessel(merged);
    } catch (error) {
      await alert({
        title: 'Error',
        message: error.message || 'Search failed.',
        confirmLabel: 'OK',
      });
    } finally {
      setSearching(false);
    }
  }, [alert, applyVisibility, searchQuery, selectVessel]);

  const handleMapStyleChange = useCallback((styleId) => {
    setMapStyle(styleId);
    const map = mapRef.current;
    const style = MAP_STYLES[styleId];
    if (!map || !style) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(style.url, { attribution: MAP_ATTRIBUTION }).addTo(map);
  }, []);

  useEffect(() => {
    applyVisibility();
  }, [filters, showAis, showFleet, applyVisibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!showRoutes) {
      if (routesLayerRef.current) {
        map.removeLayer(routesLayerRef.current);
        routesLayerRef.current = null;
        routeLayersRef.current.clear();
      }
      return;
    }
    if (!routesLayerRef.current && routesCacheRef.current.size) {
      drawFleetRoutes([...routesCacheRef.current.values()]);
    }
  }, [drawFleetRoutes, showRoutes]);

  useEffect(() => {
    setHeading({
      title: (
        <span className={styles.headerTitleStack}>
          <span className={styles.headerTitleRow}>
            {LIVE_VESSEL_MAP_TITLE}
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} aria-hidden="true" />
              {LIVE_VESSEL_MAP_BADGE}
            </span>
          </span>
          <span className={styles.headerHint}>{LIVE_VESSEL_MAP_HINT}</span>
        </span>
      ),
    });
    return () => setHeading(null);
  }, [setHeading]);

  useEffect(() => {
    const ownerId = headerOwnerIdRef.current;
    setActions(
      <EditIconButton title="Refresh" onClick={() => loadFleetRef.current()}>
        <span
          className={styles.refreshIcon}
          style={{
            WebkitMaskImage: `url(${refreshIconSrc})`,
            maskImage: `url(${refreshIconSrc})`,
          }}
          aria-hidden="true"
        />
      </EditIconButton>,
      ownerId,
    );
    return () => clearActions(ownerId);
  }, [setActions, clearActions]);

  const handleMapClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const toggleBlock = useCallback((key) => {
    setHiddenBlocks((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
    }).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    map.attributionControl.setPrefix(false);
    const initialStyle = MAP_STYLES[DEFAULT_MAP_STYLE];
    tileLayerRef.current = L.tileLayer(initialStyle.url, { attribution: MAP_ATTRIBUTION }).addTo(map);

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
    loadFleetRef.current();

    return () => {
      map.off('click', handleMapClick);
      map.off('move', syncBubble);
      map.off('zoom', syncBubble);
      map.off('moveend', syncBubble);
      map.off('zoomend', syncBubble);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markerLayerRef.current = null;
      routesLayerRef.current = null;
      routeLayersRef.current.clear();
      routesCacheRef.current.clear();
    };
  }, [handleMapClick, updateBubblePosition]);

  const commercial = useMemo(
    () => (selectedVessel ? resolveCommercial(selectedVessel) : null),
    [selectedVessel],
  );
  const vfHref = commercial ? workingVfHref(commercial) : '';
  const tceTone = metricTone(commercial?.tce);
  const pnlTone = metricTone(commercial?.pnl);
  const legFrom = commercial?.legFrom || '';
  const legTo = commercial?.legTo || '';
  const passageFrom = commercial?.from || '';
  const passageTo = commercial?.to || '';
  const lastPos = vesselField(selectedVessel, 'PositionLastUpdated');
  const imo = vesselField(selectedVessel, 'ImoNumber');

  return (
    <div className={`zafira-page ${styles.page}`}>
      <LoadingOverlay show={loading || routesLoading || searching} />

      <LiveVesselMapControls
        mapStyle={mapStyle}
        onMapStyleChange={handleMapStyleChange}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearch={handleSearch}
        searching={searching}
        filters={filters}
        onFiltersChange={setFilters}
        flagOptions={flagOptions}
        showRoutes={showRoutes}
        onShowRoutesChange={setShowRoutes}
        showAis={showAis}
        onShowAisChange={setShowAis}
        showFleet={showFleet}
        onShowFleetChange={setShowFleet}
        aisCount={aisVessels.length}
        fleetCount={fleetVessels.length}
        visibleCount={visibleVessels.length}
      />

      <div ref={mapWrapRef} className={styles.mapWrap}>
        <div ref={mapContainerRef} className={styles.map} aria-label="Vessel positions map" />

        {selectedVessel && commercial && bubblePos && !panelOpen ? (
          <div
            className={styles.bubble}
            style={{ left: bubblePos.left, top: bubblePos.top }}
            role="dialog"
            aria-label={`${commercial.name} summary`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.bubbleTop}>
              <div className={styles.bubbleVessel}>{commercial.name}</div>
              <span className={`${styles.contractChip} ${contractChipClass(commercial.contract)}`}>
                {commercial.contractLabel}
              </span>
            </div>

            {(legFrom || legTo) ? (
              <>
                <p className={styles.bubbleLegLabel}>Current Leg</p>
                <div className={styles.bubbleLeg}>
                  {legFrom ? <span className={`${styles.tag} ${styles.tagFrom}`}>{legFrom}</span> : null}
                  {legFrom && legTo ? <span className={styles.bubbleArrow}>→</span> : null}
                  {legTo ? <span className={`${styles.tag} ${styles.tagTo}`}>{legTo}</span> : null}
                </div>
              </>
            ) : null}

            {(commercial.tce != null || commercial.pnl != null) ? (
              <div className={styles.bubbleMetrics}>
                <div className={`${styles.bmetric}${tceTone === 'pos' ? ` ${styles.bmetricPos}` : ''}${tceTone === 'neg' ? ` ${styles.bmetricNeg}` : ''}`}>
                  <div className={styles.bmetricLabel}>TCE</div>
                  <div className={styles.bmetricValue}>{formatMoney(commercial.tce) || '—'}</div>
                </div>
                <div className={`${styles.bmetric}${pnlTone === 'pos' ? ` ${styles.bmetricPos}` : ''}${pnlTone === 'neg' ? ` ${styles.bmetricNeg}` : ''}`}>
                  <div className={styles.bmetricLabel}>P&L</div>
                  <div className={styles.bmetricValue}>{formatMoney(commercial.pnl) || '—'}</div>
                </div>
              </div>
            ) : (
              <div className={styles.bubbleMeta}>
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
              </div>
            )}

            {commercial.approachingAgent ? (
              <div className={styles.bubbleAgent}>
                <div className={styles.bubbleAgentIco}>
                  {agentInitials(commercial.approachingAgent.name)}
                </div>
                <div>
                  <div className={styles.bubbleAgentName}>{commercial.approachingAgent.name}</div>
                  <div className={styles.bubbleAgentRole}>
                    {commercial.approachingAgent.role || 'Agent'}
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className={styles.btnDetails}
              onClick={() => setPanelOpen(true)}
            >
              Full Details
            </button>
          </div>
        ) : null}
      </div>

      {panelOpen && selectedVessel && commercial ? (
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
                  <h3 className={styles.panelVesselName}>{commercial.name}</h3>
                  <div className={styles.panelTypeRow}>
                    {commercial.vesselType ? (
                      <p className={styles.panelVesselType}>{commercial.vesselType}</p>
                    ) : (
                      <p className={styles.panelVesselType}>
                        {selectedVessel.isFleet ? 'Our fleet' : 'Open market'}
                        {imo ? ` · IMO ${imo}` : ''}
                      </p>
                    )}
                  </div>
                  <div className={styles.panelChips}>
                    <span className={`${styles.contractChip} ${contractChipClass(commercial.contract)}`}>
                      {commercial.contractLabel}
                    </span>
                  </div>
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

              {(passageFrom || passageTo) ? (
                <div className={styles.panelLeg}>
                  {passageFrom ? <span className={`${styles.tag} ${styles.tagFrom}`}>{passageFrom}</span> : null}
                  {passageFrom && passageTo ? <span className={styles.bubbleArrow}>→</span> : null}
                  {passageTo ? <span className={`${styles.tag} ${styles.tagTo}`}>{passageTo}</span> : null}
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
                <DetailRow label="Voyage No." value={commercial.voyageNo} />
                <DetailRow label="Cargo" value={commercial.cargo} />
                <DetailRow label="Laycan" value={commercial.laycan} />
                <DetailRow
                  label="Full Passage"
                  value={(passageFrom || passageTo)
                    ? `${passageFrom || '—'} → ${passageTo || '—'}`
                    : ''}
                />
              </DetailBlock>

              <DetailBlock
                themeClass={styles.themeOrange}
                title="Commercial Info"
                hidden={hiddenBlocks.commercial}
                onToggle={() => toggleBlock('commercial')}
              >
                <DetailRow label="Contract Type" value={commercial.contractLabel} />
                {commercial.contract ? (
                  <DetailRow
                    label={rateRowLabel(commercial.contract)}
                    value={commercial.rate}
                  />
                ) : null}
                <DetailRow label="Charterer" value={commercial.charterer} />
                <DetailRow label="Owner" value={commercial.owner} />
                <TermsRow value={termsDraft} onChange={setTermsDraft} />
              </DetailBlock>

              <DetailBlock
                themeClass={styles.themePurple}
                title="Financials"
                hidden={hiddenBlocks.financials}
                onToggle={() => toggleBlock('financials')}
              >
                <div className={styles.pfinRow}>
                  <div className={`${styles.pfinChip}${tceTone === 'pos' ? ` ${styles.pfinPos}` : ''}${tceTone === 'neg' ? ` ${styles.pfinNeg}` : ''}`}>
                    <div className={styles.pfinLabel}>TCE</div>
                    <div className={styles.pfinValue}>{formatMoney(commercial.tce) || '—'}</div>
                  </div>
                  <div className={`${styles.pfinChip}${pnlTone === 'pos' ? ` ${styles.pfinPos}` : ''}${pnlTone === 'neg' ? ` ${styles.pfinNeg}` : ''}`}>
                    <div className={styles.pfinLabel}>P&L</div>
                    <div className={styles.pfinValue}>{formatMoney(commercial.pnl) || '—'}</div>
                  </div>
                </div>
                {vfHref ? (
                  <Link className={styles.btnVf} to={vfHref}>
                    {VF_ICON}
                    Voyage Worksheet
                  </Link>
                ) : (
                  <span className={`${styles.btnVf} ${styles.btnVfDisabled}`} aria-disabled="true">
                    {VF_ICON}
                    Voyage Worksheet
                  </span>
                )}
              </DetailBlock>

              <DetailBlock
                themeClass={styles.themeBrown}
                title="Agent / Broker"
                hidden={hiddenBlocks.agents}
                onToggle={() => toggleBlock('agents')}
              >
                {commercial.contacts.length ? (
                  commercial.contacts.map((contact) => (
                    <div key={`${contact.name}-${contact.contact || contact.role}`} className={styles.agentCard}>
                      <div className={styles.agentAvatar}>{agentInitials(contact.name)}</div>
                      <div>
                        <div className={styles.agentName}>{contact.name}</div>
                        {contact.company ? <div className={styles.agentMeta}>{contact.company}</div> : null}
                        {contact.contact ? <div className={styles.agentMeta}>{contact.contact}</div> : null}
                        {contact.role ? <span className={styles.agentRole}>{contact.role}</span> : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyHint}>No agent or broker on file for this voyage.</p>
                )}
              </DetailBlock>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
