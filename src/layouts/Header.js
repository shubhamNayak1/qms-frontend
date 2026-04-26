import React, { useState } from 'react';
import {
  AppBar, Toolbar, IconButton, Typography, Box, Avatar,
  Menu, MenuItem, ListItemIcon, Divider, Badge, Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DRAWER_WIDTH } from './Sidebar';
import { useAuth } from '../store/AuthContext';
import { ROUTES } from '../utils/constants';
import ProfileDrawer from '../components/ProfileDrawer';

const Header = ({ onMobileMenuToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate(ROUTES.LOGIN);
  };

  const handleProfileOpen = () => {
    setAnchorEl(null);   // close the dropdown first
    setProfileOpen(true);
  };

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={onMobileMenuToggle} sx={{ mr: 1, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600, fontSize: 16 }}>
            Enterprise Quality Management System
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Notifications">
              <IconButton>
                <Badge badgeContent={3} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title={user?.name || 'Account'}>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 0.5 }}>
                <Avatar
                  src={user?.profilePictureUrl || undefined}
                  sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}
                >
                  {!user?.profilePictureUrl && initials}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>

          {/* Dropdown menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{ sx: { minWidth: 200, mt: 1 } }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" fontWeight={600} noWrap>
                {user?.name || 'Admin User'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {user?.email || ''}
              </Typography>
              {user?.designation && (
                <Typography variant="caption" color="primary.main" noWrap display="block" sx={{ mt: 0.2 }}>
                  {user.designation}
                </Typography>
              )}
            </Box>
            <Divider />
            <MenuItem onClick={handleProfileOpen}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              View Profile
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
              <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Profile side panel */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
};

export default Header;
