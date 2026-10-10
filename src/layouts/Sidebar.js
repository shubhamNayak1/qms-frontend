import React, { useMemo } from 'react';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Box, Divider, Avatar, Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  VerifiedUser as QmsIcon,
  Description as DmsIcon,
  School as LmsIcon,
  BarChart as ReportsIcon,
  ManageSearch as AuditIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../utils/constants';
import { useAuth } from '../store/AuthContext';

export const DRAWER_WIDTH = 240;

// moduleKey maps to the key used in moduleAccess from /auth/me
// null = always visible (Dashboard)
// Sidebar nav. moduleKey controls visibility via /auth/me's moduleAccess map.
//   - null            => always visible
//   - 'SUPER_ADMIN'   => only the SUPER_ADMIN role (handled below)
//   - permissions:[…] => visible when the user carries ANY of the listed perms
//                        (SYSTEM_OVERRIDE always sees everything).
//                        Legacy `moduleAccess` map still applies as a fallback
//                        when permissions aren't provided — keeps the sidebar
//                        working for the few screens still on the old flag.
const ADMIN_ANY_PERMS = [
  'USER_VIEW','ROLE_VIEW','PERM_VIEW','DEPT_VIEW','SITE_VIEW','LICENSE_VIEW',
  'PASSWORD_POLICY_MANAGE','TCD_POLICY_MANAGE','ORG_TREE_VIEW',
];
const navItems = [
  { label: 'Dashboard',   icon: <DashboardIcon />, path: ROUTES.DASHBOARD,  permissions: ['MOD_DASHBOARD'] },
  { label: 'QMS',         icon: <QmsIcon />,       path: ROUTES.QMS,        permissions: ['MOD_QMS'] },
  { label: 'DMS',         icon: <DmsIcon />,       path: ROUTES.DMS,        permissions: ['MOD_DMS'] },
  { label: 'LMS',         icon: <LmsIcon />,       path: ROUTES.LMS,        permissions: ['MOD_LMS'] },
  { label: 'Reports',     icon: <ReportsIcon />,   path: ROUTES.REPORTS,    permissions: ['MOD_REPORTS'] },
  { label: 'Audit Trail', icon: <AuditIcon />,     path: ROUTES.AUDIT,      permissions: ['MOD_AUDIT'] },
  // Admin visibility is any-of the admin perms so a narrowly-scoped admin
  // (e.g. only USER_VIEW) still sees the entry — individual tabs gate
  // themselves on their own permission.
  { label: 'Admin',       icon: <AdminIcon />,     path: ROUTES.ADMIN,      permissions: ADMIN_ANY_PERMS },
  // Org Tree retired 2026-10-10 — department management lives on Admin → Department.
];

const Sidebar = ({ mobileOpen, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, canAccessModule, hasAnyPermission, hasPermission } = useAuth();

  const visibleItems = useMemo(
    () => navItems.filter(({ permissions, moduleKey }) => {
      // Phase-2: permission-based visibility is primary.
      if (Array.isArray(permissions) && permissions.length > 0) {
        if (hasAnyPermission(permissions)) return true;
        // Legacy fallback — if the user's /auth/me didn't ship a permission
        // list yet (old deployment, mid-rollout), fall back to the old
        // moduleAccess flag so nothing disappears from the sidebar.
        if (!user?.permissions || user.permissions.length === 0) {
          return canAccessModule(permissions[0].replace(/^MOD_/, ''));
        }
        return false;
      }
      // Historical null/role-name shape — kept so legacy items (if any)
      // keep working during the rollout window.
      if (moduleKey === null)          return true;
      if (moduleKey === 'SUPER_ADMIN') return hasPermission('SYSTEM_OVERRIDE');
      return canAccessModule(moduleKey);
    }),
    [canAccessModule, hasAnyPermission, hasPermission, user?.permissions]
  );

  const roleName = Array.isArray(user?.roles) ? user.roles[0] : (user?.role || 'USER');

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 16, fontWeight: 700 }}>Q</Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>EnterpriseQMS</Typography>
            <Typography variant="caption" color="text.secondary" lineHeight={1}>v1.0.0</Typography>
          </Box>
        </Box>
      </Toolbar>

      <List sx={{ flex: 1, px: 1.5, pt: 1.5 }}>
        {visibleItems.map(({ label, icon, path }) => {
          const active = location.pathname === path || location.pathname.startsWith(path + '/');
          return (
            <ListItem key={path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(path); onMobileClose?.(); }}
                selected={active}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '& .MuiListItemIcon-root': { color: 'white' },
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
                <ListItemText primary={label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main', fontSize: 14 }}>
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </Avatar>
        <Box sx={{ overflow: 'hidden', flex: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>{user?.name || 'User'}</Typography>
          <Chip label={roleName} size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: 10, mt: 0.3 }} />
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        {content}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' } }}
        open
      >
        {content}
      </Drawer>
    </>
  );
};

export default React.memo(Sidebar);
