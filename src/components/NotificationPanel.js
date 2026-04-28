import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Box, Typography, IconButton, Tooltip, Divider,
  Chip, Stack, CircularProgress, Alert, List, ListItem,
  ListItemText, Button,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ErrorOutline as CriticalIcon,
  WarningAmber as WarningIcon,
  InfoOutlined as InfoIcon,
  OpenInNew as LinkIcon,
  NotificationsNone as EmptyIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getNotificationsApi } from '../api/notificationApi';
import { formatDate } from '../utils/helpers';
import { ROUTES } from '../utils/constants';

// All registered SPA routes (including /qms/capa, /qms/deviation, etc.)
// Sorted longest-first so more specific paths match before shorter parents.
const KNOWN_ROUTES = Object.values(ROUTES).sort((a, b) => b.length - a.length);

// ── Severity config ───────────────────────────────────────────────────────────
const SEV = {
  CRITICAL: { color: 'error',   border: '#ef5350', icon: <CriticalIcon fontSize="small" />, muiColor: '#ef5350' },
  WARNING:  { color: 'warning', border: '#ffa726', icon: <WarningIcon fontSize="small" />,  muiColor: '#ffa726' },
  INFO:     { color: 'info',    border: '#42a5f5', icon: <InfoIcon fontSize="small" />,     muiColor: '#42a5f5' },
};

const sevCfg = (sev) => SEV[sev] || SEV.INFO;

// ── Category colour map ───────────────────────────────────────────────────────
const CAT_COLOR = { QMS: 'secondary', LMS: 'primary', DMS: 'info', SYSTEM: 'warning', default: 'default' };
const catColor  = (cat) => CAT_COLOR[cat] || CAT_COLOR.default;

