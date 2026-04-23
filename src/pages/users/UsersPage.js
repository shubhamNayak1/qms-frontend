import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, IconButton, Tooltip, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem, Alert,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon,
  Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import { getUsersApi, createUserApi, updateUserApi, deleteUserApi, assignRolesApi } from '../../api/userApi';
import { getAllRolesFlatApi } from '../../api/roleApi';
import { getStatusColor, formatDate } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';

const EMPTY_FORM = { name: '', username: '', email: '', password: '', role: '', department: '', status: 'ACTIVE' };

const normalizeUser = (u) => {
  const firstRole = Array.isArray(u.roles) ? u.roles[0] : null;
  return {
    id: u.id,
    name: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
    username: u.username,
    email: u.email,
    role: firstRole?.name || u.role || '',       // name — used for display
    roleId: firstRole?.id ?? null,               // id  — used for form
    department: u.department || '',
    status: u.isActive !== undefined ? (u.isActive ? 'ACTIVE' : 'INACTIVE') : (u.status || 'ACTIVE'),
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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getUsersApi({ search: search || undefined, page, size: rowsPerPage });
      const payload = data?.data;
      const items = payload?.content ?? (Array.isArray(payload) ? payload : []);
      setRows(items.map(normalizeUser));
      setTotalCount(payload?.totalElements ?? items.length);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [search, page, rowsPerPage]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    getAllRolesFlatApi()
      .then(({ data }) => {
        const list = data?.data ?? [];
        setRoles(list);
        // pre-select first role in EMPTY_FORM default
        if (list.length > 0) setForm((f) => ({ ...f, role: f.role || list[0].id }));
      })
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm({ ...EMPTY_FORM, role: roles[0]?.id || '' });
    setSaveError(null);
    setDialogOpen(true);
  };
  const openEdit = (user) => {
    setEditUser(user);
    setForm({ name: user.name, username: user.username || '', email: user.email, password: '', role: user.roleId || '', department: user.department, status: user.status });
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const [firstName, ...rest] = (form.name || '').split(' ');
      const lastName = rest.join(' ');

      if (editUser) {
        // Detect what actually changed
        const [origFirst, ...origRest] = (editUser.name || '').split(' ');
        const origLast = origRest.join(' ');

        const profileChanged =
          firstName !== origFirst ||
          lastName !== origLast ||
          form.department !== editUser.department ||
          (form.status === 'ACTIVE') !== (editUser.status === 'ACTIVE');

        const roleChanged = form.role && String(form.role) !== String(editUser.roleId);

        const calls = [];
        if (profileChanged) {
          calls.push(updateUserApi(editUser.id, {
            firstName, lastName,
            department: form.department,
            isActive: form.status === 'ACTIVE',
          }));
        }
        if (roleChanged) {
          calls.push(assignRolesApi(editUser.id, [form.role]));
        }

        if (calls.length === 0) {
          // nothing changed — just close
          setDialogOpen(false);
          return;
        }
        await Promise.all(calls);
      } else {
        // POST — create user with roleIds in one call
        await createUserApi({
          username: form.username,
          email: form.email,
          password: form.password,
          firstName, lastName,
          roleIds: [form.role],
          department: form.department,
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
    if (!window.confirm('Delete this user?')) return;
    try {
      await deleteUserApi(id);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  const columns = [
    { field: 'name', headerName: 'Name', minWidth: 150 },
    { field: 'username', headerName: 'Username', minWidth: 120 },
    { field: 'email', headerName: 'Email', minWidth: 200 },
    { field: 'role', headerName: 'Role', minWidth: 150, renderCell: (row) => {
      const roleName = row.role || '';
      const matched = roles.find((x) => x.name === roleName);
      const label = matched?.displayName || roleName;
      const color = roleName.includes('ADMIN') ? 'primary' : roleName.includes('MANAGER') || roleName.includes('QA') ? 'secondary' : 'default';
      return <Chip label={label} size="small" color={color} />;
    }},
    { field: 'department', headerName: 'Department', minWidth: 130 },
    { field: 'status', headerName: 'Status', minWidth: 100, renderCell: (row) => <Chip label={row.status} size="small" color={getStatusColor(row.status)} /> },
    { field: 'createdAt', headerName: 'Created', minWidth: 120, renderCell: (row) => formatDate(row.createdAt) },
    {
      field: 'actions', headerName: 'Actions', align: 'right', minWidth: 100,
      renderCell: (row) => (
        <Box>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add User
          </Button>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editUser ? 'Edit User' : 'Create User'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField label="Full Name" fullWidth value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Username" fullWidth value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Email Address" type="email" fullWidth value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Grid>
            {!editUser && (
              <Grid item xs={12}>
                <TextField label="Password" type="password" fullWidth value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField label="Department" fullWidth value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Role" select fullWidth value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.displayName || r.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Status" select fullWidth value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['ACTIVE', 'INACTIVE'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage;
