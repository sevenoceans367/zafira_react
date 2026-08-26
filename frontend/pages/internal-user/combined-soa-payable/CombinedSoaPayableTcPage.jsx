import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { groupPaymentsAppPath } from '../../../constants/combinedSoaPayablePageHeaders.js';

/** Legacy Combined SOA Payable TC route → Group Payments (TC filter). */
export default function CombinedSoaPayableTcPage() {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set('contractType', 'tc');
  const qs = next.toString();
  return <Navigate to={`${groupPaymentsAppPath()}${qs ? `?${qs}` : ''}`} replace />;
}
