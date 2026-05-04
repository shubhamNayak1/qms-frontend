import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Button, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem, Alert, TextField,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import ErrorAlert from '../../components/ErrorAlert';
import {
  listDepartmentsApi, createDepartmentApi, updateDepartmentApi,
  deleteDepartmentApi, getSiteApi,
} from '../../api/orgApi';
import { getUsersApi } from '../../api/userApi';
import { ROUTES, DEPARTMENT_TYPES } from '../../utils/constants';

const TYPE_COLOR = { QA: 'success', RA: 'warning', STANDARD: 'default' };

const EMPTY_FORM = {
  name: '', code: '', description: '', siteId: null,
  parentId: '', hodUserId: '', deptType: 'STANDARD',
};

const DepartmentsPage = () => {
  const [rows, setRows]     = useState([]);
  const [users, setUsers]   = useState([]);
  const [siteId, setSiteId] = useState(null);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState(null);

  // ── Loaders ──────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoad(true); setError(null);
    try {
      const [d, s] = await Promise.all([listDepartmentsApi(), getSiteApi()]);
      setRows(d.data?.data || []);
      setSiteId(s.data?.data?.id || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load departments.');
    } finally {
      setLoad(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    getUsersApi({ size: 100 })
      .then(({ data }) => setUsers(data?.data?.content || []))
      .catch(() => {});
  }, []);

  // ── Dialog ───────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, siteId });
    setSaveError(null);
    setDialogOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name:        row.name,
      code:        row.code,
      description: row.description || '',
      siteId:      row.siteId,
      parentId:    row.parentId || '',
      hodUserId:   row.hodUserId || '',
      deptType:    row.deptType,
    });
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true); setSaveError(null);
    try {
      const payload = {
        ...form,
        parentId:  form.parentId  || null,
        hodUserId: form.hodUserId || null,
      };
      if (editing) await updateDepartmentApi(editing.id, payload);
      else         await createDepartmentApi(payload);
      setDialogOpen(false);
      fetchAll();
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save department.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department? Sub-departments will be re-parented to its parent.')) return;
    try {
      await deleteDepartmentApi(id);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete.');
    }
  };

  // Prevent self-as-parent in the dropdown when editing.
  const parentOptions = rows.filter(r => !editing || r.id !== editing.id);

  // ── HOD candidates ──────────────────────────────────────
  // The HOD dropdown should only list active users that already belong to
  // THIS department — assigning someone from another dept as HOD would
  // make the org tree inconsistent. When creating a brand-new department
  // there are no members yet, so we show an explanatory empty state.
  // The currently-set HOD is always included (even if their dept changed
  // out from under us) so the form value never disappears.
  const hodCandidates = useMemo(() => {
    const isActive = (u) => u.isActive !== false && !u.disabled;
    if (!editing) return [];

    const inDept = users.filter((u) => isActive(u) && u.departmentId === editing.id);

    // If a current HOD is set but they're no longer in this dept, keep them
    // in the list (with a marker) so the form still renders their name.
    const currentHodId = form.hodUserId;
    if (currentHodId && !inDept.some((u) => String(u.id) === String(currentHodId))) {
      const stale = users.find((u) => String(u.id) === String(currentHodId));
      if (stale) return [{ ...stale, _staleHod: true }, ...inDept];
    }
    return inDept;
  }, [editing, users, form.hodUserId]);

  const columns = [
    { field: 'name', headerName: 'Name', minWidth: 180 },
    { field: 'code', headerName: 'Code', minWidth: 100 },
    { field: 'deptType', headerName: 'Type', minWidth: 100, renderCell: (row) => (
      <Chip size="small" label={row.deptType} color={TYPE_COLOR[row.deptType] || 'default'}
            variant={row.deptType === 'STANDARD' ? 'outlined' : 'filled'} />
    )},
    { field: 'parentName', headerName: 'Parent', minWidth: 140,
      renderCell: (row) => row.parentName || <em style={{ opacity: 0.5 }}>top-level</em> },
    { field: 'hodUserName', headerName: 'HOD', minWidth: 160,
      renderCell: (row) => row.hodUserName || <em style={{ opacity: 0.5 }}>not set</em> },
    { field: 'memberCount', headerName: 'Members', minWidth: 90, align: 'right',
      renderCell: (row) => row.memberCount ?? 0 },
    { field: 'actions', headerName: 'Actions', minWidth: 110, align: 'right',
      renderCell: (row) => (
        <Box>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      )},
  ];

  return (
    <Box>
      <PageHeader
        title="Departments"
        subtitle="Departments and sub-departments of the organisation. QA / RA types drive QMS workflow gating."
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.DASHBOARD },
          { label: 'Organisation', href: ROUTES.ORG_TREE },
          { label: 'Departments' },
        ]}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh"><IconButton onClick={fetchAll}><RefreshIcon /></IconButton></Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Department</Button>
          </Box>
        }
      />

      {error && <ErrorAlert message={error} onRetry={fetchAll} />}

      <DataTable columns={columns} rows={rows} loading={loading} />

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          component: 'form',
          autoComplete: 'off',
          onSubmit: (e) => { e.preventDefault(); handleSave(); },
        }}
      >
        <DialogTitle>{editing ? 'Edit Department' : 'Add Department'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <TextField label="Name" required fullWidth value={form.name}
                         onChange={e => setForm({ ...form, name: e.target.value })}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={4}>
              <TextField label="Code" required fullWidth value={form.code}
                         onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                         helperText="Short, unique, e.g. QA, PROD-A"
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" fullWidth multiline rows={2}
                         value={form.description}
                         onChange={e => setForm({ ...form, description: e.target.value })}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Type" select required fullWidth value={form.deptType}
                         onChange={e => setForm({ ...form, deptType: e.target.value })}
                         helperText={form.deptType === 'QA' ? 'HOD becomes QA Head'
                                    : form.deptType === 'RA' ? 'Members satisfy RA review'
                                    : 'Standard department'}>
                {DEPARTMENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Parent department" select fullWidth value={form.parentId}
                         onChange={e => setForm({ ...form, parentId: e.target.value })}>
                <MenuItem value=""><em>Top-level (no parent)</em></MenuItem>
                {parentOptions.map(d => (
                  <MenuItem key={d.id} value={d.id}>{d.name} ({d.code})</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Head of Department"
                select
                fullWidth
                value={form.hodUserId}
                onChange={e => setForm({ ...form, hodUserId: e.target.value })}
                disabled={!editing}
                helperText={
                  !editing
                    ? 'Save the department first, then add users to it before assigning an HOD.'
                    : hodCandidates.length === 0
                      ? 'No active members in this department yet — add users to this department on the Users page, then return here.'
                      : 'Only active users already belonging to this department are listed.'
                }
              >
                <MenuItem value=""><em>None / TBD</em></MenuItem>
                {hodCandidates.map(u => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.fullName || u.username}
                    {u.designation ? ` · ${u.designation}` : ''}
                    {u._staleHod ? ' · ⚠ no longer in this dept' : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving || !form.name || !form.code || !form.deptType}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DepartmentsPage;
