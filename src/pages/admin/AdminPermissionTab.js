import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Chip, Stack, Tabs, Tab, Alert, CircularProgress,
  Tooltip, IconButton, Button, TextField, MenuItem, Select, FormControl,
  InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as GrantIcon,
  Cancel as RevokeIcon,
  CheckBoxOutlineBlank as EmptyIcon,
  CheckBox as FilledIcon,
} from '@mui/icons-material';
import { getAllRolesFlatApi, assignPermissionsApi } from '../../api/roleApi';
import { getAllPermissionsFlatApi, listUserOverridesApi, upsertUserOverrideApi, removeUserOverrideApi } from '../../api/permissionApi';
import { getUsersApi } from '../../api/userApi';
import useESignGuard from '../../hooks/useESignGuard';

/*
 * AdminPermissionTab — Phase 2 live matrix.
 *
 * Two sub-views (as inner tabs):
 *   1. Role × Permission — matrix of which role carries which perm.
 *      Click a cell to toggle (goes through assignPermissionsApi
 *      bulk-set on the role).
 *   2. User × Permission — overlay matrix for one user at a time.
 *      Shows faint tick for role-inherited perms; GRANT / REVOKE
 *      ticks for explicit user_permissions overrides. Click cycles
 *      through states.
 *
 * Every toggle goes through useESignGuard — the audit trail records
 * each grant/revoke with the actor + reason.
 */

const StateCell = ({ state, onClick, disabled, title }) => {
  // state: 'role' (inherited) | 'grant' (user grant) | 'revoke' (user revoke) | 'none'
  const sx = { width: 24, height: 24, p: 0, borderRadius: 0.75 };
  let icon;
  let bgcolor;
  if (state === 'role')   { icon = <FilledIcon sx={{ fontSize: 18 }} />;  bgcolor = 'primary.light'; }
  else if (state === 'grant')  { icon = <GrantIcon sx={{ fontSize: 18 }} />; bgcolor = 'success.main'; }
  else if (state === 'revoke') { icon = <RevokeIcon sx={{ fontSize: 18 }} />; bgcolor = 'error.main'; }
  else                         { icon = <EmptyIcon sx={{ fontSize: 18, color: 'action.disabled' }} />; bgcolor = 'transparent'; }

  return (
    <Tooltip title={title || state}>
      <span>
        <IconButton size="small" onClick={onClick} disabled={disabled}
                    sx={{ ...sx, bgcolor, color: state === 'none' ? 'action.disabled' : 'white',
                          '&:hover': { bgcolor: bgcolor === 'transparent' ? 'action.hover' : bgcolor, opacity: 0.85 } }}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};

const Legend = () => (
  <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 1, mb: 2 }}>
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <StateCell state="role" disabled />
      <Typography variant="caption">Inherited from role</Typography>
    </Stack>
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <StateCell state="grant" disabled />
      <Typography variant="caption">Explicit grant</Typography>
    </Stack>
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <StateCell state="revoke" disabled />
      <Typography variant="caption">Explicit revoke</Typography>
    </Stack>
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <StateCell state="none" disabled />
      <Typography variant="caption">Not granted</Typography>
    </Stack>
  </Stack>
);

const PermHeader = ({ perm }) => (
  <Box sx={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)',
             whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11, py: 1 }}>
    {perm.name}
  </Box>
);

