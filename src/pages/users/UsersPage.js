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
import { getUsersApi, createUserApi, updateUserApi, deleteUserApi } from '../../api/userApi';
import { getStatusColor, formatDate } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';

const MOCK_USERS = [
  { id: 1, name: 'Alice Johnson', email: 'alice@qms.com', role: 'ADMIN', department: 'Quality', status: 'ACTIVE', createdAt: '2024-01-15' },
  { id: 2, name: 'Bob Martinez', email: 'bob@qms.com', role: 'MANAGER', department: 'Production', status: 'ACTIVE', createdAt: '2024-02-20' },
  { id: 3, name: 'Carol Smith', email: 'carol@qms.com', role: 'USER', department: 'HR', status: 'ACTIVE', createdAt: '2024-03-10' },
  { id: 4, name: 'David Lee', email: 'david@qms.com', role: 'USER', department: 'Engineering', status: 'INACTIVE', createdAt: '2024-03-25' },
  { id: 5, name: 'Emma Wilson', email: 'emma@qms.com', role: 'MANAGER', department: 'Compliance', status: 'ACTIVE', createdAt: '2024-04-01' },
  { id: 6, name: 'Frank Brown', email: 'frank@qms.com', role: 'USER', department: 'Logistics', status: 'ACTIVE', createdAt: '2024-04-15' },
];

const EMPTY_FORM = { name: '', email: '', role: 'USER', department: '', status: 'ACTIVE' };

const UsersPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Uses mock data — swap for: const { data } = await getUsersApi({ page, size: rowsPerPage, search });
      await new Promise((r) => setTimeout(r, 600));
      const filtered = MOCK_USERS.filter(
        (u) =>
          !search ||
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.department.toLowerCase().includes(search.toLowerCase())
      );
      setRows(filtered);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => { setEditUser(null); setForm(EMPTY_FORM); setSaveError(null); setDialogOpen(true); };
  const openEdit = (user) => { setEditUser(user); setForm({ name: user.name, email: user.email, role: user.role, department: user.department, status: user.status }); setSaveError(null); setDialogOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (editUser) {
        await new Promise((r) => setTimeout(r, 400)); // swap: await updateUserApi(editUser.id, form);
        setRows((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...form } : u)));
      } else {
        await new Promise((r) => setTimeout(r, 400)); // swap: await createUserApi(form);
        setRows((prev) => [...prev, { id: Date.now(), ...form, createdAt: new Date().toISOString() }]);
      }
      setDialogOpen(false);
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await new Promise((r) => setTimeout(r, 300)); // swap: await deleteUserApi(id);
      setRows((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError('Failed to delete user.');
    }
  };

  const columns = [
    { field: 'name', headerName: 'Name', minWidth: 150 },
    { field: 'email', headerName: 'Email', minWidth: 200 },
    { field: 'role', headerName: 'Role', minWidth: 100, renderCell: (row) => <Chip label={row.role} size="small" color={row.role === 'ADMIN' ? 'primary' : row.role === 'MANAGER' ? 'secondary' : 'default'} /> },
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
          onChange={(e) => setSearch(e.target.value)}
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
        totalCount={rows.length}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editUser ? 'Edit User' : 'Create User'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          <Grid container spacing={2}>
            {[
              { label: 'Full Name', field: 'name' },
              { label: 'Email Address', field: 'email', type: 'email' },
              { label: 'Department', field: 'department' },
            ].map(({ label, field, type }) => (
              <Grid item xs={12} key={field}>
                <TextField label={label} type={type || 'text'} fullWidth value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </Grid>
            ))}
            <Grid item xs={6}>
              <TextField label="Role" select fullWidth value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {['ADMIN', 'MANAGER', 'USER'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
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
