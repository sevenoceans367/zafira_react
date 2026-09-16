import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '@bainbridge/shared-auth';

export default function RequireAuth({ children, loginPath = '/login' }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}
