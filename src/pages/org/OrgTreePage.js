import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Chip, IconButton, Tooltip, Avatar,
  Stack, Button, Skeleton, TextField, InputAdornment,
  Divider, Collapse,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Place as PlaceIcon,
  Search as SearchIcon,
  Star as HodIcon,
  CheckCircle as LicenseIcon,
  Cancel as NoLicenseIcon,
  Warning as WarnIcon,
  Person as PersonIcon,
  ExpandMore as ExpandIcon,
  ChevronRight as CollapsedIcon,
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

const initialsOf = (user) =>
  (user?.initials || (user?.fullName || user?.username || '?')).slice(0, 2).toUpperCase();

const matches = (search, ...fields) => {
  if (!search) return true;
  const t = search.toLowerCase();
  return fields.filter(Boolean).some((s) => String(s).toLowerCase().includes(t));
};

// ── A single employee row — small, scannable ───────────────
const EmployeeRow = ({ user, isHod, dimmed, dense = false }) => {
  if (!user) return null;
  const tone = isHod ? 'primary.main' : 'grey.500';
  return (
    <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.2,
        py: dense ? 0.6 : 0.9, px: 1.2,
        borderRadius: 1,
        bgcolor: isHod ? 'primary.50' : 'transparent',
        opacity: dimmed ? 0.35 : 1,
        '&:hover': { bgcolor: isHod ? 'primary.100' : 'action.hover' },
        transition: 'opacity 120ms, background 120ms',
      }}>
      <Avatar sx={{
          width: dense ? 28 : 32, height: dense ? 28 : 32,
          fontSize: dense ? 11 : 12, fontWeight: 700,
          bgcolor: tone, color: 'white',
        }}>
        {initialsOf(user)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexWrap: 'wrap' }}>
          <Typography variant="body2" fontWeight={isHod ? 700 : 500} noWrap>
            {user.fullName || user.username}
          </Typography>
          {isHod && (
            <Tooltip title="Head of Department">
              <HodIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            </Tooltip>
          )}
        </Stack>
        {user.designation && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {user.designation}
          </Typography>
        )}
      </Box>

      {/* Reviewer chips */}
      {user.isQaReviewer && (
        <Tooltip title="QA Reviewer">
          <Chip size="small" label="QA Rev" color="success"
                sx={{ height: 18, fontSize: 10 }} />
        </Tooltip>
      )}
      {user.isDeptReviewer && (
        <Tooltip title="Department Reviewer">
          <Chip size="small" label="Dept Rev" color="info"
                sx={{ height: 18, fontSize: 10 }} />
        </Tooltip>
      )}

      {/* License */}
      {user.hasActiveLicense
        ? <Tooltip title="Active license"><LicenseIcon sx={{ fontSize: 16, color: 'success.main' }} /></Tooltip>
        : <Tooltip title="No active license"><NoLicenseIcon sx={{ fontSize: 16, color: 'error.light' }} /></Tooltip>}
    </Box>
  );
};

