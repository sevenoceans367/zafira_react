import { AUTO_LOAD_HUBS } from './liveVesselMap.constants.js';

const BASE = '/api/internal-user/sopf';

export async function fetchVesselsWithinRange({ lat, lng, radius, navstatus }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radius),
  });

  if (navstatus?.length) {
    params.set('navstatus', navstatus.join(','));
  }

  const response = await fetch(`${BASE}/vessel_positions/within_range?${params}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Failed to load vessels within range.');
  }

  return data;
}

export async function fetchVesselRoute({ origin, destination }) {
  const params = new URLSearchParams({
    from: String(origin || ''),
    to: String(destination || ''),
  });
  const response = await fetch(`/api/internal-user/live-vessels/route?${params}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to load vessel route.');
  }
  return data;
}

export function collectVoyageLegs(vessels, maxLegs = 20) {
  const legs = new Map();
  (vessels || []).forEach((vessel) => {
    const origin = String(vessel?.OriginDeclared || '').trim();
    const destination = String(vessel?.DestDeclared || '').trim();
    if (!origin || !destination) return;
    const key = `${origin.toLowerCase()}|${destination.toLowerCase()}`;
    if (!legs.has(key)) {
      legs.set(key, { origin, destination, key });
    }
  });
  return [...legs.values()].slice(0, maxLegs);
}

export async function fetchFleetRoutes(vessels, { maxLegs = 20 } = {}) {
  const legs = collectVoyageLegs(vessels, maxLegs);
  const results = await Promise.allSettled(
    legs.map(async (leg) => {
      const route = await fetchVesselRoute({
        origin: leg.origin,
        destination: leg.destination,
      });
      return { ...route, legKey: leg.key };
    }),
  );

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
}

function vesselMergeKey(vessel) {
  const imo = String(vessel?.ImoNumber || '').trim();
  const lat = Number(vessel?.Latitude);
  const lng = Number(vessel?.Longitude);
  if (imo && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${imo}|${lat.toFixed(1)}|${lng.toFixed(1)}`;
  }
  return `${vessel?.MmsiNumber || vessel?.ShipName || 'vessel'}|${lat}|${lng}`;
}

function mergeVessels(groups) {
  const byKey = new Map();
  groups.flat().forEach((vessel) => {
    if (!vessel) return;
    const key = vesselMergeKey(vessel);
    if (!byKey.has(key)) byKey.set(key, vessel);
  });
  return [...byKey.values()];
}

/** Auto-load fleet across major hubs so the map has ships as soon as it opens. */
export async function fetchLiveVesselFleet() {
  const results = await Promise.allSettled(
    AUTO_LOAD_HUBS.map((hub) => fetchVesselsWithinRange({
      lat: hub.lat,
      lng: hub.lng,
      radius: hub.radius,
      navstatus: [],
    })),
  );

  const vesselGroups = results
    .filter((result) => result.status === 'fulfilled' && result.value?.resultCode === 200)
    .map((result) => result.value.vessels || []);

  const vessels = mergeVessels(vesselGroups);
  if (vessels.length) {
    return { resultCode: 200, vessels };
  }

  const firstError = results.find((result) => result.status === 'rejected');
  if (firstError) {
    throw firstError.reason;
  }

  return { resultCode: 200, vessels: [] };
}
