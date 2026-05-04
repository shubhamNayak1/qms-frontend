import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip,
  Stack, Button, Skeleton, TextField, InputAdornment, Switch, FormControlLabel,
  Avatar,
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

// ── A single employee box (3 horizontal sections, dept shown as a tag) ──
//
//   ┌──────────────────────┐
//   │   ROLE (title)        │   ← "SITE HEAD" / "HOD" / "MEMBER"
//   ├──────────────────────┤
//   │  👤 Employee name     │
//   │     designation       │
//   ├──────────────────────┤
//   │ [Dept tag] [chips]   │   ← department chip + role flags + license
//   └──────────────────────┘
const EmployeeBox = ({
  role, name, designation, deptTag, permissionChips, dimmed,
}) => {
  const isHod      = role === 'site-head' || role === 'hod';
  const accent     = role === 'site-head' ? 'primary.main'
                   : role === 'hod'       ? 'primary.light'
                   : 'grey.400';
  const titleColor = isHod ? 'primary.main' : 'text.secondary';
  const bg         = role === 'site-head' ? 'primary.50'
                   : role === 'hod'       ? 'background.paper'
                   : 'grey.50';

  return (
    <Box sx={{
        position: 'relative',
        display: 'inline-flex', flexDirection: 'column',
        width: 220,
        border: '2px solid', borderColor: accent,
        borderRadius: 1.5, bgcolor: bg, boxShadow: 1,
        overflow: 'hidden',
        opacity: dimmed ? 0.35 : 1,
        transition: 'opacity 120ms',
      }}>
      {/* Title — role */}
      <Box sx={{
          textAlign: 'center', p: 0.8,
          borderBottom: '1px solid', borderColor: 'divider',
          minHeight: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4,
        }}>
        {isHod && <HodIcon sx={{ fontSize: 14, color: titleColor }} />}
        <Typography variant="caption" fontWeight={800}
                    color={titleColor}
                    textTransform="uppercase" letterSpacing={0.5}>
          {role === 'site-head' ? 'Site Head'
            : role === 'hod'    ? 'Head of Department'
            : 'Member'}
        </Typography>
      </Box>

      {/* Employee */}
      <Box sx={{
          textAlign: 'center', px: 1, py: 1.2,
          borderBottom: '1px solid', borderColor: 'divider',
          minHeight: 76,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 0.6,
        }}>
        {name ? (
          <>
            <Avatar sx={{
                width: 32, height: 32, fontSize: 13, fontWeight: 700,
                bgcolor: isHod ? 'primary.main' : 'grey.500',
                color: 'white',
              }}>
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
          <>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'warning.light' }}>
              <WarnIcon sx={{ fontSize: 18 }} />
            </Avatar>
            <Typography variant="caption" color="warning.dark" fontStyle="italic">
              Not assigned
            </Typography>
          </>
        )}
      </Box>

      {/* Department tag + permission chips */}
      <Box sx={{
          textAlign: 'center', px: 1, py: 0.8,
          minHeight: 44,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'center', gap: 0.5,
        }}>
        {deptTag && (
          <Tooltip title={`${deptTag.name} (${deptTag.deptType})`}>
            <Chip
              size="small"
              label={deptTag.code}
              color={TYPE_COLOR[deptTag.deptType] || 'default'}
              variant={deptTag.deptType === 'STANDARD' ? 'outlined' : 'filled'}
              sx={{ fontWeight: 700, height: 20 }}
            />
          </Tooltip>
        )}
        {permissionChips}
      </Box>
    </Box>
  );
};

// ── CSS-tree styles ────────────────────────────────────────
const treeSx = {
  '& ul': {
    display: 'flex', justifyContent: 'center', flexWrap: 'nowrap',
    listStyle: 'none', padding: 0, margin: 0,
    position: 'relative', paddingTop: '24px',
  },
  '& ul ul::before': {
    content: '""', position: 'absolute',
    top: 0, left: 'calc(50% - 1px)',
    width: 2, height: 24, bgcolor: 'grey.400',
  },
  '& li': {
    position: 'relative',
    padding: '24px 14px 0',
    listStyle: 'none',
  },
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
  '& li:only-child::before, & li:only-child::after': { display: 'none' },
  '& li:first-of-type::before': { border: 0 },
  '& li:last-of-type::after':   { border: 0 },
  '& li:last-of-type::before': {
    borderRight: '2px solid', borderColor: 'grey.400',
    borderRadius: '0 4px 0 0',
  },
  '& li:first-of-type::after': {
    borderLeft: '2px solid', borderColor: 'grey.400',
    borderRadius: '4px 0 0 0',
  },
};

// ── Recursive node renderer ────────────────────────────────
const TreeNode = ({ node }) => (
  <li>
    <EmployeeBox {...node.box} dimmed={node.dimmed} />
    {node.children?.length > 0 && (
      <ul>
        {node.children.map((c) => (
          <TreeNode key={c.id} node={c} />
        ))}
      </ul>
    )}
  </li>
);

