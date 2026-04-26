import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { ROUTES } from '../utils/constants';
import Loader from '../components/Loader';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, bootstrapping, mustChangePassword } = useAuth();
  const location = useLocation();

  if (loading || bootstrapping) return <Loader />;

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Force password change — redirect everywhere except the change-password page itself
  if (mustChangePassword && location.pathname !== ROUTES.CHANGE_PASSWORD) {
    return <Navigate to={ROUTES.CHANGE_PASSWORD} replace />;
  }

  return children;
};

export default ProtectedRoute;
