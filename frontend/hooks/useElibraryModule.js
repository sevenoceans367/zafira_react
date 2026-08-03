import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  ELIBRARY_MODULE_LABELS,
  elibraryAppPath,
  isElibraryModule,
  parseElibraryModuleFromPath,
} from '../constants/elibraryModule.js';

export function useElibraryModule() {
  const { module: routeModule } = useParams();
  const { pathname } = useLocation();

  return useMemo(() => {
    const module = isElibraryModule(routeModule)
      ? routeModule
      : parseElibraryModuleFromPath(pathname);

    return {
      module,
      moduleLabel: ELIBRARY_MODULE_LABELS[module] ?? module.toUpperCase(),
      elibraryPath: elibraryAppPath(module),
    };
  }, [pathname, routeModule]);
}
