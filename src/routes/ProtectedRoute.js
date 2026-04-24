import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { ROUTES } from '../utils/constants';
import Loader from '../components/Loader';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, bootstrapping } = useAuth();
  const location = useLocation();

  if (loading || bootstrapping) return <Loader />;

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
