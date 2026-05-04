import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip,
  Stack, Button, Skeleton, TextField, InputAdornment, Switch, FormControlLabel,
  Drawer, Avatar, List, ListItem, ListItemAvatar, ListItemText, Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Place as PlaceIcon,
  Search as SearchIcon,
  Star as HodIcon,
  CheckCircle as LicenseIcon,
  Cancel as NoLicenseIcon,
  Close as CloseIcon,
  Groups as MembersIcon,
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

// ── A single rectangular org-chart box (3 horizontal sections) ───
//
// Mirrors the wireframe:
//   ┌──────────────┐
//   │   Title       │  ← role / dept name
//   ├──────────────┤
//   │ Employee name │  ← HOD or Site Head
//   ├──────────────┤
//   │  Permission   │  ← role chips + license indicator
//   └──────────────┘
const OrgBox = ({
  title, subtitle, name, designation, permissionChips,
  kind, deptType, onClick, dimmed,
}) => {
  const accent = kind === 'site'      ? 'primary.main'
              : deptType === 'QA'    ? 'success.main'
              : deptType === 'RA'    ? 'warning.main'
              : 'grey.500';
  const bg     = kind === 'site' ? 'primary.50' : 'background.paper';

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        width: 220,
        border: '2px solid', borderColor: accent,
        borderRadius: 1.5, bgcolor: bg,
        boxShadow: 1,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        opacity: dimmed ? 0.35 : 1,
        transition: 'transform 120ms, box-shadow 120ms',
        '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: 4 } : {},
      }}
    >
      {/* Title */}
      <Box sx={{
          textAlign: 'center', p: 1.2,
          borderBottom: '1px solid', borderColor: 'divider',
          minHeight: 60,
        }}>
        <Typography variant="caption" fontWeight={800}
                    color={kind === 'site' ? 'primary.main' : 'text.primary'}
                    textTransform="uppercase" letterSpacing={0.5} display="block">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" display="block">
            {subtitle}
          </Typography>
        )}
      </Box>

      {/* Employee name */}
      <Box sx={{
          textAlign: 'center', px: 1, py: 1.4,
          borderBottom: '1px solid', borderColor: 'divider',
          minHeight: 70,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 0.6,
        }}>
        {name ? (
          <>
            <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700,
                          bgcolor: kind === 'site' ? 'primary.main' : accent,
                          color: 'white' }}>
              {initialsOf({ fullName: name })}
            </Avatar>
            <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: '100%' }}>
              {name}
            </Typography>
            {designation && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: '100%' }}>
                {designation}
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="caption" color="warning.dark" fontStyle="italic">
            Not assigned
          </Typography>
        )}
      </Box>

      {/* Permission chips */}
      <Box sx={{
          textAlign: 'center', px: 1, py: 0.8,
          minHeight: 42,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'center', gap: 0.5,
        }}>
        {permissionChips?.length
          ? permissionChips
          : <Typography variant="caption" color="text.disabled">—</Typography>}
      </Box>
    </Box>
  );
};

// ── CSS-tree styles applied via sx ─────────────────────────
// Classic pattern: <ul> rows with ::before / ::after to draw connector lines.
const treeSx = {
  // outer ul
  '& ul': {
    display: 'flex', justifyContent: 'center', flexWrap: 'nowrap',
    listStyle: 'none', padding: 0, margin: 0,
    position: 'relative', paddingTop: '24px',
  },
  // vertical line from parent down to its row of children
  '& ul ul::before': {
    content: '""', position: 'absolute',
    top: 0, left: 'calc(50% - 1px)',
    width: 2, height: 24, bgcolor: 'grey.400',
  },
  '& li': {
    position: 'relative',
    padding: '24px 18px 0',
    listStyle: 'none',
  },
  // Each child draws two half-lines that together form the bus line above it.
  '& li::before, & li::after': {
    content: '""', position: 'absolute',
    top: 0, right: '50%',
    borderTop: '2px solid', borderColor: 'grey.400',
    width: '50%', height: 24,
  },
  '& li::after': {
    right: 'auto', left: '50%',
    borderLeft: '2px solid', borderColor: 'grey.400',
    borderTop: 0,
  },
  // Skip lines for an only child or at the ends of a sibling row.
  '& li:only-child::before, & li:only-child::after': { display: 'none' },
  '& li:first-of-type::before': { border: 0 },
  '& li:last-of-type::after':   { border: 0 },
  '& li:last-of-type::before': {
    borderRight: '2px solid',
    borderColor: 'grey.400',
    borderRadius: '0 4px 0 0',
  },
  '& li:first-of-type::after': {
    borderLeft: '2px solid',
    borderColor: 'grey.400',
    borderRadius: '4px 0 0 0',
  },
};

