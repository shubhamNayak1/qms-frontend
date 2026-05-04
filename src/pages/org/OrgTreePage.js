import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Avatar, Chip, IconButton, Tooltip,
  Stack, Button, Skeleton, TextField, InputAdornment, Switch, FormControlLabel,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ChevronRight as CollapseIcon,
  Refresh as RefreshIcon,
  CheckCircle as LicenseIcon,
  Cancel as NoLicenseIcon,
  Edit as EditIcon,
  Place as PlaceIcon,
  Search as SearchIcon,
  Star as HodIcon,
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

const roleHint = (role) =>
  role === 'SITE_HEAD' ? 'Site Head'
  : role === 'HOD'     ? 'Head of Department'
  : 'Member';

const initialsOf = (user) =>
  (user.initials || (user.fullName || user.username || '?').slice(0, 2)).toUpperCase();

// ── Single employee row ─────────────────────────────────────
//
// Shows one person with their department tag, designation and role badges.
// Indented by `depth` so the visual hierarchy reflects the reporting line:
//   Site Head (0) → HOD (1) → Member or Sub-HOD (2) → Sub-member (3) → …
const EmployeeRow = ({ user, dept, role, depth, hasChildren, expanded, onToggle, isLastChild }) => {
  if (!user) return null;
  const isHod = role === 'HOD' || role === 'SITE_HEAD';

  return (
    <Box sx={{
      position: 'relative',
      pl: `${depth * 28}px`,    // indent per level
      mb: 0.6,
    }}>
      {/* Connector — horizontal stub from the parent's vertical line.
          Skipped for the root (depth 0). */}
      {depth > 0 && (
        <Box sx={{
            position: 'absolute',
            left: `${(depth - 1) * 28 + 12}px`,
            top: 18, width: 14, height: 2,
            bgcolor: 'divider',
          }} />
      )}
      {/* Vertical line that runs through this node's level — drawn so children
          can hang off it. Hidden on the last child of its parent below the row
          to keep the visual tree tight. */}
      {depth > 0 && !isLastChild && (
        <Box sx={{
            position: 'absolute',
            left: `${(depth - 1) * 28 + 12}px`,
            top: 0, bottom: -10, width: 2,
            bgcolor: 'divider',
          }} />
      )}

      <Paper
        variant="outlined"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.2,
          px: 1.4, py: 1, borderRadius: 1.5,
          borderLeft: '4px solid',
          borderLeftColor: dept
            ? (dept.deptType === 'QA'  ? 'success.main'
              : dept.deptType === 'RA'  ? 'warning.main'
              : 'grey.400')
            : 'primary.main',
          bgcolor: isHod ? 'primary.50' : 'background.paper',
        }}
      >
        {/* Expand/Collapse arrow — only for nodes with descendants */}
        {hasChildren ? (
          <IconButton size="small" onClick={onToggle} sx={{ p: 0.4 }}>
            {expanded ? <ExpandIcon fontSize="inherit" /> : <CollapseIcon fontSize="inherit" />}
          </IconButton>
        ) : (
          <Box sx={{ width: 28 }} />
        )}

        {/* Avatar */}
        <Avatar sx={{
            width: 36, height: 36, fontSize: 13, fontWeight: 700,
            bgcolor: isHod ? 'primary.main' : 'grey.300',
            color:   isHod ? 'white'        : 'text.primary',
          }}>
          {initialsOf(user)}
        </Avatar>

        {/* Identity */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.6} sx={{ flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={isHod ? 700 : 500} noWrap>
              {user.fullName || user.username}
            </Typography>
            {isHod && (
              <Chip size="small"
                    icon={<HodIcon sx={{ fontSize: 12 }} />}
                    label={role === 'SITE_HEAD' ? 'Site Head' : 'HOD'}
                    color="primary"
                    sx={{ height: 18, fontSize: 10, '& .MuiChip-icon': { ml: '4px' } }} />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {user.designation || roleHint(role)}
          </Typography>
        </Box>

        {/* Department tag */}
        {dept ? (
          <Tooltip title={`${dept.name} (${dept.deptType})`}>
            <Chip
              size="small"
              label={dept.code}
              color={TYPE_COLOR[dept.deptType] || 'default'}
              variant={dept.deptType === 'STANDARD' ? 'outlined' : 'filled'}
              sx={{ fontWeight: 600 }}
            />
          </Tooltip>
        ) : (
          <Chip size="small" label="—" variant="outlined" sx={{ opacity: 0.5 }} />
        )}

        {/* Reviewer flags */}
        {user.isQaReviewer && (
          <Tooltip title="QA Reviewer">
            <Chip size="small" label="QA" color="success"
                  sx={{ height: 20, fontSize: 10 }} />
          </Tooltip>
        )}
        {user.isDeptReviewer && (
          <Tooltip title="Department Reviewer">
            <Chip size="small" label="DR" color="info"
                  sx={{ height: 20, fontSize: 10 }} />
          </Tooltip>
        )}

        {/* License */}
        {user.hasActiveLicense
          ? <Tooltip title="Active license"><LicenseIcon sx={{ fontSize: 18, color: 'success.main' }} /></Tooltip>
          : <Tooltip title="No active license"><NoLicenseIcon sx={{ fontSize: 18, color: 'error.light' }} /></Tooltip>}
      </Paper>
    </Box>
  );
};

// ── Recursive sub-tree ──────────────────────────────────────
const SubTree = ({ dept, depth, expanded, onToggle, isLastChild, search, expandedMap }) => {
  const childCount = (dept.members?.length || 0) + (dept.subDepartments?.length || 0);
  const hodHasChildren = childCount > 0;

  // Filter member list by search (case-insensitive against name/dept code)
  const matchesSearch = (u) => {
    if (!search) return true;
    const t = search.toLowerCase();
    const name = (u.fullName || u.username || '').toLowerCase();
    return name.includes(t) || (dept.code || '').toLowerCase().includes(t)
        || (dept.name || '').toLowerCase().includes(t);
  };

  // Build the list of children that will be rendered under this HOD.
  const visibleMembers = (dept.members || []).filter(matchesSearch);
  const visibleSubs    = (dept.subDepartments || []);

  const totalRendered = visibleMembers.length + visibleSubs.length;

  const renderHodPlaceholder = (
    <Box sx={{ pl: `${depth * 28}px`, mb: 0.6, position: 'relative' }}>
      {depth > 0 && (
        <Box sx={{
            position: 'absolute',
            left: `${(depth - 1) * 28 + 12}px`,
            top: 18, width: 14, height: 2,
            bgcolor: 'divider',
          }} />
      )}
      <Paper variant="outlined" sx={{
          px: 1.4, py: 1, borderRadius: 1.5,
          borderLeft: '4px solid',
          borderLeftColor: dept.deptType === 'QA'  ? 'success.main'
                         : dept.deptType === 'RA'  ? 'warning.main' : 'grey.400',
          display: 'flex', alignItems: 'center', gap: 1.2, bgcolor: 'warning.50',
        }}>
        <Box sx={{ width: 28 }} />
        <Avatar sx={{ width: 36, height: 36, bgcolor: 'warning.light' }}>?</Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight={600} color="warning.dark">
            HOD not set — {dept.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Assign a Head of Department on the Departments page.
          </Typography>
        </Box>
        <Chip size="small" label={dept.code} variant="outlined" />
      </Paper>
    </Box>
  );

  return (
    <>
      {dept.hod
        ? <EmployeeRow
            user={dept.hod}
            dept={dept}
            role="HOD"
            depth={depth}
            hasChildren={hodHasChildren && totalRendered > 0}
            expanded={expanded}
            onToggle={onToggle}
            isLastChild={isLastChild}
          />
        : renderHodPlaceholder}

      {expanded && (
        <>
          {visibleMembers.map((m, i) => (
            <EmployeeRow
              key={m.id}
              user={m}
              dept={dept}
              role="MEMBER"
              depth={depth + 1}
              isLastChild={i === visibleMembers.length - 1 && visibleSubs.length === 0}
            />
          ))}
          {visibleSubs.map((sub, i) => {
            const subKey  = `dept-${sub.id}`;
            const subOpen = expandedMap[subKey] !== false; // default expanded
            return (
              <SubTree
                key={sub.id}
                dept={sub}
                depth={depth + 1}
                expanded={subOpen}
                onToggle={() =>
                  expandedMap.__set(subKey, !subOpen)
                }
                isLastChild={i === visibleSubs.length - 1}
                search={search}
                expandedMap={expandedMap}
              />
            );
          })}
        </>
      )}
    </>
  );
};

// ── Page ────────────────────────────────────────────────────
const OrgTreePage = () => {
  const navigate = useNavigate();
  const [data, setData]    = useState(null);
  const [loading, setLoad] = useState(false);
  const [error, setError]  = useState(null);
  const [search, setSearch] = useState('');
  const [showOrphans, setShowOrphans] = useState(false);

  // Per-node expansion state. Default = expanded.
  const [expanded, setExpanded] = useState({});
  const expandedMap = useMemo(() => ({
    ...expanded,
    __set: (k, v) => setExpanded((p) => ({ ...p, [k]: v })),
  }), [expanded]);

  const fetchTree = useCallback(async () => {
    setLoad(true); setError(null);
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

  // Stats: total employees + license counts
  const stats = useMemo(() => {
    if (!site) return null;
    let total = 0, licensed = 0, hods = 0;
    const walk = (dept) => {
      if (dept.hod) { total++; hods++; if (dept.hod.hasActiveLicense) licensed++; }
      (dept.members || []).forEach((m) => {
        total++;
        if (m.hasActiveLicense) licensed++;
      });
      (dept.subDepartments || []).forEach(walk);
    };
    if (site.head) { total++; if (site.head.hasActiveLicense) licensed++; }
    (site.departments || []).forEach(walk);
    return { total, licensed, hods, departments: (site.departments || []).length };
  }, [site]);

  return (
    <Box>
      <PageHeader
        title="Organisation Tree"
        subtitle="Reporting hierarchy — Site Head at top, every employee as a node, department shown as a tag on each."
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
          {[1,2,3,4].map(i => <Skeleton key={i} height={56} variant="rounded" />)}
        </Stack>
      )}

      {site && (
        <>
          {/* Filters / counts row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              placeholder="Filter by name or department…"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: 280 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              }}
            />
            <FormControlLabel
              control={<Switch size="small" checked={showOrphans}
                       onChange={(e) => setShowOrphans(e.target.checked)} />}
              label={<Typography variant="caption">Show empty departments</Typography>}
            />
            <Box sx={{ flex: 1 }} />
            {stats && (
              <Stack direction="row" spacing={0.8}>
                <Chip size="small" label={`${stats.total} employees`} variant="outlined" />
                <Chip size="small" label={`${stats.hods} HODs`} color="primary" variant="outlined" />
                <Chip size="small" label={`${stats.licensed}/${stats.total} licensed`}
                      color={stats.licensed === stats.total ? 'success' : 'warning'}
                      variant="outlined" />
              </Stack>
            )}
          </Box>

          {/* Site card — top of the reporting tree */}
          <Box sx={{ mb: 2 }}>
            <Paper elevation={0} sx={{
                p: 2,
                border: '2px solid', borderColor: 'primary.main',
                borderRadius: 2, bgcolor: 'primary.50',
                display: 'flex', alignItems: 'center', gap: 2,
              }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44, fontWeight: 700 }}>
                {site.name?.[0] || 'S'}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={700}>{site.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {site.code || '—'}
                  {site.address ? ` · ${site.address}` : ''}
                </Typography>
              </Box>
            </Paper>
          </Box>

          {/* Site Head row (depth 0) */}
          {site.head ? (
            <EmployeeRow
              user={site.head}
              dept={null}
              role="SITE_HEAD"
              depth={0}
              hasChildren={(site.departments?.length || 0) > 0}
              expanded
              onToggle={() => {}}
              isLastChild
            />
          ) : (
            <Paper variant="outlined" sx={{
                p: 1.4, mb: 1, bgcolor: 'warning.50',
                borderLeft: '4px solid', borderLeftColor: 'warning.main',
                display: 'flex', alignItems: 'center', gap: 1,
              }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'warning.light' }}>?</Avatar>
              <Box>
                <Typography variant="body2" fontWeight={600}>Site Head not set</Typography>
                <Typography variant="caption" color="text.secondary">
                  Set one on the Site Profile page.
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Reporting tree — each top-level dept hangs off the Site Head's line */}
          <Box sx={{ position: 'relative' }}>
            {(site.departments || [])
              .filter((d) => showOrphans || (d.hod) || (d.members?.length) || (d.subDepartments?.length))
              .map((dept, i, arr) => {
                const key  = `dept-${dept.id}`;
                const open = expandedMap[key] !== false; // default expanded
                return (
                  <SubTree
                    key={dept.id}
                    dept={dept}
                    depth={1}
                    expanded={open}
                    onToggle={() => expandedMap.__set(key, !open)}
                    isLastChild={i === arr.length - 1}
                    search={search}
                    expandedMap={expandedMap}
                  />
                );
              })}
          </Box>

          {site.departments?.length === 0 && (
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
