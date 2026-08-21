import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { coaAppPath } from '../../../constants/coaModule.js';

/** Standalone cargo-relet list removed — relets live under COA Ops (Cargo Relet trade type). */
export default function CargoReletListPage() {
  const { module } = useParams();
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set('tradeType', 'relet');
  next.delete('status');
  return <Navigate to={`${coaAppPath(module, 'in-ops')}?${next.toString()}`} replace />;
}
