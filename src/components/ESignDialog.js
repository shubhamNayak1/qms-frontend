import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert, Typography, Box, Stack, Chip,
} from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { eSignApi } from '../api/authApi';
import { useAuth } from '../store/AuthContext';

/**
 * 21 CFR Part 11 e-signature confirmation dialog (Round-2 E3).
 *
 *  Renders a modal prompting the user to re-enter their password. On submit
 *  it POSTs /api/v1/auth/e-sign with { username, password, meaning } — the
 *  server verifies the password against the logged-in user and writes an
 *  audit-log entry. On 2xx success we invoke `onSigned()`; the caller then
 *  fires the actual workflow API call (Submit / Approve / Reject / Resend /
 *  Close).
 *
 *  Props
 *    open       — visibility
 *    onClose    — close dialog without signing
 *    onSigned   — async callback fired AFTER the server accepts the signature.
 *                  Caller does the actual workflow transition inside this.
 *    meaning    — short plain-English description of what is being signed.
 *                  Shown on the dialog AND sent to the server for audit log.
 *    recordRef  — optional record reference (e.g. CC-202401-0023) shown
 *                  beneath the meaning for context.
 *    actionLabel — optional short label for the action button (e.g. "Approve",
 *                  "Resend"). Defaults to "Sign &amp; continue".
 */
const ESignDialog = ({
  open,
  onClose,
  onSigned,
  meaning,
  recordRef,
  actionLabel = 'Sign & continue',
}) => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState(null);

  // Reset state every time the dialog opens fresh
  useEffect(() => {
    if (open) {
      setPassword('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const username = user?.username || user?.email || '';

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!password) return;
    setBusy(true); setError(null);
    try {
      await eSignApi({
        username,
        password,
        meaning: meaning || 'Workflow transition',
      });
      // success — hand off to caller (caller closes dialog on success)
      await onSigned?.();
    } catch (err) {
      const msg = err?.response?.data?.message
                 || err?.response?.data?.error
                 || 'Incorrect password. Please try again.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth
            PaperProps={{ component: 'form', autoComplete: 'off',
                          onSubmit: handleSubmit }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockIcon fontSize="small" color="primary" />
        Electronic Signature
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Re-enter your password to electronically sign this action.</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            21 CFR Part 11 — the signature is logged on the audit trail with
            your user ID, timestamp, and the meaning shown below.
          </Typography>
        </Alert>

        {meaning && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1.5,
                    border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.4 }}>
              SIGNING FOR
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.4 }}>{meaning}</Typography>
            {recordRef && (
              <Stack direction="row" spacing={1} sx={{ mt: 0.8 }}>
                <Chip size="small" label={recordRef} />
              </Stack>
            )}
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label="User ID" fullWidth value={username} disabled
          sx={{ mb: 2 }}
          helperText="Locked to the logged-in user"
        />
        <TextField
          label="Password" type="password" required fullWidth autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          /* Round-N (2026-07-04) tester CC-Point-2 · Issue 8: Chrome was
             offering to save the password every time the user e-signed a
             workflow transition. E-signature re-auth is a per-action
             affirmation, not a "sign-in", so pretend this is a
             new-password field. Combined with the form-level
             autoComplete="off" and readOnly-on-focus hack below, Chrome
             stops suggesting saved passwords and stops offering to
             persist this one. */
          inputProps={{
            autoComplete: 'new-password',
            'data-lpignore': 'true',    // hint for LastPass
            'data-form-type': 'other',  // hint for 1Password
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" variant="contained" color="primary"
                disabled={busy || !password}>
          {busy ? 'Verifying…' : actionLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ESignDialog;