// ── A department card (recursive — sub-depts render as nested mini-cards) ──
const DepartmentCard = ({ dept, search, expanded, onToggle, expansionMap, depth = 0 }) => {
  const memberCount = (dept.members?.length || 0) + (dept.hod ? 1 : 0);
  const totalCount  = dept.totalMemberCount ?? memberCount;

  // Filter visible members based on search
  const visibleMembers = (dept.members || []).filter((m) =>
    matches(search, m.fullName, m.username, m.designation, dept.name, dept.code)
  );

  // Build sub-dept tree
  const visibleSubs = (dept.subDepartments || []);

  // Whether the department itself or any descendant matches search
  const deptMatches  = matches(search, dept.name, dept.code,
                                dept.hod?.fullName, dept.hod?.designation);
  const anyMatch     = deptMatches || visibleMembers.length > 0
                       || visibleSubs.some((s) => matches(search, s.name, s.code));

  // When searching and nothing matches, hide the whole branch.
  if (search && !anyMatch) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1.5,
        borderLeft: '4px solid',
        borderLeftColor: dept.deptType === 'QA'  ? 'success.main'
                       : dept.deptType === 'RA'  ? 'warning.main'
                       : 'grey.400',
        borderRadius: 1.5,
        ml: depth * 3,
        bgcolor: depth > 0 ? 'grey.50' : 'background.paper',
      }}
    >
      {/* Header */}
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 1.2,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
          borderRadius: '6px 6px 0 0',
        }}
      >
        <IconButton size="small" sx={{ p: 0.4 }}>
          {expanded ? <ExpandIcon fontSize="small" /> : <CollapsedIcon fontSize="small" />}
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {dept.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ({dept.code})
            </Typography>
            {depth > 0 && (
              <Chip size="small" label="Sub-department" variant="outlined"
                    sx={{ height: 18, fontSize: 9 }} />
            )}
          </Stack>
          {dept.hod && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              HOD: <strong>{dept.hod.fullName || dept.hod.username}</strong>
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={0.6}>
          <Chip size="small" label={dept.deptType}
                color={TYPE_COLOR[dept.deptType] || 'default'}
                variant={dept.deptType === 'STANDARD' ? 'outlined' : 'filled'} />
          <Chip size="small" icon={<PersonIcon sx={{ fontSize: 14 }} />}
                label={`${totalCount}`} variant="outlined" />
        </Stack>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Divider />
        <Box sx={{ p: 1 }}>
          {/* HOD */}
          {dept.hod ? (
            <EmployeeRow user={dept.hod} isHod
              dimmed={!!search && !matches(search, dept.hod.fullName,
                                            dept.hod.username, dept.hod.designation,
                                            dept.name, dept.code)} />
          ) : (
            <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                py: 0.9, px: 1.2,
                bgcolor: 'warning.50', borderRadius: 1,
              }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'warning.light' }}>
                <WarnIcon sx={{ fontSize: 18 }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700} color="warning.dark">
                  HOD not set
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Assign one on the Departments page.
                </Typography>
              </Box>
            </Box>
          )}

          {/* Members */}
          {visibleMembers.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary"
                          fontWeight={700} textTransform="uppercase" letterSpacing={0.5}
                          sx={{ display: 'block', mt: 1.5, mb: 0.5, px: 1 }}>
                Members ({visibleMembers.length})
              </Typography>
              <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr' },
                  gap: 0.4,
                }}>
                {visibleMembers.map((m) => (
                  <EmployeeRow key={m.id} user={m} dense
                    dimmed={!!search && !matches(search, m.fullName, m.username,
                                                  m.designation, dept.name, dept.code)} />
                ))}
              </Box>
            </>
          )}

          {(dept.members?.length || 0) === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ pl: 1.2, mt: 1, display: 'block' }}>
              No members yet.
            </Typography>
          )}

          {/* Sub-departments — render recursively */}
          {visibleSubs.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary"
                          fontWeight={700} textTransform="uppercase" letterSpacing={0.5}
                          sx={{ display: 'block', mt: 2, mb: 0.5, px: 1 }}>
                Sub-departments ({visibleSubs.length})
              </Typography>
              {visibleSubs.map((sub) => {
                const key = `dept-${sub.id}`;
                const subOpen = expansionMap[key] !== false;
                return (
                  <DepartmentCard
                    key={sub.id}
                    dept={sub}
                    search={search}
                    expanded={subOpen}
                    onToggle={() => expansionMap.__set(key, !subOpen)}
                    expansionMap={expansionMap}
                    depth={depth + 1}
                  />
                );
              })}
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

// ── Page ────────────────────────────────────────────────────
const OrgTreePage = () => {
  const navigate = useNavigate();
  const [data, setData]    = useState(null);
  const [loading, setLoad] = useState(false);
  const [error, setError]  = useState(null);
  const [search, setSearch] = useState('');
  const [allOpen, setAllOpen] = useState(true);

  // Per-card expansion. Default = open. The __set mutator on the proxy keeps
  // the recursion shallow — children call expansionMap.__set(key, value).
  const [expansion, setExpansion] = useState({});
  const expansionMap = useMemo(() => ({
    ...expansion,
    __set: (k, v) => setExpansion((p) => ({ ...p, [k]: v })),
  }), [expansion]);

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

  // Stats
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

  const expandAll = () => {
    const next = {};
    const walk = (dept) => {
      next[`dept-${dept.id}`] = true;
      (dept.subDepartments || []).forEach(walk);
    };
    (site?.departments || []).forEach(walk);
    setExpansion(next);
    setAllOpen(true);
  };

  const collapseAll = () => {
    const next = {};
    const walk = (dept) => {
      next[`dept-${dept.id}`] = false;
      (dept.subDepartments || []).forEach(walk);
    };
    (site?.departments || []).forEach(walk);
    setExpansion(next);
    setAllOpen(false);
  };

  return (
    <Box>
      <PageHeader
        title="Organisation"
        subtitle="Site Head at the top, then one card per department with the HOD highlighted and members listed."
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
          {[1,2,3,4].map(i => <Skeleton key={i} height={70} variant="rounded" />)}
        </Stack>
      )}

      {site && (
        <>
          {/* Filters / counts row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              placeholder="Search by name or department…"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: 280 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              }}
            />
            <Button size="small" onClick={allOpen ? collapseAll : expandAll}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </Button>
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

          {/* ── Site Head card ─────────────────────────────── */}
          <Paper
            elevation={0}
            sx={{
              mb: 2, p: 2,
              border: '2px solid', borderColor: 'primary.main',
              borderRadius: 2, bgcolor: 'primary.50',
              display: 'flex', alignItems: 'center', gap: 2,
            }}
          >
            <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48, fontWeight: 700 }}>
              {site.head ? initialsOf(site.head) : <PlaceIcon />}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="primary.main"
                          fontWeight={800} textTransform="uppercase" letterSpacing={0.5}
                          sx={{ display: 'block' }}>
                Site Head — {site.name} {site.code ? `(${site.code})` : ''}
              </Typography>
              {site.head ? (
                <>
                  <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                    {site.head.fullName || site.head.username}
                  </Typography>
                  {site.head.designation && (
                    <Typography variant="caption" color="text.secondary">
                      {site.head.designation}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="warning.dark" fontStyle="italic">
                  Not assigned — set on the Site Profile page.
                </Typography>
              )}
            </Box>
            {site.head && (
              site.head.hasActiveLicense
                ? <Chip icon={<LicenseIcon />} label="Licensed"  color="success" variant="outlined" />
                : <Chip icon={<NoLicenseIcon />} label="No license" color="error"   variant="outlined" />
            )}
          </Paper>

          {/* ── Departments — one card per top-level dept ─── */}
          {(site.departments || []).map((dept) => {
            const key = `dept-${dept.id}`;
            const open = expansion[key] !== false;
            return (
              <DepartmentCard
                key={dept.id}
                dept={dept}
                search={search}
                expanded={open}
                onToggle={() => expansionMap.__set(key, !open)}
                expansionMap={expansionMap}
              />
            );
          })}

          {(site.departments || []).length === 0 && (
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
