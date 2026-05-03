import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, IconButton, Tooltip, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem, Alert,
  FormControlLabel, Switch,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon,
  Edit as EditIcon, Block as DisableIcon, Refresh as RefreshIcon,
  Security as PolicyIcon,
  LockReset as LockResetIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import PasswordPolicyChecklist from '../../components/PasswordPolicyChecklist';
import PasswordPolicyDialog from './PasswordPolicyDialog';
import {
  getUsersApi, createUserApi, updateUserApi, deleteUserApi,
  assignRolesApi, adminResetPasswordApi,
} from '../../api/userApi';
import { getAllRolesFlatApi } from '../../api/roleApi';
import { getStatusColor, formatDate } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';

const EMPTY_FORM = {
  firstName: '', lastName: '', username: '', email: '', password: '',
  role: '', department: '', status: 'ACTIVE',
};

const normalizeUser = (u) => {
  const firstRole = Array.isArray(u.roles) ? u.roles[0] : null;
  return {
    id: u.id,
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    name: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
    username: u.username,
    email: u.email,
    role: firstRole?.name || u.role || '',       // name — used for display
    roleId: firstRole?.id ?? null,               // id  — used for form
    department: u.department || '',
    status: u.isActive !== undefined ? (u.isActive ? 'ACTIVE' : 'INACTIVE') : (u.status || 'ACTIVE'),
    disabled: u.disabled || false,
    createdAt: u.createdAt,
  };
};

const UsersPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [roles, setRoles] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [includeDisabled, setIncludeDisabled] = useState(false);
  const [policyOk, setPolicyOk] = useState(false);

  // Admin password reset
  const [resetTarget, setResetTarget]   = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]     = useState(null);
  const [resetPolicyOk, setResetPolicyOk] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getUsersApi({ search: search || undefined, page, size: rowsPerPage });
      const payload = data?.data;
      const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
      const normalized = items.map(normalizeUser);
      setRows(includeDisabled ? normalized : normalized.filter((u) => !u.disabled));
      setTotalCount(payload?.totalElements ?? items.length);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [search, page, rowsPerPage, includeDisabled]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    getAllRolesFlatApi()
      .then(({ data }) => {
        const list = data?.data ?? [];
        setRoles(list);
        if (list.length > 0) setForm((f) => ({ ...f, role: f.role || list[0].id }));
      })
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm({ ...EMPTY_FORM, role: roles[0]?.id || '' });
    setSaveError(null);
    setPolicyOk(false);
    setDialogOpen(true);
  };
  const openEdit = (user) => {
    setEditUser(user);
    setForm({
      firstName: user.firstName || '',
      lastName:  user.lastName  || '',
      username:  user.username  || '',
      email:     user.email     || '',
      password:  '',
      role:      user.roleId || '',
      department: user.department,
      status:    user.status,
    });
    setSaveError(null);
    setDialogOpen(true);
  };

  // Mandatory-field gate for Create User. Surname & email are optional.
  const requiredFieldsOk = editUser
    ? !!form.firstName.trim()
    : !!form.firstName.trim() && !!form.username.trim() && !!form.password && !!form.role && policyOk;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Trim and normalise — surname & email are optional, so send undefined when blank
      const firstName = form.firstName.trim();
      const lastName  = form.lastName.trim() || undefined;
      const email     = form.email.trim()    || undefined;

      if (editUser) {
        const profileChanged =
          firstName !== editUser.firstName ||
          (lastName || '') !== (editUser.lastName || '') ||
          form.department !== editUser.department ||
          (form.status === 'ACTIVE') !== (editUser.status === 'ACTIVE');

        const roleChanged = form.role && String(form.role) !== String(editUser.roleId);

        const calls = [];
        if (profileChanged) {
          calls.push(updateUserApi(editUser.id, {
            firstName,
            lastName: lastName || null,
            department: form.department,
            isActive: form.status === 'ACTIVE',
          }));
        }
        if (roleChanged) {
          calls.push(assignRolesApi(editUser.id, [form.role]));
        }

        if (calls.length === 0) {
          setDialogOpen(false);
          return;
        }
        await Promise.all(calls);
      } else {
        await createUserApi({
          username: form.username.trim(),
          email,                          // omitted when blank
          password: form.password,
          firstName,
          lastName,                       // omitted when blank
          roleIds: [form.role],
          department: form.department || undefined,
        });
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Disable this user? They will no longer be able to log in.')) return;
    try {
      await deleteUserApi(id);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable user.');
    }
  };

  // ── Admin password reset ──────────────────────────────────
  const openReset = (user) => {
    setResetTarget(user);
    setResetPassword('');
    setResetError(null);
    setResetPolicyOk(false);
    setResetSuccess(false);
  };
  const closeReset = () => {
    setResetTarget(null);
    setResetSuccess(false);
  };
  const handleAdminReset = async () => {
    if (!resetTarget || !resetPolicyOk) return;
    setResetLoading(true);
    setResetError(null);
    try {
      await adminResetPasswordApi(resetTarget.id, resetPassword);
      setResetSuccess(true);
      // Auto-close after a moment so admin sees the confirmation.
      setTimeout(closeReset, 1500);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  const columns = [
    { field: 'name', headerName: 'Name', minWidth: 150 },
    { field: 'username', headerName: 'Username', minWidth: 120 },
    { field: 'email', headerName: 'Email', minWidth: 200, renderCell: (row) => row.email || '—' },
    { field: 'role', headerName: 'Role', minWidth: 150, renderCell: (row) => {
      const roleName = row.role || '';
      const matched = roles.find((x) => x.name === roleName);
      const label = matched?.displayName || roleName;
      const color = roleName.includes('ADMIN') ? 'primary' : roleName.includes('MANAGER') || roleName.includes('QA') ? 'secondary' : 'default';
      return <Chip label={label} size="small" color={color} />;
    }},
    { field: 'department', headerName: 'Department', minWidth: 130 },
    { field: 'status', headerName: 'Status', minWidth: 140, renderCell: (row) => (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        <Chip label={row.status} size="small" color={getStatusColor(row.status)} />
        {row.disabled && <Chip label="Disabled" size="small" color="default" variant="outlined" sx={{ fontSize: '0.65rem', height: 20, opacity: 0.8 }} />}
      </Box>
    )},
    { field: 'createdAt', headerName: 'Created', minWidth: 120, renderCell: (row) => formatDate(row.createdAt) },
    {
      field: 'actions', headerName: 'Actions', align: 'right', minWidth: 140,
      renderCell: (row) => (
        <Box>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Reset password"><IconButton size="small" color="warning" onClick={() => openReset(row)}><LockResetIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Disable"><IconButton size="small" color="error" onClick={() => handleDelete(row.id)} disabled={row.disabled}><DisableIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="User Management"
        subtitle="Manage system users and their access roles."
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'Users' }]}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<PolicyIcon />} onClick={() => setPolicyOpen(true)}>
              Password Policy
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add User
            </Button>
          </Box>
        }
      />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <TextField
          placeholder="Search by name, email, department..."
          size="small"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          sx={{ width: 320 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Tooltip title="Refresh">
          <IconButton onClick={fetchUsers}><RefreshIcon /></IconButton>
        </Tooltip>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={includeDisabled}
              onChange={(e) => { setIncludeDisabled(e.target.checked); setPage(0); }}
            />
          }
          label="Include Disabled"
          sx={{ ml: 1 }}
        />
      </Box>

      {error && <ErrorAlert message={error} onRetry={fetchUsers} />}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        totalCount={totalCount}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
      />

      <PasswordPolicyDialog open={policyOpen} onClose={() => setPolicyOpen(false)} />

      {/* ── Create / Edit User dialog ───────────────────────── */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ component: 'form', autoComplete: 'off', onSubmit: (e) => { e.preventDefault(); handleSave(); } }}
      >
        <DialogTitle>{editUser ? 'Edit User' : 'Create User'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="First Name"
                fullWidth
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                inputProps={{ autoComplete: 'off' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Surname"
                fullWidth
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                helperText="Optional"
                inputProps={{ autoComplete: 'off' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Username"
                fullWidth
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={!!editUser}
                helperText={editUser ? 'Cannot be changed' : ''}
                inputProps={{ autoComplete: 'off' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={!!editUser}
                helperText={editUser ? 'Cannot be changed' : 'Optional'}
                inputProps={{ autoComplete: 'off' }}
              />
            </Grid>
            {!editUser && (
              <>
                <Grid item xs={12}>
                  <TextField
                    label="Password"
                    type="password"
                    fullWidth
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    inputProps={{ autoComplete: 'new-password' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <PasswordPolicyChecklist
                    password={form.password}
                    onAllPassed={setPolicyOk}
                    compact
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <TextField
                label="Department"
                fullWidth
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                inputProps={{ autoComplete: 'off' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Role"
                select
                fullWidth
                required
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.displayName || r.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Status"
                select
                fullWidth
                required
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {['ACTIVE', 'INACTIVE'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            type="submit"
            disabled={saving || !requiredFieldsOk}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Admin password reset dialog ─────────────────────── */}
      <Dialog
        open={!!resetTarget}
        onClose={closeReset}
        maxWidth="xs"
        fullWidth
        PaperProps={{ component: 'form', autoComplete: 'off', onSubmit: (e) => { e.preventDefault(); handleAdminReset(); } }}
      >
        <DialogTitle>Reset password for {resetTarget?.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {resetError   && <Alert severity="error"   sx={{ mb: 2 }}>{resetError}</Alert>}
          {resetSuccess && <Alert severity="success" sx={{ mb: 2 }}>Password reset. The user will be required to change it on next login.</Alert>}
          {!resetSuccess && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Set a temporary password. The user will be forced to change it on next login.
              </Alert>
              <TextField
                label="New temporary password"
                type="password"
                fullWidth
                required
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                autoFocus
                inputProps={{ autoComplete: 'new-password' }}
              />
              <PasswordPolicyChecklist
                password={resetPassword}
                onAllPassed={setResetPolicyOk}
                compact
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeReset} disabled={resetLoading}>
            {resetSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!resetSuccess && (
            <Button
              variant="contained"
              color="warning"
              type="submit"
              disabled={resetLoading || !resetPolicyOk}
            >
              {resetLoading ? 'Resetting…' : 'Reset Password'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage;
