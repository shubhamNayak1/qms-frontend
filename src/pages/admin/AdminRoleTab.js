import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Chip, Alert, AlertTitle, Button, Stack,
  Table, TableHead, TableRow, TableCell, TableBody, Tooltip, CircularProgress,
} from '@mui/material';
import {
  Lock as LockIcon,
  Verified as SystemIcon,
  AddCircleOutline as AddIcon,
} from '@mui/icons-material';
import { getAllRolesFlatApi } from '../../api/roleApi';

/*
 * AdminRoleTab — Phase 1 read-only roles view.
 *
 * Lists every role currently seeded in the backend. The "Create role",
 * "Edit role" and "Disable role" buttons are intentionally disabled in
 * Phase 1 because the backend still auth-gates every endpoint with
 * hasAnyRole('SUPER_ADMIN','QA_MANAGER',...) across 243 call sites.
 * Adding a custom role today would create a database row with zero
 * effect on access control.
 *
 * Phase 2 flips this: once @PreAuthorize is refactored to
 * hasAuthority('perm.name') and the Permission tab's matrix is live,
 * a new custom role becomes functional the moment it is granted
 * permissions.
 */

const AdminRoleTab = () => {
  const [roles, setRoles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getAllRolesFlatApi();
        setRoles(data?.data || data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load roles.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Roles</Typography>
          <Typography variant="body2" color="text.secondary">
            Seeded role catalogue. Create / Edit / Disable land in Phase 2.
          </Typography>
        </Box>
        <Tooltip title="Role editing is disabled in Phase 1 — see banner below.">
          <span>
            <Button variant="contained" size="small" startIcon={<AddIcon />} disabled>
              Create Role
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <Alert severity="info" icon={<LockIcon />} sx={{ mb: 2 }}>
        <AlertTitle>Role management is read-only in Phase 1</AlertTitle>
        Every backend endpoint today auth-gates on role names (<code>hasAnyRole(…)</code> across
        243 call sites). Creating a custom role would exist in the database with zero effect on
        access control. Phase 2 refactors authorization to permission-based
        (<code>hasAuthority('perm.name')</code>) at which point custom roles become fully
        functional and this tab unlocks Create / Edit / Disable.
      </Alert>

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
                <TableCell>Description</TableCell>
                <TableCell align="right">Permissions</TableCell>
                <TableCell align="right">Users</TableCell>
                <TableCell>Flags</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {r.description || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={r.permissionCount ?? r.permissions?.length ?? 0} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={r.userCount ?? 0} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {r.isSystemRole && (
                      <Chip
                        icon={<SystemIcon fontSize="small" />}
                        label="System"
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {roles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
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
    </Box>
  );
};

export default AdminRoleTab;