// ── Recursive node renderer ────────────────────────────────
const TreeNode = ({ node }) => (
  <li>
    <OrgBox {...node.box} onClick={node.onClick} dimmed={node.dimmed} />
    {node.children?.length > 0 && (
      <ul>
        {node.children.map((c) => (
          <TreeNode key={c.id} node={c} />
        ))}
      </ul>
    )}
  </li>
);

// ── Permission chip helpers ────────────────────────────────
const permissionChipsFor = (user) => {
  if (!user) return [];
  const out = [];
  if (user.isQaReviewer)   out.push(<Chip key="qa"  size="small" label="QA Reviewer"   color="success" sx={{ height: 18, fontSize: 10 }} />);
  if (user.isDeptReviewer) out.push(<Chip key="dr"  size="small" label="Dept Reviewer" color="info"    sx={{ height: 18, fontSize: 10 }} />);
  out.push(
    user.hasActiveLicense
      ? <Tooltip key="lic" title="Active license"><Chip size="small" icon={<LicenseIcon sx={{ fontSize: 12 }} />} label="Licensed" color="success" variant="outlined" sx={{ height: 18, fontSize: 10 }} /></Tooltip>
      : <Tooltip key="lic" title="No active license"><Chip size="small" icon={<NoLicenseIcon sx={{ fontSize: 12 }} />} label="No license" color="error" variant="outlined" sx={{ height: 18, fontSize: 10 }} /></Tooltip>
  );
  return out;
};

const sitePermissionChips = (user) =>
  user
    ? [<Chip key="head" size="small" icon={<HodIcon sx={{ fontSize: 12 }} />} label="Site Head" color="primary" sx={{ height: 18, fontSize: 10 }} />,
        ...permissionChipsFor(user)]
    : [];

