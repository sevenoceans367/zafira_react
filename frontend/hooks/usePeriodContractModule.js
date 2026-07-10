import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  PERIOD_CONTRACT_MODULE_LABELS,
  isPeriodContractModule,
  parsePeriodContractModuleFromPath,
  periodContractAppPath,
} from '../constants/periodContractModule.js';

export function usePeriodContractModule() {
  const { module: routeModule } = useParams();
  const { pathname } = useLocation();

  return useMemo(() => {
    const module = isPeriodContractModule(routeModule)
      ? routeModule
      : parsePeriodContractModuleFromPath(pathname);

    return {
      module,
      moduleLabel: PERIOD_CONTRACT_MODULE_LABELS[module] ?? module.toUpperCase(),
      periodContractPath: periodContractAppPath(module),
    };
  }, [pathname, routeModule]);
}