// ── Single notification item ──────────────────────────────────────────────────
const NotifItem = ({ n, onNavigate }) => {
  const cfg = sevCfg(n.severity);
  return (
    <ListItem
      disableGutters
      sx={{
        alignItems: 'flex-start',
        borderLeft: `4px solid ${cfg.border}`,
        bgcolor: n.overdue ? 'rgba(239,83,80,0.04)' : 'transparent',
        px: 1.5,
        py: 1.2,
        mb: 0.5,
        borderRadius: '0 6px 6px 0',
        transition: 'background 0.15s',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {/* Severity icon */}
      <Box sx={{ color: cfg.muiColor, mt: 0.2, mr: 1.25, flexShrink: 0 }}>{cfg.icon}</Box>

      <ListItemText
        disableTypography
        primary={
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" fontWeight={700} lineHeight={1.3} sx={{ flex: 1 }}>
              {n.title}
            </Typography>
            {n.link && (
              <Tooltip title="View record">
                <IconButton size="small" onClick={() => onNavigate(n.link)} sx={{ mt: -0.25 }}>
                  <LinkIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        }
        secondary={
          <Box sx={{ mt: 0.4 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75, lineHeight: 1.4 }}>
              {n.message}
            </Typography>

            {/* Meta chips */}
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
              {n.recordNumber && (
                <Chip label={n.recordNumber} size="small" variant="outlined"
                  sx={{ fontSize: 10, height: 18, fontFamily: 'monospace' }} />
              )}
              {n.category && (
                <Chip label={n.category} size="small" color={catColor(n.category)}
                  sx={{ fontSize: 10, height: 18 }} />
              )}
              {n.module && n.module !== n.category && (
                <Chip label={n.module} size="small" variant="outlined"
                  sx={{ fontSize: 10, height: 18 }} />
              )}
              {n.status && (
                <Chip label={n.status.replace(/_/g, ' ')} size="small" variant="outlined"
                  sx={{ fontSize: 10, height: 18 }} />
              )}
            </Stack>

            {/* Due date */}
            {n.dueDate && (
              <Typography variant="caption" color={n.overdue ? 'error.main' : 'text.secondary'} fontWeight={n.overdue ? 700 : 400}>
                {n.overdue ? '⚠ Overdue · ' : 'Due: '}
                {formatDate(n.dueDate)}
              </Typography>
            )}

            {/* Action required */}
            {n.actionRequired && (
              <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.25, fontStyle: 'italic' }}>
                {n.actionRequired}
              </Typography>
            )}
          </Box>
        }
      />
    </ListItem>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────
const NotificationPanel = ({ open, onClose }) => {
  const navigate = useNavigate();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Active filter: 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO' | category key
  const [filter, setFilter] = useState('ALL');

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    getNotificationsApi()
      .then(({ data: res }) => setData(res?.data || res))
      .catch(() => setError('Failed to load notifications.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) { fetchData(); setFilter('ALL'); }
  }, [open, fetchData]);

  const handleNavigate = (link) => {
    if (!link) return;
    onClose();

    // Resolve a path to the closest known SPA route.
    // e.g. "/qms/capa"              → "/qms/capa"   (exact match)
    // e.g. "/qms/capa/CAP-2025-001" → "/qms/capa"   (walks up)
    // e.g. "/qms/records/123"       → "/qms"         (falls back to parent)
    const resolveRoute = (pathname) => {
      if (KNOWN_ROUTES.includes(pathname)) return pathname;
      // Walk up segments until we find a match
      const segments = pathname.replace(/\/$/, '').split('/'); // ['', 'qms', 'records', '123']
      for (let i = segments.length - 1; i >= 1; i--) {
        const candidate = segments.slice(0, i).join('/') || '/';
        if (KNOWN_ROUTES.includes(candidate)) return candidate;
      }
      return ROUTES.DASHBOARD; // final fallback
    };

    const doNavigate = (pathname, search = '', hash = '') => {
      const route = resolveRoute(pathname);
      setTimeout(() => navigate(route + search + hash), 150);
    };

    try {
      const url = new URL(link);                         // throws for relative paths
      if (url.origin === window.location.origin) {
        doNavigate(url.pathname, url.search, url.hash);
      } else {
        window.location.href = link;                     // truly external
      }
    } catch {
      // Relative path like "/qms/records/123" or "/qms"
      const [pathname, ...rest] = link.split('?');
      const search = rest.length ? '?' + rest.join('?') : '';
      doNavigate(pathname, search);
    }
  };

  // Filtered notifications
  const all   = data?.notifications || [];
  const shown = filter === 'ALL'
    ? all
    : SEV[filter]
      ? all.filter((n) => n.severity === filter)
      : all.filter((n) => n.category === filter);

  const cats = data?.countByCategory ? Object.keys(data.countByCategory) : [];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, display: 'flex', flexDirection: 'column' } }}
    >
      {/* ── Header ── */}
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>Notifications</Typography>
            {data && (
              <Chip label={data.totalCount} size="small" color="primary" sx={{ fontWeight: 700, height: 20 }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={fetchData} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Severity summary */}
        {data && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<CriticalIcon />}
              label={`${data.criticalCount} Critical`}
              size="small"
              color={data.criticalCount > 0 ? 'error' : 'default'}
              variant={filter === 'CRITICAL' ? 'filled' : 'outlined'}
              onClick={() => setFilter(filter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
              sx={{ cursor: 'pointer', fontWeight: 600 }}
            />
            <Chip
              icon={<WarningIcon />}
              label={`${data.warningCount} Warning`}
              size="small"
              color={data.warningCount > 0 ? 'warning' : 'default'}
              variant={filter === 'WARNING' ? 'filled' : 'outlined'}
              onClick={() => setFilter(filter === 'WARNING' ? 'ALL' : 'WARNING')}
              sx={{ cursor: 'pointer', fontWeight: 600 }}
            />
            <Chip
              icon={<InfoIcon />}
              label={`${data.infoCount} Info`}
              size="small"
              color="info"
              variant={filter === 'INFO' ? 'filled' : 'outlined'}
              onClick={() => setFilter(filter === 'INFO' ? 'ALL' : 'INFO')}
              sx={{ cursor: 'pointer', fontWeight: 600 }}
            />
          </Stack>
        )}

        {/* Category filter */}
        {cats.length > 0 && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {cats.map((cat) => (
              <Chip
                key={cat}
                label={`${cat} ${data.countByCategory[cat]}`}
                size="small"
                color={catColor(cat)}
                variant={filter === cat ? 'filled' : 'outlined'}
                onClick={() => setFilter(filter === cat ? 'ALL' : cat)}
                sx={{ cursor: 'pointer', fontSize: 11 }}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* ── Body ── */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>}

        {!loading && !error && shown.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, color: 'text.disabled' }}>
            <EmptyIcon sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body2">No notifications{filter !== 'ALL' ? ' for this filter' : ''}</Typography>
          </Box>
        )}

        {!loading && shown.length > 0 && (
          <>
            {filter !== 'ALL' && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Showing {shown.length} of {all.length}
                </Typography>
                <Button size="small" onClick={() => setFilter('ALL')} sx={{ fontSize: 11 }}>
                  Show all
                </Button>
              </Box>
            )}
            <List disablePadding>
              {shown.map((n) => (
                <React.Fragment key={n.id}>
                  <NotifItem n={n} onNavigate={handleNavigate} />
                  <Divider sx={{ mx: 1.5, opacity: 0.5 }} />
                </React.Fragment>
              ))}
            </List>
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default NotificationPanel;