// ── Members drawer (click a dept to see its members) ───────
const MembersDrawer = ({ open, onClose, dept }) => {
  if (!dept) return null;
  return (
    <Drawer anchor="right" open={open} onClose={onClose}
            PaperProps={{ sx: { width: { xs: '100%', sm: 380 } } }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1,
                 borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
            Department
          </Typography>
          <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
            {dept.name} <Typography component="span" variant="caption" color="text.secondary">({dept.code})</Typography>
          </Typography>
          <Chip size="small" label={dept.deptType}
                color={TYPE_COLOR[dept.deptType] || 'default'}
                variant={dept.deptType === 'STANDARD' ? 'outlined' : 'filled'} sx={{ mt: 0.5 }} />
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      {/* HOD */}
      {dept.hod && (
        <>
          <Box sx={{ px: 2, pt: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5}>
              Head of Department
            </Typography>
          </Box>
          <List dense>
            <ListItem>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 700 }}>
                  {initialsOf(dept.hod)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={dept.hod.fullName || dept.hod.username}
                secondary={dept.hod.designation || 'Head of Department'}
              />
              <Stack direction="column" spacing={0.4} alignItems="flex-end">
                {permissionChipsFor(dept.hod)}
              </Stack>
            </ListItem>
          </List>
          <Divider />
        </>
      )}

      {/* Members */}
      <Box sx={{ px: 2, pt: 2 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5}>
          Members ({dept.members?.length || 0})
        </Typography>
      </Box>
      <List dense>
        {dept.members?.length ? dept.members.map((m) => (
          <ListItem key={m.id}>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: 'grey.300', color: 'text.primary', fontWeight: 700 }}>
                {initialsOf(m)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={m.fullName || m.username}
              secondary={m.designation || 'Member'}
            />
            <Stack direction="column" spacing={0.4} alignItems="flex-end">
              {permissionChipsFor(m)}
            </Stack>
          </ListItem>
        )) : (
          <ListItem>
            <ListItemText primary="No members yet."
                          primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }} />
          </ListItem>
        )}
      </List>

      {/* Sub-departments */}
      {dept.subDepartments?.length > 0 && (
        <>
          <Divider />
          <Box sx={{ px: 2, pt: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5}>
              Sub-departments ({dept.subDepartments.length})
            </Typography>
          </Box>
          <List dense>
            {dept.subDepartments.map((s) => (
              <ListItem key={s.id}>
                <ListItemAvatar><Avatar sx={{ bgcolor: 'info.light' }}><MembersIcon /></Avatar></ListItemAvatar>
                <ListItemText
                  primary={`${s.name} (${s.code})`}
                  secondary={s.hod ? `HOD: ${s.hod.fullName}` : 'HOD not set'}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Drawer>
  );
};

// ── Page ────────────────────────────────────────────────────
const OrgTreePage = () => {
  const navigate = useNavigate();
  const [data, setData]    = useState(null);
  const [loading, setLoad] = useState(false);
  const [error, setError]  = useState(null);
  const [search, setSearch] = useState('');
  const [hideEmpty, setHideEmpty] = useState(true);

  // Members-drawer state
  const [drawerDept, setDrawerDept] = useState(null);

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

  // Build the recursive tree data structure. Each dept becomes a TreeNode; a
  // matching `search` substring keeps the dept (and its ancestors) visible
  // and dims non-matches.
  const treeRoot = useMemo(() => {
    if (!site) return null;

    const matchesSearch = (dept) => {
      if (!search) return true;
      const t = search.toLowerCase();
      const fields = [
        dept.name, dept.code,
        dept.hod?.fullName, dept.hod?.username, dept.hod?.designation,
      ].filter(Boolean).map((s) => String(s).toLowerCase());
      return fields.some((s) => s.includes(t));
    };

    // Recurse: returns a TreeNode if this dept (or any descendant) matches
    // the search. When `search` is empty everything passes through unchanged.
    const buildDept = (dept) => {
      const subs = (dept.subDepartments || [])
        .map(buildDept)
        .filter(Boolean)
        .filter((n) => !hideEmpty || n._matters);

      const selfMatters = !!dept.hod || (dept.members?.length || 0) > 0;
      if (hideEmpty && !selfMatters && subs.length === 0) return null;

      const matched = matchesSearch(dept);
      if (search && !matched && subs.length === 0) return null;

      return {
        id: `dept-${dept.id}`,
        _matters: true,
        dimmed: !!search && !matched,
        box: {
          kind: 'dept',
          deptType: dept.deptType,
          title: dept.name,
          subtitle: `${dept.code} · ${dept.deptType}`,
          name:  dept.hod?.fullName,
          designation: dept.hod?.designation || 'Head of Department',
          permissionChips: permissionChipsFor(dept.hod),
        },
        onClick: () => setDrawerDept(dept),
        children: subs,
      };
    };

    const deptNodes = (site.departments || [])
      .map(buildDept)
      .filter(Boolean);

    return {
      id: 'site',
      box: {
        kind: 'site',
        title: 'Site Head',
        subtitle: site.name,
        name: site.head?.fullName,
        designation: site.head?.designation,
        permissionChips: sitePermissionChips(site.head),
      },
      children: deptNodes,
    };
  }, [site, search, hideEmpty]);

  return (
    <Box>
      <PageHeader
        title="Organisation Tree"
        subtitle="Top-down org chart — Site Head at the top, departments below, click any box for details."
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
          {[1,2,3].map(i => <Skeleton key={i} height={100} variant="rounded" />)}
        </Stack>
      )}

      {site && (
        <>
          {/* Filters / counts row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              placeholder="Highlight by name or department…"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: 280 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              }}
            />
            <FormControlLabel
              control={<Switch size="small" checked={hideEmpty}
                       onChange={(e) => setHideEmpty(e.target.checked)} />}
              label={<Typography variant="caption">Hide empty departments</Typography>}
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

          {/* The actual top-down chart — horizontally scrollable for wide trees */}
          <Box sx={{
              ...treeSx,
              overflowX: 'auto', overflowY: 'visible',
              pb: 4,                       // breathing room below last row
              minHeight: 200,
              // Surrounding container styling
              border: '1px dashed', borderColor: 'divider',
              borderRadius: 2, bgcolor: 'background.default',
              p: 3,
            }}>
            {treeRoot && (
              <ul>
                <TreeNode node={treeRoot} />
              </ul>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            💡 Click any department box to see its members and sub-departments.
          </Typography>
        </>
      )}

      <MembersDrawer
        open={!!drawerDept}
        onClose={() => setDrawerDept(null)}
        dept={drawerDept}
      />
    </Box>
  );
};

export default OrgTreePage;
