import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  COA_MODULE_LABELS,
  coaAppPath,
  isCoaModule,
  parseCoaModuleFromPath,
} from '../constants/coaModule.js';

export function useCoaModule() {
  const { module: routeModule } = useParams();
  const { pathname } = useLocation();

  return useMemo(() => {
    const module = isCoaModule(routeModule)
      ? routeModule
      : parseCoaModuleFromPath(pathname);

    return {
      module,
      moduleLabel: COA_MODULE_LABELS[module] ?? module.toUpperCase(),
      coaPath: (segment = '') => coaAppPath(module, segment),
    };
  }, [pathname, routeModule]);
}
