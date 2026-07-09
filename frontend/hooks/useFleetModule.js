import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  FLEET_MODULE_LABELS,
  fleetAppPath,
  fleetVesselPath,
  isFleetModule,
  parseFleetModuleFromPath,
} from '../constants/fleetModule.js';

export function useFleetModule() {
  const { module: routeModule } = useParams();
  const { pathname } = useLocation();

  return useMemo(() => {
    const module = isFleetModule(routeModule)
      ? routeModule
      : parseFleetModuleFromPath(pathname);

    return {
      module,
      moduleLabel: FLEET_MODULE_LABELS[module] ?? module.toUpperCase(),
      fleetPath: fleetAppPath(module),
      vesselPath: (vesselId, segment) => fleetAppPath(module, `vessel/${vesselId}/${segment}`),
      fleetVesselPath: (vesselId, segment) => fleetVesselPath(module, vesselId, segment),
    };
  }, [pathname, routeModule]);
}
