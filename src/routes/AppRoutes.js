import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import ModuleRoute from './ModuleRoute';
import MainLayout from '../layouts/MainLayout';
import Loader from '../components/Loader';
import { ROUTES } from '../utils/constants';

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const UsersPage = lazy(() => import('../pages/users/UsersPage'));
const QmsPage = lazy(() => import('../pages/qms/QmsPage'));
const DmsPage = lazy(() => import('../pages/dms/DmsPage'));
const LmsPage = lazy(() => import('../pages/lms/LmsPage'));
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage'));
const AuditPage = lazy(() => import('../pages/audit/AuditPage'));

const AppRoutes = () => (
  <Suspense fallback={<Loader />}>
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
        <Route path={ROUTES.USERS}   element={<ModuleRoute moduleKey="USER">  <UsersPage />   </ModuleRoute>} />
        <Route path={ROUTES.QMS}    element={<ModuleRoute moduleKey="QMS">   <QmsPage />     </ModuleRoute>} />
        <Route path={ROUTES.DMS}    element={<ModuleRoute moduleKey="DMS">   <DmsPage />     </ModuleRoute>} />
        <Route path={ROUTES.LMS}    element={<ModuleRoute moduleKey="LMS">   <LmsPage />     </ModuleRoute>} />
        <Route path={ROUTES.REPORTS} element={<ModuleRoute moduleKey="REPORT"><ReportsPage /> </ModuleRoute>} />
        <Route path={ROUTES.AUDIT}  element={<ModuleRoute moduleKey="AUDIT"> <AuditPage />   </ModuleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;
