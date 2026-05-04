import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Chip, IconButton, Tooltip, TextField, MenuItem, Grid, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Typography, Stack,
} from '@mui/material';
import {
  Add as AddIcon, Refresh as RefreshIcon, AssignmentInd as AssignIcon,
  Block as RevokeIcon, ContentCopy as CopyIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import {
  listLicensesApi, getLicenseStatsApi, generateLicensesApi,
  assignLicenseApi, revokeLicenseApi,
} from '../../api/licenseApi';
import { getUsersApi } from '../../api/userApi';
import { ROUTES, LICENSE_STATUS } from '../../utils/constants';
import { formatDateTime } from '../../utils/helpers';

const STATUS_COLOR = {
  AVAILABLE: 'info',
  ASSIGNED:  'success',
  REVOKED:   'error',
  EXPIRED:   'warning',
};

const StatTile = ({ label, value, color = 'primary' }) => (
  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', minHeight: 92 }}>
    <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
      {label}
    </Typography>
    <Typography variant="h4" fontWeight={700} color={`${color}.main`}>
      {value}
    </Typography>
  </Paper>
);

const LicensesPage = () => {
  const [rows, setRows]       = useState([]);
  const [users, setUsers]     = useState([]);
  const [stats, setStats]     = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]       = useState(0);
  const [rowsPerPage, setRpp] = useState(10);
  const [total, setTotal]     = useState(0);
  const [loading, setLoad]    = useState(false);
  const [error, setError]     = useState(null);

  // ── Generate dialog ──────────────────────────────────────
  const [genOpen, setGenOpen]      = useState(false);
  const [genForm, setGenForm]      = useState({ count: 10, notes: '' });
  const [genSaving, setGenSaving]  = useState(false);
  const [genError, setGenError]    = useState(null);

  // ── Assign dialog ────────────────────────────────────────
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError]   = useState(null);

  const fetchData = useCallback(async () => {
    setLoad(true); setError(null);
    try {
      const params = { page, size: rowsPerPage };
      if (statusFilter) params.status = statusFilter;
      const [list, st] = await Promise.all([
        listLicensesApi(params),
        getLicenseStatsApi(),
      ]);
      const payload = list.data?.data;
      setRows(payload?.content ?? []);
      setTotal(payload?.totalElements ?? 0);
      setStats(st.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load licenses.');
    } finally {
      setLoad(false);
    }
  }, [page, rowsPerPage, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    getUsersApi({ size: 100 })
      .then(({ data }) => setUsers(data?.data?.content || []))
      .catch(() => {});
  }, []);

  // ── Generate ─────────────────────────────────────────────
  const handleGenerate = async (e) => {
    e?.preventDefault();
    setGenSaving(true); setGenError(null);
    try {
      await generateLicensesApi({ count: Number(genForm.count), notes: genForm.notes || undefined });
      setGenOpen(false);
      setGenForm({ count: 10, notes: '' });
      fetchData();
    } catch (err) {
      setGenError(err.response?.data?.message || 'Failed to generate licenses.');
    } finally {
      setGenSaving(false);
    }
  };

  // ── Assign ───────────────────────────────────────────────
  const openAssign = (license) => {
    setAssignTarget(license);
    setAssignUserId('');
    setAssignError(null);
  };
  const handleAssign = async (e) => {
    e?.preventDefault();
    if (!assignTarget || !assignUserId) return;
    setAssignSaving(true); setAssignError(null);
    try {
      await assignLicenseApi(assignTarget.id, assignUserId);
      setAssignTarget(null);
      fetchData();
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Failed to assign.');
    } finally {
      setAssignSaving(false);
    }
  };

  // ── Revoke ───────────────────────────────────────────────
  const handleRevoke = async (license) => {
    const reason = window.prompt(
      `Revoke license ${license.code} from ${license.assignedToUsername || 'user'}? Enter optional reason:`,
      '',
    );
    // null => cancel; empty string => proceed without reason.
    if (reason === null) return;
    try {
      await revokeLicenseApi(license.id, reason || undefined);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revoke.');
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
  };

  const columns = [
    { field: 'code', headerName: 'License Code', minWidth: 200, renderCell: (row) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{row.code}</Typography>
        <Tooltip title="Copy"><IconButton size="small" onClick={() => handleCopy(row.code)}>
          <CopyIcon sx={{ fontSize: 14 }} />
        </IconButton></Tooltip>
      </Box>
    )},
    { field: 'status', headerName: 'Status', minWidth: 110, renderCell: (row) => (
      <Chip size="small" label={row.status} color={STATUS_COLOR[row.status] || 'default'} />
    )},
    { field: 'assignedToUsername', headerName: 'Assigned To', minWidth: 160,
      renderCell: (row) => row.assignedToUsername || <em style={{ opacity: 0.5 }}>—</em> },
    { field: 'assignedAt', headerName: 'Assigned At', minWidth: 170,
      renderCell: (row) => row.assignedAt ? formatDateTime(row.assignedAt) : '—' },
    { field: 'expiresAt', headerName: 'Expires', minWidth: 170,
      renderCell: (row) => row.expiresAt ? formatDateTime(row.expiresAt) : 'Never' },
    { field: 'notes', headerName: 'Notes', minWidth: 160,
      renderCell: (row) => row.notes || '' },
    { field: 'actions', headerName: 'Actions', align: 'right', minWidth: 120, renderCell: (row) => (
      <Box>
        {row.status === 'AVAILABLE' && (
          <Tooltip title="Assign to user">
            <IconButton size="small" color="primary" onClick={() => openAssign(row)}>
              <AssignIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {row.status === 'ASSIGNED' && (
          <Tooltip title="Revoke">
            <IconButton size="small" color="error" onClick={() => handleRevoke(row)}>
              <RevokeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    )},
  ];

  return (
    <Box>
      <PageHeader
        title="Licenses"
        subtitle="Per-seat QMS licenses. Users without an active license cannot log in."
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'Licenses' }]}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh"><IconButton onClick={fetchData}><RefreshIcon /></IconButton></Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGenOpen(true)}>
              Generate Licenses
            </Button>
          </Box>
        }
      />

      {/* Stats */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}><StatTile label="Total"     value={stats.total}     color="primary"  /></Grid>
          <Grid item xs={6} sm={3}><StatTile label="Available" value={stats.available} color="info"     /></Grid>
          <Grid item xs={6} sm={3}><StatTile label="Assigned"  value={stats.assigned}  color="success"  /></Grid>
          <Grid item xs={6} sm={3}><StatTile label="Revoked"   value={stats.revoked}   color="error"    /></Grid>
        </Grid>
      )}

      {/* Filter */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField select label="Status" size="small" value={statusFilter}
                   onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
                   sx={{ minWidth: 160 }}>
          <MenuItem value=""><em>All</em></MenuItem>
          {LICENSE_STATUS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      </Stack>

      {error && <ErrorAlert message={error} onRetry={fetchData} />}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        totalCount={total}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRpp(+e.target.value); setPage(0); }}
      />

      {/* ── Generate dialog ───────────────────────────────── */}
      <Dialog
        open={genOpen}
        onClose={() => setGenOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ component: 'form', autoComplete: 'off', onSubmit: handleGenerate }}
      >
        <DialogTitle>Generate Licenses</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {genError && <Alert severity="error" sx={{ mb: 2 }}>{genError}</Alert>}
          <TextField
            label="How many?"
            type="number"
            required
            fullWidth
            sx={{ mb: 2 }}
            value={genForm.count}
            onChange={e => setGenForm({ ...genForm, count: e.target.value })}
            inputProps={{ min: 1, max: 500, autoComplete: 'off' }}
          />
          <TextField
            label="Notes (optional)"
            fullWidth
            multiline
            rows={2}
            value={genForm.notes}
            onChange={e => setGenForm({ ...genForm, notes: e.target.value })}
            placeholder="e.g. PO-2026-0042"
            inputProps={{ autoComplete: 'off' }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGenOpen(false)} disabled={genSaving}>Cancel</Button>
          <Button type="submit" variant="contained"
                  disabled={genSaving || !genForm.count || Number(genForm.count) <= 0}>
            {genSaving ? 'Generating…' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Assign dialog ─────────────────────────────────── */}
      <Dialog
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ component: 'form', autoComplete: 'off', onSubmit: handleAssign }}
      >
        <DialogTitle>Assign License</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {assignError && <Alert severity="error" sx={{ mb: 2 }}>{assignError}</Alert>}
          <Typography variant="caption" color="text.secondary">License code</Typography>
          <Typography variant="body2" fontFamily="monospace" sx={{ mb: 2 }}>
            {assignTarget?.code}
          </Typography>
          <TextField label="Assign to user" select required fullWidth value={assignUserId}
                     onChange={e => setAssignUserId(e.target.value)}>
            {users.map(u => (
              <MenuItem key={u.id} value={u.id}>
                {u.fullName || u.username} {u.email ? `· ${u.email}` : ''}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAssignTarget(null)} disabled={assignSaving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={assignSaving || !assignUserId}>
            {assignSaving ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LicensesPage;
