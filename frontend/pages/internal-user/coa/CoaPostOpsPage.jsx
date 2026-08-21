import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { coaAppPath } from '../../../constants/coaModule.js';
import CoaOpsListPage from './CoaOpsListPage.jsx';

export default function CoaPostOpsPage() {
  const { module } = useParams();
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set('tab', 'postops');
  return <Navigate to={`${coaAppPath(module, 'in-ops')}?${next.toString()}`} replace />;
}
