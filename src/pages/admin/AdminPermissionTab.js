import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Chip, Stack, Tabs, Tab, Alert, CircularProgress,
  Tooltip, IconButton, Button, TextField, Autocomplete, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions,
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
const UserMatrix = ({ perms, allUsers }) => {
  const esign = useESignGuard();
  const [selectedUsers, setSelectedUsers] = useState([]);          // array of user objects
  const [overridesByUser, setOverridesByUser] = useState({});      // userId → overrides[]
  const [loadingUsers, setLoadingUsers]   = useState({});          // userId → bool
  const [savingCell, setSavingCell]       = useState(null);        // "{userId}:{permId}"
  const [error, setError]                 = useState(null);
  const [reasonFor, setReasonFor]         = useState(null);        // { user, perm, grantType }
  const [reasonText, setReasonText]       = useState('');

  const permsByModule = useMemo(() => {
    const by = {};
    for (const p of perms) (by[p.module || 'MISC'] ||= []).push(p);
    Object.values(by).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return by;
  }, [perms]);
  const permsFlat = useMemo(() => Object.values(permsByModule).flat(), [permsByModule]);

  // Fetch overrides for any user we don't yet have cached.
  const loadOverrides = async (userId) => {
    if (overridesByUser[userId]) return;
    setLoadingUsers((m) => ({ ...m, [userId]: true }));
    try {
      const { data } = await listUserOverridesApi(userId);
      setOverridesByUser((m) => ({ ...m, [userId]: data?.data || [] }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load overrides.');
      setOverridesByUser((m) => ({ ...m, [userId]: [] }));
    } finally {
      setLoadingUsers((m) => ({ ...m, [userId]: false }));
    }
  };

  useEffect(() => {
    for (const u of selectedUsers) if (u?.id) loadOverrides(u.id);
  }, [selectedUsers]);  // eslint-disable-line react-hooks/exhaustive-deps

  const roleHas = (user, permId) => (user?.roles || []).some((r) =>
    (r.permissions || []).some((p) => p.id === permId));
  const override = (userId, permId) =>
    (overridesByUser[userId] || []).find((o) => o.permissionId === permId);

  const stateOf = (user, permId) => {
    const o = override(user.id, permId);
    if (o && o.grantType === 'REVOKE') return 'revoke';
    if (o && o.grantType === 'GRANT')  return 'grant';
    if (roleHas(user, permId))         return 'role';
    return 'none';
  };

  // Cell click → state machine:
  //   grant | revoke → clear override
  //   role           → ask reason, then REVOKE
  //   none           → ask reason, then GRANT
  const cycle = (user, perm) => {
    const s = stateOf(user, perm.id);
    if (s === 'grant' || s === 'revoke') {
      esign.request({
        meaning: `Clear ${s === 'grant' ? 'grant' : 'revoke'} of ${perm.name} on ${user.username}`,
        recordRef: user.username,
        action: async () => {
          setSavingCell(`${user.id}:${perm.id}`);
          try {
            await removeUserOverrideApi(user.id, perm.id);
            await refreshOverrides(user.id);
          } finally { setSavingCell(null); }
        },
      });
      return;
    }
    const grantType = s === 'role' ? 'REVOKE' : 'GRANT';
    setReasonFor({ user, perm, grantType });
    setReasonText('');
  };

  const refreshOverrides = async (userId) => {
    const { data } = await listUserOverridesApi(userId);
    setOverridesByUser((m) => ({ ...m, [userId]: data?.data || [] }));
  };

  const confirmReason = () => {
    if (!reasonFor) return;
    const { user, perm, grantType } = reasonFor;
    const reason = reasonText.trim();
    setReasonFor(null); setReasonText('');
    esign.request({
      meaning: `${grantType === 'GRANT' ? 'Grant' : 'Revoke'} ${perm.name} on ${user.username}`,
      recordRef: user.username,
      action: async () => {
        setSavingCell(`${user.id}:${perm.id}`);
        try {
          await upsertUserOverrideApi(user.id, {
            permissionId: perm.id,
            grantType,
            reason: reason || null,
          });
          await refreshOverrides(user.id);
        } finally { setSavingCell(null); }
      },
    });
  };

  // Autocomplete "Select all" sentinel — a custom option rendered at the
  // top of the list that toggles between all and none.
  const SELECT_ALL = { id: '__all__', username: '__all__' };
  const handleUserChange = (_e, value) => {
    const hasAll = value.some((v) => v?.id === SELECT_ALL.id);
    if (hasAll) {
      const alreadyAll = selectedUsers.length === allUsers.length;
      setSelectedUsers(alreadyAll ? [] : [...allUsers]);
      return;
    }
    setSelectedUsers(value);
  };

  const anyLoading = selectedUsers.some((u) => loadingUsers[u.id]);

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Autocomplete
          multiple
          disableCloseOnSelect
          size="small"
          sx={{ minWidth: 420, flex: 1, maxWidth: 760 }}
          options={[SELECT_ALL, ...allUsers]}
          value={selectedUsers}
          onChange={handleUserChange}
          getOptionLabel={(o) => o?.id === SELECT_ALL.id
            ? 'Select all'
            : `${o.fullName || o.username} (${o.username})`}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.trim().toLowerCase();
            const matches = opts.filter((o) => {
              if (o.id === SELECT_ALL.id) return true;
              if (!q) return true;
              return (o.fullName || '').toLowerCase().includes(q)
                  || (o.username || '').toLowerCase().includes(q)
                  || (o.email    || '').toLowerCase().includes(q);
            });
            return matches;
          }}
          renderOption={(props, option, { selected }) => {
            if (option.id === SELECT_ALL.id) {
              const allPicked = selectedUsers.length === allUsers.length && allUsers.length > 0;
              return (
                <Box component="li" {...props} sx={{ borderBottom: '1px solid', borderColor: 'divider', fontWeight: 600 }}>
                  <Checkbox size="small" checked={allPicked}
                            indeterminate={!allPicked && selectedUsers.length > 0} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {allPicked ? 'Clear all' : 'Select all'} ({allUsers.length})
                  </Typography>
                </Box>
              );
            }
            return (
              <Box component="li" {...props}>
                <Checkbox size="small" checked={selected} />
                <Box>
                  <Typography variant="body2">{option.fullName || option.username}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    @{option.username}{option.email ? ` · ${option.email}` : ''}
                  </Typography>
                </Box>
              </Box>
            );
          }}
          renderTags={(tagValue, getTagProps) =>
            tagValue.slice(0, 6).map((option, idx) => (
              <Chip
                {...getTagProps({ index: idx })}
                key={option.id}
                size="small"
                label={option.username}
              />
            )).concat(tagValue.length > 6
              ? [<Chip key="more" size="small" variant="outlined" label={`+${tagValue.length - 6}`} />]
              : [])}
          ListboxProps={{ style: { maxHeight: 360 } }}
          renderInput={(params) => (
            <TextField {...params} label="Users"
                        placeholder={selectedUsers.length === 0 ? 'Pick users…' : ''}
                        inputProps={{ ...params.inputProps, autoComplete: 'off' }} />
          )}
        />
        {selectedUsers.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {selectedUsers.length} user{selectedUsers.length === 1 ? '' : 's'} selected
          </Typography>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {selectedUsers.length === 0 ? (
        <Alert severity="info">Pick one or more users to view and manage their permission overrides.</Alert>
      ) : (
        <>
          <Legend />
          <Paper variant="outlined" sx={{ overflow: 'auto', maxWidth: '100%' }}>
            <Box component="table" sx={{
              borderCollapse: 'collapse', fontSize: 12,
              '& th, & td': { p: 0.5, borderBottom: '1px solid', borderColor: 'divider' },
            }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, minWidth: 220, position: 'sticky', left: 0, background: 'white', zIndex: 2 }}>
                    User
                  </th>
                  {permsFlat.map((p) => (
                    <th key={p.id}><PermHeader perm={p} /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedUsers.map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: 8, position: 'sticky', left: 0, background: 'white', zIndex: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{u.fullName || u.username}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{u.username}
                          {loadingUsers[u.id] && <> · <CircularProgress size={10} sx={{ ml: 0.5 }} /></>}
                        </Typography>
                      </Box>
                    </td>
                    {permsFlat.map((p) => (
                      <td key={p.id} style={{ textAlign: 'center' }}>
                        <StateCell
                          state={stateOf(u, p.id)}
                          onClick={() => cycle(u, p)}
                          disabled={savingCell === `${u.id}:${p.id}` || !!loadingUsers[u.id]}
                          title={`${u.username} / ${p.name}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Box>
          </Paper>
          {anyLoading && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Loading overrides for newly-selected users…
            </Typography>
          )}

          <Dialog
            open={!!reasonFor}
            onClose={(_e, reason) => { if (reason === 'backdropClick' || reason === 'escapeKeyDown') return; setReasonFor(null); }}
            disableEscapeKeyDown
            maxWidth="xs" fullWidth
          >
            <DialogTitle>
              {reasonFor?.grantType === 'GRANT' ? 'Grant' : 'Revoke'} {reasonFor?.perm?.name}
              {' '}on {reasonFor?.user?.username}
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

  // Backend caps page size at 100 (see UserController.getUsers @Max(100)).
  // Walk pages until every user is fetched — the Permission matrix needs
  // the full roster.
  const fetchAllUsers = async () => {
    const PAGE = 100;
    const first = await getUsersApi({ page: 0, size: PAGE });
    const body = first.data?.data;
    if (!body) return [];
    const total = body.totalElements ?? body.content?.length ?? 0;
    const all   = [...(body.content || [])];
    const needed = Math.ceil(total / PAGE);
    for (let i = 1; i < needed; i++) {
      const next = await getUsersApi({ page: i, size: PAGE });
      all.push(...(next.data?.data?.content || []));
    }
    return all;
  };

  const fetchAll = async () => {
    setLoading(true); setError(null);
    try {
      const [r, p, u] = await Promise.all([
        getAllRolesFlatApi(),
        getAllPermissionsFlatApi(),
        fetchAllUsers(),
      ]);
      setRoles(r.data?.data || []);
      setPerms(p.data?.data || []);
      setUsers(u);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load matrix data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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
        <UserMatrix perms={perms} allUsers={users} />
      )}
    </Box>
  );
};

export default AdminPermissionTab;
