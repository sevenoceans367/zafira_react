import { listPerformingVessels } from './opsChecklistService.js';
import { fetchLastPositionsForImos } from './vesselPositionService.js';

function stripImo(value) {
  return String(value || '').replace(/^IMO/i, '').replace(/\D/g, '').trim();
}

/**
 * Overlay Zafira performing (in-ops) vessels on the live map using AIS last positions.
 */
export async function fetchFleetOverlay() {
  const { records } = await listPerformingVessels({ kind: 'all' });
  const byImo = new Map();

  (records || []).forEach((row) => {
    const imo = stripImo(row.vesselImoNo || row.imoNo);
    if (!imo) return;
    if (!byImo.has(imo)) {
      byImo.set(imo, {
        imo,
        shipName: row.vesselName || row.vessel || '',
        voyageNo: row.voyageNo || row.voy || row.tcNo || '',
        kind: row.kind || '',
        comId: row.comId || '',
      });
    }
  });

  const meta = [...byImo.values()];
  if (!meta.length) {
    return { resultCode: 200, vessels: [], performingCount: 0 };
  }

  const positions = await fetchLastPositionsForImos(meta.map((row) => row.imo));
  const posByImo = new Map(
    positions.map((vessel) => [stripImo(vessel.ImoNumber), vessel]),
  );

  const vessels = meta.map((row, index) => {
    const ais = posByImo.get(row.imo);
    if (ais) {
      return {
        ...ais,
        ShipName: ais.ShipName || row.shipName,
        ImoNumber: ais.ImoNumber || row.imo,
        isFleet: true,
        fleetKind: row.kind,
        fleetVoyageNo: row.voyageNo,
        fleetComId: row.comId,
      };
    }

    // Dev fallback when LastPosition is unavailable: keep pin near a hub.
    const hubs = [
      [1.26, 103.82],
      [51.95, 4.14],
      [25.27, 55.3],
      [29.45, -94.7],
      [31.23, 121.47],
    ];
    const [lat, lng] = hubs[index % hubs.length];
    return {
      ShipName: row.shipName || `Fleet ${row.imo}`,
      ImoNumber: row.imo,
      Latitude: lat + (index % 5) * 0.12,
      Longitude: lng + (index % 4) * 0.12,
      PositionLastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' '),
      ShipFlag: '',
      DraughtDeclared: '',
      NavigationStatus: 'Under way using engine',
      SpeedOverGround: null,
      isFleet: true,
      fleetKind: row.kind,
      fleetVoyageNo: row.voyageNo,
      fleetComId: row.comId,
      fleetPositionApprox: true,
    };
  });

  return {
    resultCode: 200,
    vessels,
    performingCount: meta.length,
  };
}
