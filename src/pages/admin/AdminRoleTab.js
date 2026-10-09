import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Chip, Alert, Button, Stack,
  Table, TableHead, TableRow, TableCell, TableBody, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  FormControlLabel, Checkbox, Divider,
} from '@mui/material';
import {
  Verified as SystemIcon,
  AddCircleOutline as AddIcon,
  Edit as EditIcon,
  DeleteOutline as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  getAllRolesFlatApi, createRoleApi, updateRoleApi,
  deleteRoleApi, assignPermissionsApi,
} from '../../api/roleApi';
import { getAllPermissionsFlatApi } from '../../api/permissionApi';
import useESignGuard from '../../hooks/useESignGuard';

/*
 * AdminRoleTab — Phase 2 (live).
 *
 * Lists every role with permission + user counts. Create / Edit /
 * Disable all work now that the backend accepts hasAuthority()-based
 * authorization (Phase 2 refactor). Each destructive action is wrapped
 * in useESignGuard.
 */

const RoleEditor = ({ open, role, allPermissions, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', displayName: '', description: '', permissionIds: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const esign = useESignGuard();

  useEffect(() => {
    if (!open) return;
    if (role) {
      setForm({
        name: role.name || '',
        displayName: role.displayName || '',
        description: role.description || '',
        permissionIds: (role.permissions || []).map((p) => p.id),
      });
    } else {
      setForm({ name: '', displayName: '', description: '', permissionIds: [] });
    }
    setError(null);
  }, [role, open]);

  const grouped = useMemo(() => {
    const by = {};
    for (const p of allPermissions) {
      (by[p.module || 'MISC'] ||= []).push(p);
    }
    Object.values(by).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return by;
  }, [allPermissions]);

  const togglePerm = (id) => setForm((f) => ({
    ...f,
    permissionIds: f.permissionIds.includes(id)
      ? f.permissionIds.filter(x => x !== id)
      : [...f.permissionIds, id],
  }));

  const save = () => {
    setError(null);
    const isCreate = !role;
    esign.request({
      meaning: isCreate ? `Create role: ${form.name}` : `Update role: ${role.name}`,
      recordRef: isCreate ? undefined : `Role #${role.id}`,
      action: async () => {
        setSaving(true);
        try {
          if (isCreate) {
            await createRoleApi({
              name: form.name,
              displayName: form.displayName,
              description: form.description || null,
              permissionIds: form.permissionIds,
            });
          } else {
            await updateRoleApi(role.id, {
              displayName: form.displayName,
              description: form.description || null,
            });
            await assignPermissionsApi(role.id, form.permissionIds);
          }
          onSaved();
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to save role.');
          throw err;
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const isCreate = !role;
  return (
    <Dialog
      open={open}
      onClose={(_e, reason) => { if (reason === 'backdropClick' || reason === 'escapeKeyDown') return; onClose(); }}
      disableEscapeKeyDown
      maxWidth="md" fullWidth
    >
      <DialogTitle>{isCreate ? 'Create role' : `Edit ${role?.displayName || role?.name}`}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <TextField label="Name (UPPER_SNAKE_CASE)"
                     required disabled={!isCreate || role?.isSystemRole}
                     helperText={isCreate ? 'Immutable once created.' : 'System role name is locked.'}
                     value={form.name}
                     onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
                     inputProps={{ autoComplete: 'off' }} />
          <TextField label="Display name" required
                     value={form.displayName}
                     onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                     inputProps={{ autoComplete: 'off' }} />
          <TextField label="Description" multiline rows={2}
                     value={form.description}
                     onChange={(e) => setForm({ ...form, description: e.target.value })}
                     inputProps={{ autoComplete: 'off' }} />
        </Stack>

        <Divider sx={{ my: 2 }}>Permissions</Divider>
        {Object.entries(grouped).map(([module, perms]) => (
          <Box key={module} sx={{ mb: 1.5 }}>
            <Typography variant="caption" fontWeight={700}
                        color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {module}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 2 }}>
              {perms.map((p) => (
                <FormControlLabel
                  key={p.id}
                  control={<Checkbox size="small"
                                      checked={form.permissionIds.includes(p.id)}
                                      onChange={() => togglePerm(p.id)} />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{p.displayName}</Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving || esign.isPending}>Cancel</Button>
        <Button variant="contained" onClick={save}
                disabled={saving || esign.isPending || !form.name || !form.displayName}>
          {saving ? 'Saving…' : (isCreate ? 'Create' : 'Save')}
        </Button>
      </DialogActions>
      {esign.element}
    </Dialog>
  );
};

const AdminRoleTab = () => {
  const [roles, setRoles]           = useState([]);
  const [allPerms, setAllPerms]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [editing, setEditing]       = useState(null); // null | {} create | role edit
  const esign = useESignGuard();

  const fetchAll = async () => {
    setLoading(true); setError(null);
    try {
      const [r, p] = await Promise.all([getAllRolesFlatApi(), getAllPermissionsFlatApi()]);
      setRoles(r.data?.data || []);
      setAllPerms(p.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = (role) => {
    if (!window.confirm(`Disable role ${role.name}? Users still carrying it will keep their permissions until reassigned.`)) return;
    esign.request({
      meaning: `Disable role: ${role.name}`,
      recordRef: `Role #${role.id}`,
      action: async () => {
        try {
          await deleteRoleApi(role.id);
          fetchAll();
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to disable role.');
          throw err;
        }
      },
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Roles</Typography>
          <Typography variant="body2" color="text.secondary">
            Create / edit / disable roles and bulk-assign permissions.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh"><IconButton size="small" onClick={fetchAll}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setEditing({})}>
            Create Role
          </Button>
        </Stack>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'action.hover' } }}>
                <TableCell>Role name</TableCell>
                <TableCell>Display</TableCell>
                <TableCell align="right">Perms</TableCell>
                <TableCell align="right">Users</TableCell>
                <TableCell>Flags</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography variant="body2" fontFamily="monospace">{r.name}</Typography></TableCell>
                  <TableCell>{r.displayName || '—'}</TableCell>
                  <TableCell align="right">
                    <Chip label={r.permissions?.length ?? r.permissionCount ?? 0} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={r.userCount ?? 0} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {r.isSystemRole && (
                      <Chip icon={<SystemIcon fontSize="small" />} label="System"
                            size="small" color="primary" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditing(r)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={r.isSystemRole ? 'System role cannot be disabled' : 'Disable'}>
                      <span>
                        <IconButton size="small" color="error"
                                    disabled={r.isSystemRole}
                                    onClick={() => handleDelete(r)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {roles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No roles found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      <RoleEditor
        open={!!editing}
        role={editing && editing.id ? editing : null}
        allPermissions={allPerms}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); fetchAll(); }}
      />
      {esign.element}
    </Box>
  );
};

export default AdminRoleTab;
