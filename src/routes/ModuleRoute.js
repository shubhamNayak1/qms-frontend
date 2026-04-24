import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { ROUTES } from '../utils/constants';
import Loader from '../components/Loader';

/**
 * Wraps a route and redirects to /dashboard if the user
 * does not have access to the given moduleKey.
 */
const ModuleRoute = ({ moduleKey, children }) => {
  const { bootstrapping, canAccessModule } = useAuth();

  if (bootstrapping) return <Loader />;

  if (!canAccessModule(moduleKey)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return children;
};

export default ModuleRoute;
