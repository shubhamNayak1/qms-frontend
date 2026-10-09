import React from 'react';
import {
  Box, Paper, Typography, Alert, AlertTitle, Chip, Stack, Divider,
} from '@mui/material';
import {
  GridView as MatrixIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';

/*
 * AdminPermissionTab — Phase 2 placeholder.
 *
 * Phase 2 will ship:
 *   • Role × Permission matrix (edit tick-boxes per role per permission).
 *   • User × Permission matrix with grant/revoke override colouring:
 *       - faint tick  = inherited from role
 *       - green tick  = explicit grant
 *       - red cross   = explicit revoke
 *     Effective perms = (role perms) ∪ (user grants) \ (user revokes).
 *   • Permissions grouped by module (cc.*, capa.*, dev.*, incident.*,
 *     mc.*, dms.*, audit.*, admin.*).
 *   • Every row-level toggle e-signed; audit_log carries the before/after
 *     diff for 21 CFR Part 11 §11.10(e).
 */

const MockCell = ({ state }) => {
  // state: 'role' | 'grant' | 'revoke' | 'none'
  const base = { width: 18, height: 18, borderRadius: 0.5, display: 'inline-block' };
  if (state === 'role')   return <Box sx={{ ...base, bgcolor: 'primary.light', opacity: 0.4 }} />;
  if (state === 'grant')  return <Box sx={{ ...base, bgcolor: 'success.main' }} />;
  if (state === 'revoke') return <Box sx={{ ...base, bgcolor: 'error.light' }} />;
  return <Box sx={{ ...base, border: '1px dashed', borderColor: 'divider' }} />;
};

const Legend = () => (
  <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 1 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <MockCell state="role" />
      <Typography variant="caption">Inherited from role</Typography>
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <MockCell state="grant" />
      <Typography variant="caption">Explicit grant</Typography>
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <MockCell state="revoke" />
      <Typography variant="caption">Explicit revoke</Typography>
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <MockCell state="none" />
      <Typography variant="caption">Not granted</Typography>
    </Box>
  </Stack>
);

const SAMPLE_PERMS = ['cc.initiate', 'cc.hod_assess', 'cc.qa_review', 'cc.approve', 'capa.initiate', 'capa.hod_assess'];
const SAMPLE_USERS = ['Priya (QA Mgr)', 'Rohan (HOD-QA)', 'Vikas (RA)', 'Sana (QA Eng)'];
const MOCK = [
  ['role',   'role',   'role',   'role',  'role',   'role'],   // QA_MANAGER
  ['role',   'role',   'none',   'none',  'grant',  'role'],   // HOD + extra grant
  ['role',   'none',   'none',   'grant', 'none',   'none'],   // RA + stage grant
  ['grant',  'none',   'none',   'none',  'role',   'none'],   // QA_ENG + initiate grant
];

const AdminPermissionTab = () => (
  <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
      <ShieldIcon color="primary" />
      <Typography variant="h6" fontWeight={700}>Permission matrix</Typography>
      <Chip label="Phase 2" size="small" color="primary" variant="outlined" />
    </Stack>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Assign or revoke permissions per role and per user. The matrix below is a visual preview
      of what will ship — numbers, labels and ticks are placeholders.
    </Typography>

    <Alert severity="info" icon={<MatrixIcon />} sx={{ mb: 2 }}>
      <AlertTitle>Permission matrix lands in Phase 2</AlertTitle>
      Phase 2 adds the <code>user_permissions</code> table (grant/revoke overrides), refactors
      the 243 backend <code>@PreAuthorize("hasAnyRole(…)")</code> checks to
      <code>hasAuthority('perm.name')</code>, publishes an ~80-permission catalogue grouped by
      module, and wires up this screen with per-row e-sign. A permissions catalogue draft will
      be shared for approval before any endpoint is touched.
    </Alert>

    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary"
                  letterSpacing={0.5}>
        Preview — User × Permission (mock)
      </Typography>
      <Box sx={{ overflow: 'auto', mt: 1 }}>
        <Box component="table" sx={{
          width: '100%', borderCollapse: 'collapse', fontSize: 12,
          '& th, & td': { p: 1, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'left' },
          '& td.cell, & th.cell': { textAlign: 'center' },
        }}>
          <thead>
            <tr>
              <th>User</th>
              {SAMPLE_PERMS.map((p) => (
                <th key={p} className="cell">
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{p}</Typography>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_USERS.map((u, r) => (
              <tr key={u}>
                <td><Typography variant="body2">{u}</Typography></td>
                {MOCK[r].map((state, c) => (
                  <td key={c} className="cell"><MockCell state={state} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
      <Legend />
    </Paper>

    <Divider sx={{ my: 3 }} />

    <Typography variant="caption" color="text.secondary">
      Visual preview only — no values are persisted. The real matrix will fetch from
      <code> /api/v1/permissions</code> and <code>/api/v1/users</code>, group permissions by
      module, and allow row-level filtering by role, user and module.
    </Typography>
  </Box>
);

export default AdminPermissionTab;
