import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { coaAppPath } from '../../../constants/coaModule.js';

/** Standalone cargo-relet list removed from the menu — relets live under Running COA Business. */
export default function CargoReletListPage() {
  const { module } = useParams();
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set('status', 'relets');
  return <Navigate to={`${coaAppPath(module, 'running')}?${next.toString()}`} replace />;
}
