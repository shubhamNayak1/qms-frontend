import React from 'react';
import {
  Drawer, Box, Typography, Avatar, Divider, Chip, IconButton,
  List, ListItem, ListItemText, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as DepartmentIcon,
  Badge as BadgeIcon,
  Work as DesignationIcon,
  AccountCircle as UsernameIcon,
  AccessTime as LastLoginIcon,
  VerifiedUser as RoleIcon,
  FiberManualRecord as StatusDotIcon,
} from '@mui/icons-material';
import { useAuth } from '../store/AuthContext';

const DRAWER_WIDTH = 340;

// Format ISO date to a readable string
const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const InfoRow = ({ icon, label, value }) => (
  <ListItem disableGutters sx={{ py: 0.8, alignItems: 'flex-start' }}>
    <Box sx={{ color: 'text.disabled', mt: 0.2, mr: 1.5, flexShrink: 0 }}>{icon}</Box>
    <ListItemText
      primary={
        <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>
          {label}
        </Typography>
      }
      secondary={
        <Typography variant="body2" fontWeight={500} color="text.primary" sx={{ mt: 0.2 }}>
          {value || '—'}
        </Typography>
      }
      disableTypography
    />
  </ListItem>
);

const ProfileDrawer = ({ open, onClose }) => {
  const { user } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const roleList = Array.isArray(user?.roles) ? user.roles : [];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          My Profile
        </Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Avatar + name block */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 3,
          px: 2,
          bgcolor: 'primary.main',
          color: 'white',
        }}
      >
        <Avatar
          src={user?.profilePictureUrl || undefined}
          sx={{
            width: 72,
            height: 72,
            fontSize: 26,
            fontWeight: 700,
            bgcolor: 'primary.dark',
            mb: 1.5,
          }}
        >
          {!user?.profilePictureUrl && initials}
        </Avatar>

        <Typography variant="h6" fontWeight={700} textAlign="center" lineHeight={1.3}>
          {user?.name || 'User'}
        </Typography>
        {user?.designation && (
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.3 }}>
            {user.designation}
          </Typography>
        )}

        {/* Active status badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <StatusDotIcon
            sx={{
              fontSize: 10,
              color: user?.isActive ? '#69f0ae' : '#ff5252',
            }}
          />
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {user?.isActive ? 'Active' : 'Inactive'}
          </Typography>
        </Box>
      </Box>

      {/* Role chips */}
      {roleList.length > 0 && (
        <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
            Roles
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
            {roleList.map((r) => (
              <Chip
                key={r}
                icon={<RoleIcon sx={{ fontSize: '14px !important' }} />}
                label={r.replace(/_/g, ' ')}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontSize: 11 }}
              />
            ))}
          </Box>
        </Box>
      )}

      <Divider sx={{ mx: 2, mt: 1 }} />

      {/* Details list */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
          Account Info
        </Typography>
        <List disablePadding sx={{ mt: 0.5 }}>
          <InfoRow
            icon={<UsernameIcon sx={{ fontSize: 18 }} />}
            label="Username"
            value={user?.username}
          />
          <InfoRow
            icon={<EmailIcon sx={{ fontSize: 18 }} />}
            label="Email"
            value={user?.email}
          />
          <InfoRow
            icon={<PhoneIcon sx={{ fontSize: 18 }} />}
            label="Phone"
            value={user?.phone}
          />
        </List>

        <Divider sx={{ my: 1.5 }} />

        <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
          Work Details
        </Typography>
        <List disablePadding sx={{ mt: 0.5 }}>
          <InfoRow
            icon={<DepartmentIcon sx={{ fontSize: 18 }} />}
            label="Department"
            value={user?.department}
          />
          <InfoRow
            icon={<DesignationIcon sx={{ fontSize: 18 }} />}
            label="Designation"
            value={user?.designation}
          />
          <InfoRow
            icon={<BadgeIcon sx={{ fontSize: 18 }} />}
            label="Employee ID"
            value={user?.employeeId}
          />
        </List>

        <Divider sx={{ my: 1.5 }} />

        <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
          Activity
        </Typography>
        <List disablePadding sx={{ mt: 0.5 }}>
          <InfoRow
            icon={<LastLoginIcon sx={{ fontSize: 18 }} />}
            label="Last Login"
            value={formatDate(user?.lastLoginAt)}
          />
        </List>
      </Box>
    </Drawer>
  );
};

export default ProfileDrawer;
