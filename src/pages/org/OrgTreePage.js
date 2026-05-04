import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Avatar, Chip, IconButton, Collapse, Tooltip,
  Stack, Divider, Button, Skeleton,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ChevronRight as CollapseIcon,
  Refresh as RefreshIcon,
  AccountCircle as UserIcon,
  CheckCircle as LicenseIcon,
  Cancel as NoLicenseIcon,
  Edit as EditIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import ErrorAlert from '../../components/ErrorAlert';
import { getOrgTreeApi } from '../../api/orgApi';
import { ROUTES } from '../../utils/constants';

// ── Visual constants ────────────────────────────────────────
const TYPE_COLOR = {
  QA:       'success',
  RA:       'warning',
  STANDARD: 'default',
};

// ── User chip ────────────────────────────────────────────────
const UserChip = ({ user, isHod }) => {
  if (!user) return null;
  const initials = user.initials || (user.fullName || user.username || '?').slice(0, 2).toUpperCase();
  const license = user.hasActiveLicense
    ? <Tooltip title="Has active license"><LicenseIcon sx={{ fontSize: 14, color: 'success.main' }} /></Tooltip>
    : <Tooltip title="No active license"><NoLicenseIcon sx={{ fontSize: 14, color: 'error.light' }} /></Tooltip>;

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      px: 1, py: 0.6, mb: 0.5,
      bgcolor: isHod ? 'primary.50' : 'background.paper',
      border: '1px solid', borderColor: isHod ? 'primary.light' : 'divider',
      borderRadius: 1.5,
    }}>
      <Avatar sx={{
        width: 28, height: 28, fontSize: 12, fontWeight: 700,
        bgcolor: isHod ? 'primary.main' : 'grey.300',
        color: isHod ? 'white' : 'text.primary',
      }}>
        {initials}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={isHod ? 700 : 500} noWrap>
          {user.fullName || user.username}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {user.designation || (isHod ? 'Head of Department' : 'Member')}
        </Typography>
      </Box>
      <Stack direction="row" spacing={0.4} alignItems="center">
        {user.isQaReviewer    && <Chip size="small" label="QA Reviewer"  color="success"  sx={{ height: 18, fontSize: 10 }} />}
        {user.isDeptReviewer  && <Chip size="small" label="Dept Reviewer" color="info"     sx={{ height: 18, fontSize: 10 }} />}
        {license}
      </Stack>
    </Box>
  );
};

// ── Recursive department node ───────────────────────────────
const DeptNode = ({ dept, depth = 0 }) => {
  const [open, setOpen] = useState(depth < 1);
  const [showMembers, setShowMembers] = useState(false);

  const hasSubs = (dept.subDepartments?.length || 0) > 0;
  const memberCount = (dept.members?.length || 0) + (dept.hod ? 1 : 0);

  return (
    <Box sx={{ ml: depth === 0 ? 0 : 2.5, mt: 1 }}>
      <Paper
        variant="outlined"
        sx={{
          borderLeft: '4px solid',
          borderLeftColor: dept.deptType === 'QA'  ? 'success.main'
                         : dept.deptType === 'RA'  ? 'warning.main'
                         : 'grey.400',
          px: 2, py: 1.2, borderRadius: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {hasSubs && (
            <IconButton size="small" onClick={() => setOpen(o => !o)}>
              {open ? <ExpandIcon fontSize="small" /> : <CollapseIcon fontSize="small" />}
            </IconButton>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {dept.name}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                ({dept.code})
              </Typography>
            </Typography>
          </Box>
          <Chip
            size="small"
            label={dept.deptType}
            color={TYPE_COLOR[dept.deptType] || 'default'}
            variant={dept.deptType === 'STANDARD' ? 'outlined' : 'filled'}
          />
          <Chip
            size="small"
            label={`${dept.totalMemberCount ?? memberCount} member${(dept.totalMemberCount ?? memberCount) === 1 ? '' : 's'}`}
            variant="outlined"
            onClick={() => setShowMembers(s => !s)}
            sx={{ cursor: 'pointer' }}
          />
        </Box>

        {/* HOD always visible */}
        {dept.hod && (
          <Box sx={{ mt: 1 }}>
            <UserChip user={dept.hod} isHod />
          </Box>
        )}

        {/* Members fold */}
        <Collapse in={showMembers} unmountOnExit>
          <Box sx={{ mt: 1 }}>
            {dept.members?.length ? dept.members.map(m => (
              <UserChip key={m.id} user={m} />
            )) : (
              <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                No members.
              </Typography>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Sub-departments */}
      <Collapse in={open} unmountOnExit>
        {dept.subDepartments?.map(sub => (
          <DeptNode key={sub.id} dept={sub} depth={depth + 1} />
        ))}
      </Collapse>
    </Box>
  );
};

// ── Page ────────────────────────────────────────────────────
const OrgTreePage = () => {
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState(null);

  const fetchTree = useCallback(async () => {
    setLoad(true);
    setError(null);
    try {
      const { data: resp } = await getOrgTreeApi();
      setData(resp?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load organisation tree.');
    } finally {
      setLoad(false);
    }
  }, []);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const site = data?.site;

  return (
    <Box>
      <PageHeader
        title="Organisation"
        subtitle="Top-down view of the company. Site → Departments → Sub-Departments → Members."
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'Organisation' }]}
        action={
          <Stack direction="row" spacing={1}>
            <Button startIcon={<EditIcon />} variant="outlined" onClick={() => navigate(ROUTES.ORG_DEPARTMENTS)}>
              Manage Departments
            </Button>
            <Button startIcon={<PlaceIcon />} variant="outlined" onClick={() => navigate(ROUTES.ORG_SITE)}>
              Site Profile
            </Button>
            <Tooltip title="Refresh"><IconButton onClick={fetchTree}><RefreshIcon /></IconButton></Tooltip>
          </Stack>
        }
      />

      {error && <ErrorAlert message={error} onRetry={fetchTree} />}

      {loading && !site && (
        <Stack spacing={1}>
          {[1,2,3].map(i => <Skeleton key={i} height={70} variant="rounded" />)}
        </Stack>
      )}

      {site && (
        <>
          {/* Site card */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: 2,
              bgcolor: 'primary.50',
              display: 'flex', alignItems: 'center', gap: 2,
            }}
          >
            <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, fontSize: 22, fontWeight: 700 }}>
              {site.name?.[0] || 'S'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700} noWrap>
                {site.name}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  ({site.code || '—'})
                </Typography>
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {site.address || 'Address not set'}
              </Typography>
            </Box>
            {site.head ? (
              <Box sx={{ minWidth: 240 }}>
                <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
                  Site Head
                </Typography>
                <UserChip user={site.head} isHod />
              </Box>
            ) : (
              <Chip label="No Site Head set" color="warning" variant="outlined" icon={<UserIcon />} />
            )}
          </Paper>

          <Divider sx={{ my: 2 }} />

          {/* Top-level departments */}
          {site.departments?.length ? site.departments.map(dept => (
            <DeptNode key={dept.id} dept={dept} />
          )) : (
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              No departments configured yet. Click <strong>Manage Departments</strong> to add one.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};

export default OrgTreePage;