// ── Permission chips for an employee ───────────────────────
const permissionChipsFor = (user) => {
  if (!user) return null;
  const out = [];
  if (user.isQaReviewer) {
    out.push(
      <Tooltip key="qa" title="QA Reviewer">
        <Chip size="small" label="QA Rev" color="success"
              sx={{ height: 20, fontSize: 10 }} />
      </Tooltip>
    );
  }
  if (user.isDeptReviewer) {
    out.push(
      <Tooltip key="dr" title="Department Reviewer">
        <Chip size="small" label="Dept Rev" color="info"
              sx={{ height: 20, fontSize: 10 }} />
      </Tooltip>
    );
  }
  out.push(
    user.hasActiveLicense
      ? <Tooltip key="lic" title="Active license">
          <LicenseIcon sx={{ fontSize: 18, color: 'success.main' }} />
        </Tooltip>
      : <Tooltip key="lic" title="No active license">
          <NoLicenseIcon sx={{ fontSize: 18, color: 'error.light' }} />
        </Tooltip>
  );
  return out;
};

// ── Page ────────────────────────────────────────────────────
const OrgTreePage = () => {
  const navigate = useNavigate();
  const [data, setData]    = useState(null);
  const [loading, setLoad] = useState(false);
  const [error, setError]  = useState(null);
  const [search, setSearch] = useState('');
  const [showMembers, setShowMembers] = useState(true);

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

  // ── Build employee-wise tree ─────────────────────────────
  // Each tree node represents ONE employee. Department info travels with
  // the employee as a coloured tag in the box's bottom section.
  //
  // Reporting structure:
  //   Site Head (root)
  //     └── HOD of dept A   (tag: A)
  //          ├── Member 1   (tag: A)
  //          ├── Member 2   (tag: A)
  //          └── HOD of sub-dept A.1   (tag: A.1)
  //               └── Sub-member 1     (tag: A.1)
  //     └── HOD of dept B   (tag: B)
  //          └── …
  const treeRoot = useMemo(() => {
    if (!site) return null;

    const matchesSearch = (user, dept) => {
      if (!search) return true;
      const t = search.toLowerCase();
      const fields = [
        user?.fullName, user?.username, user?.designation,
        dept?.name, dept?.code,
      ].filter(Boolean).map((s) => String(s).toLowerCase());
      return fields.some((s) => s.includes(t));
    };

    // Recurse through a department, returning the HOD's node with their
    // members and any sub-dept HODs as children. If the dept has no HOD,
    // return a placeholder so its members are still surfaced.
    const buildDeptBranch = (dept) => {
      const deptTag = { name: dept.name, code: dept.code, deptType: dept.deptType };

      // Members under this HOD (only if showMembers is on)
      const memberNodes = !showMembers ? [] : (dept.members || []).map((m) => ({
        id: `member-${m.id}-${dept.id}`,
        dimmed: !!search && !matchesSearch(m, dept),
        box: {
          role: 'member',
          name: m.fullName || m.username,
          designation: m.designation,
          deptTag,
          permissionChips: permissionChipsFor(m),
        },
        children: [],
      }));

      // Sub-departments cascade
      const subNodes = (dept.subDepartments || [])
        .map(buildDeptBranch)
        .filter(Boolean);

      // Build the HOD node (or placeholder)
      const hodNode = {
        id: `hod-${dept.id}`,
        dimmed: !!search && !matchesSearch(dept.hod, dept),
        box: {
          role: 'hod',
          name: dept.hod?.fullName || dept.hod?.username,
          designation: dept.hod?.designation || (dept.hod ? 'Head of Department' : null),
          deptTag,
          permissionChips: permissionChipsFor(dept.hod),
        },
        children: [...memberNodes, ...subNodes],
      };

      return hodNode;
    };

    const deptBranches = (site.departments || []).map(buildDeptBranch).filter(Boolean);

    return {
      id: 'site',
      dimmed: !!search && !matchesSearch(site.head, null),
      box: {
        role: 'site-head',
        name: site.head?.fullName,
        designation: site.head?.designation,
        deptTag: null,                      // site head doesn't belong to a dept
        permissionChips: permissionChipsFor(site.head),
      },
      children: deptBranches,
    };
  }, [site, search, showMembers]);

  return (
    <Box>
      <PageHeader
        title="Organisation Tree"
        subtitle="Top-down employee hierarchy. Each box is one employee with their department shown as a coloured tag."
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
              control={<Switch size="small" checked={showMembers}
                       onChange={(e) => setShowMembers(e.target.checked)} />}
              label={<Typography variant="caption">Show department members</Typography>}
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

          {/* The chart — horizontally scrollable for wide trees */}
          <Box sx={{
              ...treeSx,
              overflowX: 'auto', overflowY: 'visible',
              pb: 4, minHeight: 200,
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
            💡 Each box is one employee. The coloured tag at the bottom shows their department
            (green = QA, amber = RA, outlined = standard). HODs are highlighted with a star and
            primary border; members have a grey accent.
          </Typography>
        </>
      )}
    </Box>
  );
};

export default OrgTreePage;
