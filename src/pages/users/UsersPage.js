import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Button, Chip, IconButton, Tooltip, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem, Alert,
  FormControlLabel, Switch, Stack, Typography,
} from '@mui/material';
import {
  Add as AddIcon, Search as SearchIcon,
  Edit as EditIcon, Block as DisableIcon, Refresh as RefreshIcon,
  Security as PolicyIcon,
  LockReset as LockResetIcon,
  CloudUpload as UploadIcon,
  AssignmentInd as AssignLicenseIcon,
  CheckCircle as LicenseOkIcon,
  Cancel as NoLicenseIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import PasswordPolicyChecklist from '../../components/PasswordPolicyChecklist';
import PasswordPolicyDialog from './PasswordPolicyDialog';
import BulkUserUploadDialog from './BulkUserUploadDialog';
import {
  getUsersApi, createUserApi, updateUserApi, deleteUserApi,
  assignRolesApi, adminResetPasswordApi,
} from '../../api/userApi';
import { getAllRolesFlatApi } from '../../api/roleApi';
import { listDepartmentsApi } from '../../api/orgApi';
import { listLicensesApi, assignLicenseApi } from '../../api/licenseApi';
import { getStatusColor, formatDate } from '../../utils/helpers';
import { ROUTES } from '../../utils/constants';

const EMPTY_FORM = {
  firstName: '', lastName: '', username: '', email: '', password: '',
  initials: '', joiningDate: '', phone: '',
  departmentId: '', isDeptReviewer: false, isQaReviewer: false,
  designation: '', role: '', status: 'ACTIVE',
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
    initials: u.initials || '',
    phone: u.phone || '',
    joiningDate: u.joiningDate || '',
    role: firstRole?.name || u.role || '',
    roleId: firstRole?.id ?? null,
    department: u.department || '',
    departmentId: u.departmentId ?? '',
    departmentName: u.departmentName || u.department || '',
    isDeptReviewer: !!u.isDeptReviewer,
    isQaReviewer: !!u.isQaReviewer,
    designation: u.designation || '',
    hasActiveLicense: !!u.hasActiveLicense,
    licenseCode: u.licenseCode || '',
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
  const [departments, setDepartments] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [includeDisabled, setIncludeDisabled] = useState(false);
  const [policyOk, setPolicyOk] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // ── Admin password reset ────────────────────────────────
  const [resetTarget, setResetTarget]   = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]     = useState(null);
  const [resetPolicyOk, setResetPolicyOk] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // ── Quick license assign (per-user shortcut) ────────────
  const [licTarget, setLicTarget]     = useState(null);
  const [licAvailable, setLicAvailable] = useState([]);
  const [licChosen, setLicChosen]     = useState('');
  const [licSaving, setLicSaving]     = useState(false);
  const [licError, setLicError]       = useState(null);

  // ── Lookups ────────────────────────────────────────────
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
        // Drop legacy soft-deleted roles (QA_MANAGER, QA_OFFICER, AUDITOR, HOD
        // were deprecated by V18) — assigning them on create returns
        // "One or more role IDs are invalid or do not exist." from the backend.
        const list = (data?.data ?? []).filter((r) => !r.disabled);
        setRoles(list);
        if (list.length > 0) setForm((f) => ({ ...f, role: f.role || list[0].id }));
      })
      .catch(() => {});
    listDepartmentsApi()
      .then(({ data }) => setDepartments(data?.data || []))
      .catch(() => {});
  }, []);

  // For the user form: pre-select QA Reviewer toggle visibility based on chosen dept type.
  const selectedDept = useMemo(
    () => departments.find(d => String(d.id) === String(form.departmentId)),
    [departments, form.departmentId]
  );

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
      initials:  user.initials  || '',
      joiningDate: user.joiningDate || '',
      phone:     user.phone     || '',
      departmentId: user.departmentId || '',
      isDeptReviewer: !!user.isDeptReviewer,
      isQaReviewer:   !!user.isQaReviewer,
      designation: user.designation || '',
      role:      user.roleId || '',
      status:    user.status,
    });
    setSaveError(null);
    setDialogOpen(true);
  };

  // Mandatory-field gate. On create, all the new fields are required.
  // On edit the username/password fields are immutable.
  const requiredFieldsOk = editUser
    ? !!form.firstName.trim()
    : !!form.firstName.trim()
        && !!form.username.trim()
        && !!form.password
        && !!form.initials.trim()
        && !!form.joiningDate
        && !!form.phone.trim()
        && !!form.departmentId
        && !!form.role
        && policyOk;

  const handleSave = async () => {
    setSaving(true); setSaveError(null);
    try {
      const firstName = form.firstName.trim();
      const lastName  = form.lastName.trim() || undefined;
      const email     = form.email.trim()    || undefined;

      if (editUser) {
        const profileChanged =
          firstName !== editUser.firstName ||
          (lastName || '') !== (editUser.lastName || '') ||
          form.designation !== editUser.designation ||
          form.phone !== editUser.phone ||
          form.initials !== editUser.initials ||
          form.joiningDate !== editUser.joiningDate ||
          String(form.departmentId || '') !== String(editUser.departmentId || '') ||
          form.isDeptReviewer !== editUser.isDeptReviewer ||
          form.isQaReviewer   !== editUser.isQaReviewer ||
          (form.status === 'ACTIVE') !== (editUser.status === 'ACTIVE');

        const roleChanged = form.role && String(form.role) !== String(editUser.roleId);

        const calls = [];
        if (profileChanged) {
          calls.push(updateUserApi(editUser.id, {
            firstName,
            lastName: lastName || null,
            initials: form.initials || null,
            joiningDate: form.joiningDate || null,
            phone: form.phone || null,
            departmentId: form.departmentId || null,
            isDeptReviewer: form.isDeptReviewer,
            isQaReviewer:   form.isQaReviewer,
            designation: form.designation || null,
            isActive: form.status === 'ACTIVE',
          }));
        }
        if (roleChanged) calls.push(assignRolesApi(editUser.id, [form.role]));
        if (calls.length === 0) { setDialogOpen(false); return; }
        await Promise.all(calls);
      } else {
        await createUserApi({
          username:    form.username.trim(),
          email,
          password:    form.password,
          firstName,
          lastName,
          initials:    form.initials.trim().toUpperCase(),
          joiningDate: form.joiningDate,
          phone:       form.phone.trim(),
          departmentId: form.departmentId,
          isDeptReviewer: form.isDeptReviewer,
          isQaReviewer:   form.isQaReviewer,
          designation: form.designation || undefined,
          roleIds: [form.role],
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

  // ── Admin reset password ─────────────────────────────────
  const openReset = (user) => {
    setResetTarget(user); setResetPassword(''); setResetError(null);
    setResetPolicyOk(false); setResetSuccess(false);
  };
  const closeReset = () => { setResetTarget(null); setResetSuccess(false); };
  const handleAdminReset = async () => {
    if (!resetTarget || !resetPolicyOk) return;
    setResetLoading(true); setResetError(null);
    try {
      await adminResetPasswordApi(resetTarget.id, resetPassword);
      setResetSuccess(true);
      setTimeout(closeReset, 1500);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  // ── Quick license assign ─────────────────────────────────
  const openLicAssign = async (user) => {
    setLicTarget(user);
    setLicChosen(''); setLicError(null);
    try {
      const { data } = await listLicensesApi({ status: 'AVAILABLE', size: 200 });
      setLicAvailable(data?.data?.content || []);
    } catch (err) {
      setLicError(err.response?.data?.message || 'Failed to load available licenses.');
    }
  };
  const handleLicAssign = async () => {
    if (!licTarget || !licChosen) return;
    setLicSaving(true); setLicError(null);
    try {
      await assignLicenseApi(licChosen, licTarget.id);
      setLicTarget(null);
      fetchUsers();
    } catch (err) {
      setLicError(err.response?.data?.message || 'Failed to assign license.');
    } finally {
      setLicSaving(false);
    }
  };

  // ── Columns ──────────────────────────────────────────────
  const columns = [
    { field: 'name', headerName: 'Name', minWidth: 150 },
    { field: 'initials', headerName: 'Initials', minWidth: 80,
      renderCell: (row) => row.initials || <em style={{ opacity: 0.5 }}>—</em> },
    { field: 'username', headerName: 'Username', minWidth: 110 },
    { field: 'email', headerName: 'Email', minWidth: 180,
      renderCell: (row) => row.email || <em style={{ opacity: 0.5 }}>—</em> },
    { field: 'departmentName', headerName: 'Department', minWidth: 150,
      renderCell: (row) => row.departmentName || <em style={{ opacity: 0.5 }}>—</em> },
    { field: 'role', headerName: 'Role', minWidth: 130, renderCell: (row) => {
      const roleName = row.role || '';
      const matched = roles.find((x) => x.name === roleName);
      const label = matched?.displayName || roleName;
      const color = roleName.includes('ADMIN') ? 'primary'
                  : roleName.includes('MANAGER') || roleName.includes('QA') ? 'secondary'
                  : 'default';
      return <Chip label={label} size="small" color={color} />;
    }},
    { field: 'license', headerName: 'License', minWidth: 100, renderCell: (row) => (
      row.hasActiveLicense
        ? <Tooltip title={row.licenseCode}><Chip size="small" label="Licensed" color="success" icon={<LicenseOkIcon />} /></Tooltip>
        : <Chip size="small" label="No license" color="error" variant="outlined" icon={<NoLicenseIcon />} />
    )},
    { field: 'status', headerName: 'Status', minWidth: 120, renderCell: (row) => (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        <Chip label={row.status} size="small" color={getStatusColor(row.status)} />
        {row.disabled && <Chip label="Disabled" size="small" color="default" variant="outlined" sx={{ fontSize: '0.65rem', height: 20, opacity: 0.8 }} />}
      </Box>
    )},
    { field: 'createdAt', headerName: 'Created', minWidth: 120, renderCell: (row) => formatDate(row.createdAt) },
    { field: 'actions', headerName: 'Actions', align: 'right', minWidth: 170,
      renderCell: (row) => (
        <Box>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          {!row.hasActiveLicense && (
            <Tooltip title="Assign license"><IconButton size="small" color="success" onClick={() => openLicAssign(row)}><AssignLicenseIcon fontSize="small" /></IconButton></Tooltip>
          )}
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
        subtitle="Manage system users, departments, and license assignments."
        breadcrumbs={[{ label: 'Dashboard', href: ROUTES.DASHBOARD }, { label: 'Users' }]}
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setBulkOpen(true)}>
              Bulk Upload
            </Button>
            <Button variant="outlined" startIcon={<PolicyIcon />} onClick={() => setPolicyOpen(true)}>
              Password Policy
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add User
            </Button>
          </Stack>
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
        <Tooltip title="Refresh"><IconButton onClick={fetchUsers}><RefreshIcon /></IconButton></Tooltip>
        <FormControlLabel
          control={<Switch size="small" checked={includeDisabled}
                           onChange={(e) => { setIncludeDisabled(e.target.checked); setPage(0); }} />}
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

      <BulkUserUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        departments={departments}
        defaultRoleId={roles[0]?.id || null}
        onUploaded={fetchUsers}
      />

      {/* ── Create / Edit User dialog ───────────────────── */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ component: 'form', autoComplete: 'off',
                      onSubmit: (e) => { e.preventDefault(); handleSave(); } }}
      >
        <DialogTitle>{editUser ? 'Edit User' : 'Create User'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField label="First Name" fullWidth required value={form.firstName}
                         onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Surname" fullWidth value={form.lastName}
                         onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                         helperText="Optional"
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={4}>
              <TextField label="Initials" fullWidth required value={form.initials}
                         onChange={(e) => setForm({ ...form, initials: e.target.value.toUpperCase() })}
                         placeholder="JKD"
                         helperText="Letters only"
                         inputProps={{ autoComplete: 'off', maxLength: 10 }} />
            </Grid>
            <Grid item xs={4}>
              <TextField label="Joining Date" type="date" fullWidth required value={form.joiningDate}
                         onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                         InputLabelProps={{ shrink: true }}
                         inputProps={{ autoComplete: 'off', max: new Date().toISOString().slice(0, 10) }} />
            </Grid>
            <Grid item xs={4}>
              <TextField label="Mobile Number" fullWidth required value={form.phone}
                         onChange={(e) => setForm({ ...form, phone: e.target.value })}
                         placeholder="+91-9876543210"
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Username" fullWidth required value={form.username}
                         onChange={(e) => setForm({ ...form, username: e.target.value })}
                         disabled={!!editUser}
                         helperText={editUser ? 'Cannot be changed' : ''}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Email Address" type="email" fullWidth value={form.email}
                         onChange={(e) => setForm({ ...form, email: e.target.value })}
                         disabled={!!editUser}
                         helperText={editUser ? 'Cannot be changed' : 'Optional'}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            {!editUser && (
              <>
                <Grid item xs={12}>
                  <TextField label="Initial Login Password" type="password" fullWidth required
                             value={form.password}
                             onChange={(e) => setForm({ ...form, password: e.target.value })}
                             helperText="User will be forced to change this on first login."
                             inputProps={{ autoComplete: 'new-password' }} />
                </Grid>
                <Grid item xs={12}>
                  <PasswordPolicyChecklist password={form.password}
                                           onAllPassed={setPolicyOk} compact />
                </Grid>
              </>
            )}
            <Grid item xs={6}>
              <TextField label="Department" select fullWidth required value={form.departmentId}
                         onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                {departments.map(d => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name} ({d.code})
                    {d.deptType !== 'STANDARD' && ` · ${d.deptType}`}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Designation" fullWidth value={form.designation}
                         onChange={(e) => setForm({ ...form, designation: e.target.value })}
                         placeholder="QA Officer / Production Engineer / …"
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={<Switch checked={form.isDeptReviewer}
                                   onChange={(e) => setForm({ ...form, isDeptReviewer: e.target.checked })} />}
                  label="Department Reviewer"
                />
                {selectedDept?.deptType === 'QA' && (
                  <FormControlLabel
                    control={<Switch checked={form.isQaReviewer}
                                     onChange={(e) => setForm({ ...form, isQaReviewer: e.target.checked })} />}
                    label="QA Reviewer"
                  />
                )}
              </Stack>
              {selectedDept?.deptType !== 'QA' && form.isQaReviewer && (
                <Typography variant="caption" color="warning.main">
                  QA Reviewer is only meaningful when the user belongs to a QA department.
                </Typography>
              )}
            </Grid>
            <Grid item xs={6}>
              <TextField label="Role" select fullWidth required value={form.role}
                         onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.displayName || r.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Status" select fullWidth required value={form.status}
                         onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['ACTIVE', 'INACTIVE'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" type="submit" disabled={saving || !requiredFieldsOk}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Admin password reset dialog ─────────────────── */}
      <Dialog open={!!resetTarget} onClose={closeReset} maxWidth="xs" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleAdminReset(); } }}>
        <DialogTitle>Reset password for {resetTarget?.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {resetError   && <Alert severity="error"   sx={{ mb: 2 }}>{resetError}</Alert>}
          {resetSuccess && <Alert severity="success" sx={{ mb: 2 }}>Password reset. The user will change it on next login.</Alert>}
          {!resetSuccess && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Set a temporary password. The user will be forced to change it on next login.
              </Alert>
              <TextField label="New temporary password" type="password" fullWidth required
                         value={resetPassword}
                         onChange={(e) => setResetPassword(e.target.value)}
                         autoFocus inputProps={{ autoComplete: 'new-password' }} />
              <PasswordPolicyChecklist password={resetPassword}
                                       onAllPassed={setResetPolicyOk} compact />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeReset} disabled={resetLoading}>{resetSuccess ? 'Close' : 'Cancel'}</Button>
          {!resetSuccess && (
            <Button variant="contained" color="warning" type="submit"
                    disabled={resetLoading || !resetPolicyOk}>
              {resetLoading ? 'Resetting…' : 'Reset Password'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Quick license assign dialog ─────────────────── */}
      <Dialog open={!!licTarget} onClose={() => setLicTarget(null)} maxWidth="xs" fullWidth
              PaperProps={{ component: 'form', autoComplete: 'off',
                            onSubmit: (e) => { e.preventDefault(); handleLicAssign(); } }}>
        <DialogTitle>Assign License to {licTarget?.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {licError && <Alert severity="error" sx={{ mb: 2 }}>{licError}</Alert>}
          {licAvailable.length === 0 ? (
            <Alert severity="warning">
              No AVAILABLE licenses in the pool. Generate more from the Licenses page first.
            </Alert>
          ) : (
            <TextField label="License code" select required fullWidth value={licChosen}
                       onChange={e => setLicChosen(e.target.value)}>
              {licAvailable.map(l => (
                <MenuItem key={l.id} value={l.id}>
                  <Typography fontFamily="monospace">{l.code}</Typography>
                </MenuItem>
              ))}
            </TextField>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLicTarget(null)} disabled={licSaving}>Cancel</Button>
          <Button type="submit" variant="contained"
                  disabled={licSaving || !licChosen || licAvailable.length === 0}>
            {licSaving ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage;
