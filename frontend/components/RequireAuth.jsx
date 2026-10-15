import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  getUser,
  isAuthenticated,
  resolveAppKey,
} from '@bainbridge/shared-auth';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.loginPath]
 * @param {string} [props.appKey] — required session app ('internal' | 'agent' | 'admin' | …)
 */
export default function RequireAuth({ children, loginPath = '/login', appKey = 'internal' }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />;
  }

  if (appKey) {
    const userType = getUser()?.userType;
    if (resolveAppKey(userType) !== appKey) {
      return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />;
    }
  }

  return children;
}
