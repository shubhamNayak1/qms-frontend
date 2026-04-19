import React from 'react';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Box, Divider, Avatar, Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  VerifiedUser as QmsIcon,
  Description as DmsIcon,
  School as LmsIcon,
  BarChart as ReportsIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../utils/constants';
import { useAuth } from '../store/AuthContext';

export const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: ROUTES.DASHBOARD },
  { label: 'Users', icon: <PeopleIcon />, path: ROUTES.USERS },
  { label: 'QMS', icon: <QmsIcon />, path: ROUTES.QMS },
  { label: 'DMS', icon: <DmsIcon />, path: ROUTES.DMS },
  { label: 'LMS', icon: <LmsIcon />, path: ROUTES.LMS },
  { label: 'Reports', icon: <ReportsIcon />, path: ROUTES.REPORTS },
];

const Sidebar = ({ mobileOpen, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

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
        {navItems.map(({ label, icon, path }) => {
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
          <Typography variant="body2" fontWeight={600} noWrap>{user?.name || 'Admin User'}</Typography>
          <Chip label={user?.role || 'ADMIN'} size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: 10, mt: 0.3 }} />
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        {content}
      </Drawer>
      {/* Permanent drawer */}
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

export default Sidebar;
