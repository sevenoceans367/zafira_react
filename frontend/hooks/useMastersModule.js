import { useLocation } from 'react-router-dom';
import { parseMastersModuleFromPath } from '../constants/mastersModule.js';

export function useMastersModule() {
  const { pathname } = useLocation();
  return { module: parseMastersModuleFromPath(pathname) };
}
