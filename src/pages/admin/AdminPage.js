import React, { lazy, Suspense, useMemo } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import {
  Box, Paper, Tab, Tabs, Chip, Typography,
} from '@mui/material';
import {
  Business as DeptIcon,
  Policy as PolicyIcon,
  SupervisorAccount as RoleIcon,
  PeopleAlt as UserIcon,
  Shield as PermIcon,
  CardMembership as LicenceIcon,
  LocationCity as SiteIcon,
} from '@mui/icons-material';
import { useAuth } from '../../store/AuthContext';
import { ROUTES } from '../../utils/constants';
import Loader from '../../components/Loader';

/*
 * AdminPage — Phase 1 of the Admin module consolidation.
 *
 * Collapses the three previously-separate top-level menus (Users,
 * Organisation, Licenses) into one /admin page with seven tabs:
 *
 *   Department · Policy · Role · User · Permission · Licence · Site
 *
 * Phase 1 (this file): the Department, User, Licence and Site tabs
 * render the existing feature pages inside the tab shell. The Policy
 * tab exposes the existing Password Policy editor plus a "TCD Policy"
 * placeholder (lands in P1.3). The Role tab is read-only ("Create /
 * Edit coming in Phase 2") and the Permission tab is a Phase-2
 * placeholder with a matrix mock-up explainer.
 *
 * Phase 2 (planned ~1-2 weeks out):
 *   • Flyway + Catalogue of ~80 permissions.
 *   • Refactor 243 @PreAuthorize checks from hasAnyRole(...) to
 *     hasAuthority('perm.name').
 *   • New user_permissions table (grant / revoke overrides on top of
 *     role perms).
 *   • Create/Edit/Disable Role UI.
 *   • Permission matrix UI (Role × Perm + User × Perm).
 *
 * Access: SUPER_ADMIN or the new ADMIN role.
 */

// Lazy-load each tab body so the Admin bundle stays small.
const DepartmentsPage = lazy(() => import('../org/DepartmentsPage'));
const UsersPage       = lazy(() => import('../users/UsersPage'));
const LicensesPage    = lazy(() => import('../licenses/LicensesPage'));
const SiteProfilePage = lazy(() => import('../org/SiteProfilePage'));
const AdminPolicyTab  = lazy(() => import('./AdminPolicyTab'));
const AdminRoleTab    = lazy(() => import('./AdminRoleTab'));
const AdminPermissionTab = lazy(() => import('./AdminPermissionTab'));

// Each tab's `perms` array is "any-of" — matches hasAnyPermission.
// SYSTEM_OVERRIDE bypasses every tab gate (handled inside hasPermission).
const TABS = [
  { key: 'department', label: 'Department', icon: <DeptIcon fontSize="small" />,    perms: ['DEPT_VIEW','DEPT_MANAGE'],                                 Component: DepartmentsPage },
  { key: 'policy',     label: 'Policy',     icon: <PolicyIcon fontSize="small" />,  perms: ['PASSWORD_POLICY_MANAGE','TCD_POLICY_MANAGE'],              Component: AdminPolicyTab },
  { key: 'role',       label: 'Role',       icon: <RoleIcon fontSize="small" />,    perms: ['ROLE_VIEW','ROLE_MANAGE'],                                 Component: AdminRoleTab },
  { key: 'user',       label: 'User',       icon: <UserIcon fontSize="small" />,    perms: ['USER_VIEW','USER_CREATE','USER_UPDATE','USER_DELETE'],     Component: UsersPage },
  { key: 'permission', label: 'Permission', icon: <PermIcon fontSize="small" />,    perms: ['PERM_VIEW','PERM_MANAGE'],                                 Component: AdminPermissionTab },
  { key: 'licence',    label: 'Licence',    icon: <LicenceIcon fontSize="small" />, perms: ['LICENSE_VIEW','LICENSE_MANAGE','LICENSE_ASSIGN'],          Component: LicensesPage },
  { key: 'site',       label: 'Site',       icon: <SiteIcon fontSize="small" />,    perms: ['SITE_VIEW','SITE_MANAGE'],                                 Component: SiteProfilePage },
];

const AdminPage = () => {
  const { bootstrapping, hasAnyPermission, hasRole, isSuperAdmin } = useAuth();
  const [params, setParams] = useSearchParams();

  // Permission-based gating. Phase-2: visible tabs are those the user
  // carries any permission for. Legacy fallback — SUPER_ADMIN/ADMIN
  // role names still work during the rollout window before every user's
  // JWT is re-issued.
  const visibleTabs = useMemo(
    () => TABS.filter((t) =>
      hasAnyPermission(t.perms) || isSuperAdmin || hasRole('ADMIN')
    ),
    [hasAnyPermission, isSuperAdmin, hasRole]
  );
  const allowed = visibleTabs.length > 0;

  const activeKey = useMemo(() => {
    const q = params.get('tab');
    if (visibleTabs.some((t) => t.key === q)) return q;
    return visibleTabs[0]?.key || 'department';
  }, [params, visibleTabs]);

  if (bootstrapping) return <Loader />;
  if (!allowed)      return <Navigate to={ROUTES.DASHBOARD} replace />;

  const handleChange = (_e, next) => {
    const sp = new URLSearchParams(params);
    sp.set('tab', next);
    setParams(sp, { replace: true });
  };

  const active = visibleTabs.find((t) => t.key === activeKey);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h5" fontWeight={700}>Admin</Typography>
          <Chip label="Phase 2 live" size="small" variant="outlined" color="success" />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Departments · policies · roles · users · permissions · licence · site
        </Typography>
      </Box>

      <Paper square elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeKey}
          onChange={handleChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2 }}
        >
          {visibleTabs.map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={t.label}
              icon={t.icon}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none', fontWeight: 500 }}
            />
          ))}
        </Tabs>
      </Paper>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Suspense fallback={<Loader />}>
          {active && <active.Component />}
        </Suspense>
      </Box>
    </Box>
  );
};

export default AdminPage;
