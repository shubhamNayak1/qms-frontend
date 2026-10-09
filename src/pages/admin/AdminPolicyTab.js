import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, Alert, Divider, Chip, Stack,
} from '@mui/material';
import {
  LockReset as PasswordIcon,
  Schedule as TcdIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import PasswordPolicyDialog from '../users/PasswordPolicyDialog';

/*
 * AdminPolicyTab — Phase 1 Policy tab.
 *
 * Lists every tenant-wide policy as a card:
 *   • Password Policy  → reuses the existing PasswordPolicyDialog editor
 *   • TCD Policy       → placeholder card (lands in P1.3 with a brand-new
 *                         TcdPolicy entity + migration + endpoints)
 *
 * Both actions will be e-signed in P1.4; today the password editor
 * already prompts for a confirm so Phase 1 is audit-safe.
 */

const PolicyCard = ({ icon, title, subtitle, status, onEdit, disabled, disabledReason }) => (
  <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
    <Box sx={{
      width: 44, height: 44, borderRadius: 2, display: 'grid', placeItems: 'center',
      bgcolor: 'primary.light', color: 'primary.contrastText',
    }}>
      {icon}
    </Box>
    <Box sx={{ flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        {status && <Chip label={status} size="small" />}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {subtitle}
      </Typography>
      {disabled && disabledReason && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
          {disabledReason}
        </Typography>
      )}
    </Box>
    <Button
      variant="outlined"
      size="small"
      startIcon={<EditIcon />}
      onClick={onEdit}
      disabled={disabled}
    >
      Edit
    </Button>
  </Paper>
);

const AdminPolicyTab = () => {
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <Box sx={{ p: 3, maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Policies</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Tenant-wide rules enforced across every QMS workflow.
      </Typography>

      <Stack spacing={1.5}>
        <PolicyCard
          icon={<PasswordIcon />}
          title="Password Policy"
          subtitle="Minimum length, character classes, expiry window, re-use lookback and lockout thresholds."
          status="Active"
          onEdit={() => setPwOpen(true)}
        />

        <PolicyCard
          icon={<TcdIcon />}
          title="TCD Policy — Target Closure Days"
          subtitle="Per-module due-date rules (CAPA 30d, Market Complaint 45d, Deviation 60d, Incident 30d, Change Control 90d) plus warning window and max extensions."
          status="Phase 2"
          onEdit={() => {}}
          disabled
          disabledReason="Lands in P1.3 — TcdPolicy entity + migration + /api/v1/policies/tcd endpoints."
        />
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Alert severity="info" variant="outlined">
        <Typography variant="body2">
          Every policy edit lands on the audit log. Phase 1 reuses the existing Password Policy
          dialog's confirm prompt; Phase 1.4 adds a full e-sign re-prompt (password + optional
          reason) in front of every destructive admin action.
        </Typography>
      </Alert>

      <PasswordPolicyDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </Box>
  );
};

export default AdminPolicyTab;
