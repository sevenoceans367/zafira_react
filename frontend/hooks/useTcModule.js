import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  TC_MODULE_LABELS,
  isTcModule,
  parseTcModuleFromPath,
  tcAppPath,
} from '../constants/tcModule.js';

export function useTcModule() {
  const { module: routeModule } = useParams();
  const { pathname } = useLocation();

  return useMemo(() => {
    const module = isTcModule(routeModule)
      ? routeModule
      : parseTcModuleFromPath(pathname);

    return {
      module,
      moduleLabel: TC_MODULE_LABELS[module] ?? module.toUpperCase(),
      tcPath: (segment = '') => tcAppPath(module, segment),
    };
  }, [pathname, routeModule]);
}