// ───────────────────────────────────── Role × Perm sub-tab
const RoleMatrix = ({ roles, perms, onSaved }) => {
  const esign = useESignGuard();
  const [savingRoleId, setSavingRoleId] = useState(null);

  const permsByModule = useMemo(() => {
    const by = {};
    for (const p of perms) (by[p.module || 'MISC'] ||= []).push(p);
    Object.values(by).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return by;
  }, [perms]);

  const roleHas = (role, permId) => (role.permissions || []).some((rp) => rp.id === permId);

  const toggle = (role, perm) => {
    if (role.isSystemRole && role.name === 'SUPER_ADMIN') return;
    const current = (role.permissions || []).map((rp) => rp.id);
    const next = roleHas(role, perm.id)
      ? current.filter((id) => id !== perm.id)
      : [...current, perm.id];
    esign.request({
      meaning: `${roleHas(role, perm.id) ? 'Revoke' : 'Grant'} ${perm.name} on ${role.name}`,
      recordRef: `Role #${role.id}`,
      action: async () => {
        setSavingRoleId(role.id);
        try {
          await assignPermissionsApi(role.id, next);
          onSaved();
        } finally {
          setSavingRoleId(null);
        }
      },
    });
  };

  return (
    <Box>
      <Legend />
      <Paper variant="outlined" sx={{ overflow: 'auto', maxWidth: '100%' }}>
        <Box component="table" sx={{
          borderCollapse: 'collapse', fontSize: 12,
          '& th, & td': { p: 0.5, borderBottom: '1px solid', borderColor: 'divider' },
          '& th.module': { bgcolor: 'action.hover', fontWeight: 700, textAlign: 'left',
                           textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, px: 1 },
        }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, minWidth: 180 }}>Role</th>
              {Object.entries(permsByModule).flatMap(([mod, mperms]) => mperms.map((p) => (
                <th key={p.id}><PermHeader perm={p} /></th>
              )))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td style={{ padding: 8 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600} fontFamily="monospace">{role.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{role.displayName}</Typography>
                  </Box>
                </td>
                {Object.values(permsByModule).flat().map((p) => (
                  <td key={p.id} style={{ textAlign: 'center' }}>
                    <StateCell
                      state={roleHas(role, p.id) ? 'role' : 'none'}
                      onClick={() => toggle(role, p)}
                      disabled={savingRoleId === role.id || (role.isSystemRole && role.name === 'SUPER_ADMIN')}
                      title={`${roleHas(role, p.id) ? 'Remove' : 'Grant'} ${p.name} on ${role.name}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Box>
      </Paper>
      {esign.element}
    </Box>
  );
};

// ───────────────────────────────────── User × Perm sub-tab
const UserMatrix = ({ perms, allUsers, onNeedUserReload }) => {
  const esign = useESignGuard();
  const [userId, setUserId]     = useState('');
  const [user, setUser]         = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [reasonFor, setReasonFor] = useState(null); // { perm, grantType }
  const [reasonText, setReasonText] = useState('');

  const permsByModule = useMemo(() => {
    const by = {};
    for (const p of perms) (by[p.module || 'MISC'] ||= []).push(p);
    Object.values(by).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return by;
  }, [perms]);

  const roleHas = (permId) => (user?.roles || []).some((r) =>
    (r.permissions || []).some((p) => p.id === permId));
  const override = (permId) => overrides.find((o) => o.permissionId === permId);

  const stateOf = (permId) => {
    const o = override(permId);
    if (o && o.grantType === 'REVOKE') return 'revoke';
    if (o && o.grantType === 'GRANT')  return 'grant';
    if (roleHas(permId))                return 'role';
    return 'none';
  };

  const load = async (id) => {
    setLoading(true); setError(null);
    try {
      const [u, o] = await Promise.all([
        allUsers.find((x) => String(x.id) === String(id)),
        listUserOverridesApi(id),
      ]);
      setUser(u || null);
      setOverrides(o.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load overrides.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (userId) load(userId); }, [userId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // State machine on cell click:
  //   none → GRANT ,  role → REVOKE ,  grant/revoke → clear override
  const cycle = (perm) => {
    const s = stateOf(perm.id);
    if (s === 'grant' || s === 'revoke') {
      esign.request({
        meaning: `Clear ${s === 'grant' ? 'grant' : 'revoke'} of ${perm.name} on user`,
        recordRef: user?.username,
        action: async () => {
          await removeUserOverrideApi(userId, perm.id);
          await load(userId);
        },
      });
      return;
    }
    const grantType = s === 'role' ? 'REVOKE' : 'GRANT';
    setReasonFor({ perm, grantType });
    setReasonText('');
  };

  const confirmReason = () => {
    if (!reasonFor) return;
    const { perm, grantType } = reasonFor;
    const reason = reasonText.trim();
    setReasonFor(null); setReasonText('');
    esign.request({
      meaning: `${grantType === 'GRANT' ? 'Grant' : 'Revoke'} ${perm.name} on user`,
      recordRef: user?.username,
      action: async () => {
        await upsertUserOverrideApi(userId, {
          permissionId: perm.id,
          grantType,
          reason: reason || null,
        });
        await load(userId);
      },
    });
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 320 }}>
          <InputLabel>User</InputLabel>
          <Select label="User" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <MenuItem value=""><em>— pick a user —</em></MenuItem>
            {allUsers.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.fullName || u.username} ({u.username})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {user && user.roles && (
          <Stack direction="row" spacing={0.5}>
            {user.roles.map((r) => (
              <Chip key={r.id || r.name} label={r.name} size="small" variant="outlined" />
            ))}
          </Stack>
        )}
      </Stack>

      {!userId ? (
        <Alert severity="info">Pick a user to view and manage their permission overrides.</Alert>
      ) : loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <Legend />
          <Paper variant="outlined" sx={{ p: 1 }}>
            {Object.entries(permsByModule).map(([mod, mperms]) => (
              <Box key={mod} sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary"
                            sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                  {mod}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 36px', rowGap: 0.5 }}>
                  {mperms.map((p) => (
                    <React.Fragment key={p.id}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25 }}>
                        <Typography variant="body2" fontFamily="monospace" fontSize={12}>{p.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.displayName}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <StateCell state={stateOf(p.id)}
                                   onClick={() => cycle(p)}
                                   title={`Click to cycle ${p.name}`} />
                      </Box>
                    </React.Fragment>
                  ))}
                </Box>
              </Box>
            ))}
          </Paper>

          <Dialog
            open={!!reasonFor}
            onClose={(_e, reason) => { if (reason === 'backdropClick' || reason === 'escapeKeyDown') return; setReasonFor(null); }}
            disableEscapeKeyDown
            maxWidth="xs" fullWidth
          >
            <DialogTitle>
              {reasonFor?.grantType === 'GRANT' ? 'Grant' : 'Revoke'} {reasonFor?.perm?.name}
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Audit reason — captured on the override row.
              </Typography>
              <TextField label="Reason" fullWidth multiline rows={3}
                         value={reasonText}
                         onChange={(e) => setReasonText(e.target.value)}
                         inputProps={{ autoComplete: 'off' }} />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setReasonFor(null)}>Cancel</Button>
              <Button variant="contained" onClick={confirmReason}>Continue</Button>
            </DialogActions>
          </Dialog>
        </>
      )}
      {esign.element}
    </Box>
  );
};

// ───────────────────────────────────── Shell
const AdminPermissionTab = () => {
  const [sub, setSub] = useState('role');
  const [roles, setRoles] = useState([]);
  const [perms, setPerms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    setLoading(true); setError(null);
    try {
      const [r, p, u] = await Promise.all([
        getAllRolesFlatApi(),
        getAllPermissionsFlatApi(),
        getUsersApi({ size: 500 }),
      ]);
      setRoles(r.data?.data || []);
      setPerms(p.data?.data || []);
      setUsers(u.data?.data?.content || u.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load matrix data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Permissions</Typography>
          <Typography variant="body2" color="text.secondary">
            Assign permissions to roles, grant / revoke overrides per user.
          </Typography>
        </Box>
        <Tooltip title="Refresh"><IconButton size="small" onClick={fetchAll}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
      </Stack>

      <Tabs value={sub} onChange={(_e, v) => setSub(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="role" label="Role × Permission" />
        <Tab value="user" label="User × Permission" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : sub === 'role' ? (
        <RoleMatrix roles={roles} perms={perms} onSaved={fetchAll} />
      ) : (
        <UserMatrix perms={perms} allUsers={users} onNeedUserReload={fetchAll} />
      )}
    </Box>
  );
};

export default AdminPermissionTab;
