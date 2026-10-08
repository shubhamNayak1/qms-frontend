import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import ModuleRoute from './ModuleRoute';
import MainLayout from '../layouts/MainLayout';
import Loader from '../components/Loader';
import { ROUTES } from '../utils/constants';

const WelcomePage = lazy(() => import('../pages/auth/WelcomePage'));
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const ChangePasswordPage = lazy(() => import('../pages/auth/ChangePasswordPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const UsersPage = lazy(() => import('../pages/users/UsersPage'));
const OrgTreePage = lazy(() => import('../pages/org/OrgTreePage'));
const DepartmentsPage = lazy(() => import('../pages/org/DepartmentsPage'));
const SiteProfilePage = lazy(() => import('../pages/org/SiteProfilePage'));
const LicensesPage = lazy(() => import('../pages/licenses/LicensesPage'));
const QmsPage = lazy(() => import('../pages/qms/QmsPage'));
const DmsPage = lazy(() => import('../pages/dms/DmsPage'));
const LmsPage = lazy(() => import('../pages/lms/LmsPage'));
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage'));
const AuditPage = lazy(() => import('../pages/audit/AuditPage'));

const AppRoutes = () => (
  <Suspense fallback={<Loader />}>
    <Routes>
      {/* 2026-10-08 — root splash at /. Click-anywhere → /login. */}
      <Route path={ROUTES.WELCOME} element={<WelcomePage />} />
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.CHANGE_PASSWORD} element={
        <ProtectedRoute><ChangePasswordPage /></ProtectedRoute>
      } />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* 2026-10-08 — the index "/" route is NOT nested here any more.
            The site root is the public WelcomePage; a logged-in user hitting
            "/" is bounced to /dashboard from inside WelcomePage via a
            useEffect. Keeping an <Route index> inside this protected group
            caused React Router v6 to pick it over the public "/" and send
            every anonymous visitor straight to /login. */}
        <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
        <Route path={ROUTES.USERS}   element={<ModuleRoute moduleKey="USER">  <UsersPage />   </ModuleRoute>} />
        <Route path={ROUTES.ORG} element={<Navigate to={ROUTES.ORG_TREE} replace />} />
        <Route path={ROUTES.ORG_TREE}        element={<OrgTreePage />} />
        <Route path={ROUTES.ORG_DEPARTMENTS} element={<DepartmentsPage />} />
        <Route path={ROUTES.ORG_SITE}        element={<SiteProfilePage />} />
        <Route path={ROUTES.LICENSES}        element={<LicensesPage />} />
        <Route path={`${ROUTES.QMS}/*`} element={<ModuleRoute moduleKey="QMS"><QmsPage /></ModuleRoute>} />
        <Route path={ROUTES.DMS}    element={<ModuleRoute moduleKey="DMS">   <DmsPage />     </ModuleRoute>} />
        <Route path={`${ROUTES.LMS}/*`} element={<ModuleRoute moduleKey="LMS"><LmsPage /></ModuleRoute>} />
        <Route path={ROUTES.REPORTS} element={<ModuleRoute moduleKey="REPORT"><ReportsPage /> </ModuleRoute>} />
        <Route path={ROUTES.AUDIT}  element={<ModuleRoute moduleKey="AUDIT"> <AuditPage />   </ModuleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;
