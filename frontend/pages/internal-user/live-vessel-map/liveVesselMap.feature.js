/**
 * Isolated global Live Vessel Map (preview).
 *
 * Does not change SOPF "Vessels on Water", Period Business, Spot, or TC pages.
 *
 * To hide: set LIVE_VESSEL_MAP_ENABLED to false.
 * To remove: delete frontend/pages/internal-user/live-vessel-map/,
 * backend/src/routes/liveVesselMap.js, backend/src/services/liveVesselMapRouteService.js,
 * and the LIVE_VESSEL_MAP wires in App.jsx, api.js, internalUserModules.js,
 * internalUserPageHeaders.jsx, and InternalUserSidebar.jsx.
 */
export const LIVE_VESSEL_MAP_ENABLED = true;
export const LIVE_VESSEL_MAP_PATH = '/internal-user/live-vessels';
export const LIVE_VESSEL_MAP_TITLE = 'Live Vessel Map';
