import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  CARGO_RELET_MODULE_LABELS,
  cargoReletAppPath,
  isCargoReletModule,
  parseCargoReletModuleFromPath,
} from '../constants/cargoReletModule.js';

export function useCargoReletModule() {
  const { module: routeModule } = useParams();
  const { pathname } = useLocation();

  return useMemo(() => {
    const module = isCargoReletModule(routeModule)
      ? routeModule
      : parseCargoReletModuleFromPath(pathname);

    return {
      module,
      moduleLabel: CARGO_RELET_MODULE_LABELS[module] ?? module.toUpperCase(),
      cargoReletPath: cargoReletAppPath(module),
      cargoReletOpsPath: cargoReletAppPath(module, 'ops'),
      cargoReletAddPath: cargoReletAppPath(module, 'add'),
      cargoReletEditPath: (fcaId) => cargoReletAppPath(module, String(fcaId)),
    };
  }, [pathname, routeModule]);
}
